import json
from datetime import datetime

from sqlmodel import Session, select

from app.browser.extractor import PageExtractor
from app.browser.playwright_manager import PlaywrightManager
from app.browser.screenshot import ScreenshotService
from app.models.provider import Provider
from app.models.run_record import RunRecord
from app.models.snapshot import Snapshot
from app.models.target import Target
from app.providers import get_provider_adapter
from app.services.alert_service import AlertService
from app.services.diff_service import DiffService
from app.services.execution_guard import ExecutionGuard
from app.services.snapshot_service import SnapshotService
from app.services.webhook_service import WebhookService


class WatcherService:
    """监控任务服务。

    这里只负责观察和采集，不负责下单、支付、验证码或风控绕过。
    """

    @staticmethod
    async def execute_target(session: Session, target_id: int) -> dict:
        target = session.get(Target, target_id)
        if not target:
            raise ValueError("Target not found")
        provider = session.get(Provider, target.provider_id)
        if not provider:
            raise ValueError("Provider not found")
        ExecutionGuard.assert_target_can_run(target)
        ExecutionGuard.acquire_slot(target.id or target_id)

        run = RunRecord(
            target_id=target.id or target_id,
            status="running",
            started_at=datetime.utcnow(),
            has_change=False,
            summary="Observation started",
        )
        session.add(run)
        session.commit()
        session.refresh(run)

        started_at = datetime.utcnow()
        target.last_status = "running"
        target.last_run_started_at = started_at
        target.updated_at = started_at
        session.add(target)
        session.commit()

        try:
            async with PlaywrightManager() as manager:
                observed = await manager.observe(target.url)
                generic_parsed = await PageExtractor.extract(
                    manager.page,
                    observed["content"],
                    observed["title"],
                    observed["url"],
                    observed["responses"],
                )
                adapter = get_provider_adapter(provider.type)
                parsed = adapter.parse(generic_parsed)
                screenshot_path = await ScreenshotService.capture(manager.page, target.name, target.id or target_id)

            previous_snapshot = session.exec(
                select(Snapshot)
                .where(Snapshot.target_id == target_id)
                .order_by(Snapshot.created_at.desc())
            ).first()

            snapshot = SnapshotService.save_snapshot(
                session,
                target_id=target_id,
                run_record_id=run.id or 0,
                parsed=parsed,
                screenshot_path=screenshot_path,
            )

            previous_payload = json.loads(previous_snapshot.parsed_json) if previous_snapshot and previous_snapshot.parsed_json else None
            diff_result = DiffService.compare(previous_payload, parsed)
            has_change = diff_result["has_change"]
            finished_at = datetime.utcnow()

            run.status = "success"
            run.finished_at = finished_at
            run.duration_ms = int((finished_at - started_at).total_seconds() * 1000)
            run.has_change = has_change
            run.summary = json.dumps(
                {
                    "title": parsed.get("title"),
                    "button_text": parsed.get("button_text"),
                    "price_text": parsed.get("price_text"),
                    "stock_text": parsed.get("stock_text"),
                    "countdown_text": parsed.get("countdown_text"),
                    "available": parsed.get("available"),
                    "signal_count": len(parsed.get("signals", [])),
                    "provider_type": provider.type,
                    "diff_summary": diff_result.get("summary"),
                    "screenshot_path": screenshot_path,
                },
                ensure_ascii=False,
            )

            target.last_status = "observed"
            target.last_checked_at = finished_at
            target.updated_at = finished_at

            session.add(run)
            session.add(target)
            session.commit()
            session.refresh(run)
            created_alerts = AlertService.create_for_diff(
                session,
                target=target,
                diff_result=diff_result,
                parsed=parsed,
            )
            webhook_sent = False
            if has_change or diff_result.get("opportunity_detected"):
                webhook_sent = await WebhookService.send_event(
                    event_type="target.observed",
                    target=target,
                    payload={
                        "run_id": run.id,
                        "has_change": has_change,
                        "diff_summary": diff_result.get("summary"),
                        "snapshot": parsed,
                        "alert_ids": [alert.id for alert in created_alerts],
                    },
                )

            return {
                "run_id": run.id,
                "target_id": target_id,
                "status": run.status,
                "duration_ms": run.duration_ms,
                "has_change": has_change,
                "snapshot_id": snapshot.id,
                "snapshot": parsed,
                "screenshot_path": screenshot_path,
                "diff_summary": diff_result.get("summary"),
                "alert_ids": [alert.id for alert in created_alerts],
                "webhook_sent": webhook_sent,
            }
        except Exception as exc:
            finished_at = datetime.utcnow()
            run.status = "failed"
            run.finished_at = finished_at
            run.duration_ms = int((finished_at - started_at).total_seconds() * 1000)
            run.error_message = str(exc)
            run.summary = "Observation failed"

            target.last_status = "failed"
            target.last_checked_at = finished_at
            target.updated_at = finished_at

            session.add(run)
            session.add(target)
            session.commit()
            raise
        finally:
            ExecutionGuard.release_slot(target.id or target_id)
