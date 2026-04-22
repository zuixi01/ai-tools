import asyncio
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.database import engine
from app.models.target import Target
from app.services.execution_guard import ExecutionGuard
from app.services.watcher_service import WatcherService

settings = get_settings()
logger = logging.getLogger(__name__)

SCHEDULER_JOB_ID = "target-scan-loop"

scheduler = BackgroundScheduler(
    timezone=settings.timezone,
    job_defaults={
        "coalesce": True,
        "max_instances": 1,
        "misfire_grace_time": max(settings.scheduler_scan_interval_seconds, 10),
    },
)

runtime_state = {
    "scan_in_progress": False,
    "last_scan_started_at": None,
    "last_scan_finished_at": None,
    "last_scan_error": None,
    "last_enabled_target_count": 0,
    "last_due_target_count": 0,
    "last_dispatched_target_count": 0,
}


def start_scheduler() -> None:
    if scheduler.get_job(SCHEDULER_JOB_ID) is None:
        scheduler.add_job(
            run_target_scan,
            trigger="interval",
            seconds=settings.scheduler_scan_interval_seconds,
            id=SCHEDULER_JOB_ID,
            replace_existing=True,
        )
        logger.info(
            "Scheduler job registered: id=%s interval=%ss",
            SCHEDULER_JOB_ID,
            settings.scheduler_scan_interval_seconds,
        )

    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def reconcile_scheduler() -> None:
    job = scheduler.get_job(SCHEDULER_JOB_ID)

    if settings.scheduler_enabled:
        if not scheduler.running:
            scheduler.start()
            logger.info("Scheduler started")

        if job is None:
            scheduler.add_job(
                run_target_scan,
                trigger="interval",
                seconds=settings.scheduler_scan_interval_seconds,
                id=SCHEDULER_JOB_ID,
                replace_existing=True,
            )
            logger.info(
                "Scheduler job registered: id=%s interval=%ss",
                SCHEDULER_JOB_ID,
                settings.scheduler_scan_interval_seconds,
            )
        else:
            scheduler.reschedule_job(
                SCHEDULER_JOB_ID,
                trigger="interval",
                seconds=settings.scheduler_scan_interval_seconds,
            )
            logger.info(
                "Scheduler job rescheduled: id=%s interval=%ss",
                SCHEDULER_JOB_ID,
                settings.scheduler_scan_interval_seconds,
            )
        return

    if job is not None:
        scheduler.remove_job(SCHEDULER_JOB_ID)
        logger.info("Scheduler job removed because scheduler is disabled")


def get_scheduler_runtime_snapshot() -> dict:
    job = scheduler.get_job(SCHEDULER_JOB_ID)
    guard_snapshot = ExecutionGuard.snapshot()
    return {
        "scheduler_running": scheduler.running,
        "job_registered": job is not None,
        "next_run_time": job.next_run_time.isoformat() if job and job.next_run_time else None,
        "scan_in_progress": runtime_state["scan_in_progress"],
        "last_scan_started_at": (
            runtime_state["last_scan_started_at"].isoformat()
            if runtime_state["last_scan_started_at"]
            else None
        ),
        "last_scan_finished_at": (
            runtime_state["last_scan_finished_at"].isoformat()
            if runtime_state["last_scan_finished_at"]
            else None
        ),
        "last_scan_error": runtime_state["last_scan_error"],
        "last_enabled_target_count": runtime_state["last_enabled_target_count"],
        "last_due_target_count": runtime_state["last_due_target_count"],
        "last_dispatched_target_count": runtime_state["last_dispatched_target_count"],
        "active_run_count": guard_snapshot["active_runs"],
        "active_target_ids": guard_snapshot["active_target_ids"],
        "runs_started_last_minute": guard_snapshot["runs_started_last_minute"],
    }


def is_target_due(target: Target, now: datetime | None = None) -> bool:
    now = now or datetime.utcnow()
    if not target.enabled:
        return False
    if target.last_checked_at is None:
        return True

    next_due_at = target.last_checked_at + timedelta(seconds=target.poll_interval_seconds)
    return now >= next_due_at


def run_target_scan() -> None:
    """安全版定时扫描。

    只扫描已启用 target，且只按 poll_interval_seconds 判断是否到期。
    """
    now = datetime.utcnow()
    runtime_state["scan_in_progress"] = True
    runtime_state["last_scan_started_at"] = now
    runtime_state["last_scan_error"] = None
    logger.debug("Scheduler scan started at %s", now.isoformat())

    try:
        with Session(engine) as session:
            enabled_targets = session.exec(
                select(Target).where(Target.enabled.is_(True)).order_by(Target.updated_at.asc())
            ).all()

            due_targets = [target for target in enabled_targets if is_target_due(target, now)]
            runtime_state["last_enabled_target_count"] = len(enabled_targets)
            runtime_state["last_due_target_count"] = len(due_targets)
            runtime_state["last_dispatched_target_count"] = len(due_targets)

            logger.info(
                "Scheduler scan completed: enabled=%s due=%s",
                len(enabled_targets),
                len(due_targets),
            )

            for target in due_targets:
                try:
                    logger.info("Scheduler executing target id=%s name=%s", target.id, target.name)
                    asyncio.run(WatcherService.execute_target(session, target.id or 0))
                except Exception as exc:
                    logger.warning(
                        "Scheduler skipped or failed target id=%s name=%s reason=%s",
                        target.id,
                        target.name,
                        str(exc),
                    )
    except Exception as exc:
        runtime_state["last_scan_error"] = str(exc)
        logger.exception("Scheduler scan failed: %s", exc)
        raise
    finally:
        runtime_state["scan_in_progress"] = False
        runtime_state["last_scan_finished_at"] = datetime.utcnow()
