from sqlmodel import Session

from app.models.alert import Alert
from app.models.target import Target


class AlertService:
    """告警生成服务。"""

    @staticmethod
    def create_alert(
        session: Session,
        *,
        target: Target,
        level: str,
        title: str,
        content: str,
    ) -> Alert:
        alert = Alert(
            target_id=target.id or 0,
            level=level,
            title=title,
            content=content,
            is_read=False,
        )
        session.add(alert)
        session.commit()
        session.refresh(alert)
        return alert

    @classmethod
    def create_for_diff(
        cls,
        session: Session,
        *,
        target: Target,
        diff_result: dict,
        parsed: dict,
    ) -> list[Alert]:
        created_alerts: list[Alert] = []

        if diff_result.get("has_change"):
            created_alerts.append(
                cls.create_alert(
                    session,
                    target=target,
                    level="info",
                    title=f"Target changed: {target.name}",
                    content=diff_result.get("summary", "Tracked fields changed"),
                )
            )

        if diff_result.get("opportunity_detected"):
            created_alerts.append(
                cls.create_alert(
                    session,
                    target=target,
                    level="success",
                    title=f"Opportunity detected: {target.name}",
                    content=(
                        f"title={parsed.get('title', '')}; "
                        f"button={parsed.get('button_text', '')}; "
                        f"price={parsed.get('price_text', '')}; "
                        f"url={parsed.get('url', '')}"
                    ),
                )
            )

        return created_alerts
