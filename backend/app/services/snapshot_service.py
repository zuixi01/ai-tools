import json

from sqlmodel import Session

from app.models.snapshot import Snapshot
from app.utils.hash import sha256_text


class SnapshotService:
    """快照存储服务。"""

    @staticmethod
    def save_snapshot(
        session: Session,
        *,
        target_id: int,
        run_record_id: int,
        parsed: dict,
        screenshot_path: str | None,
    ) -> Snapshot:
        fingerprint = sha256_text(
            json.dumps(
                {
                    "title": parsed.get("title", ""),
                    "button_text": parsed.get("button_text", ""),
                    "raw_excerpt": parsed.get("raw_excerpt", ""),
                    "url": parsed.get("url", ""),
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        snapshot = Snapshot(
            target_id=target_id,
            run_record_id=run_record_id,
            hash=fingerprint,
            title=parsed.get("title"),
            available=parsed.get("available", False),
            button_text=parsed.get("button_text"),
            price_text=parsed.get("price_text"),
            stock_text=parsed.get("stock_text"),
            plan_name=parsed.get("plan_name"),
            countdown_text=parsed.get("countdown_text"),
            parsed_json=json.dumps(parsed, ensure_ascii=False),
            raw_excerpt=parsed.get("raw_excerpt"),
            screenshot_path=screenshot_path,
        )
        session.add(snapshot)
        session.commit()
        session.refresh(snapshot)
        return snapshot
