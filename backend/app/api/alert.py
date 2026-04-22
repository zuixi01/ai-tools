from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.alert import Alert
from app.models.target import Target
from app.schemas.alert import AlertListResponse, AlertRead

router = APIRouter()


def _build_alert_read(alert: Alert, target: Target | None) -> AlertRead:
    return AlertRead(
        id=alert.id or 0,
        target_id=alert.target_id,
        target_name=target.name if target else None,
        target_url=target.url if target else None,
        level=alert.level,
        title=alert.title,
        content=alert.content,
        is_read=alert.is_read,
        created_at=alert.created_at,
    )


@router.get("", response_model=AlertListResponse)
def list_alerts(
    unread_only: bool = Query(default=False),
    since_hours: int | None = Query(default=None, ge=1, le=24 * 90),
    provider_id: int | None = Query(default=None, ge=1),
    target_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
):
    statement = select(Alert).order_by(Alert.created_at.desc())
    if unread_only:
        statement = statement.where(Alert.is_read.is_(False))
    if since_hours is not None:
        since_at = datetime.now(timezone.utc) - timedelta(hours=since_hours)
        statement = statement.where(Alert.created_at >= since_at)
    if target_id is not None:
        statement = statement.where(Alert.target_id == target_id)
    elif provider_id is not None:
        provider_target_ids = session.exec(
            select(Target.id).where(Target.provider_id == provider_id)
        ).all()
        if not provider_target_ids:
            return AlertListResponse(items=[], total=0)
        statement = statement.where(Alert.target_id.in_(provider_target_ids))

    alerts = session.exec(statement).all()[:limit]
    target_ids = {alert.target_id for alert in alerts}
    targets = {
        target.id: target for target in session.exec(select(Target).where(Target.id.in_(target_ids))).all()
    } if target_ids else {}

    return AlertListResponse(
        items=[_build_alert_read(alert, targets.get(alert.target_id)) for alert in alerts],
        total=len(alerts),
    )


@router.post("/{alert_id}/read", response_model=AlertRead)
def mark_alert_as_read(alert_id: int, session: Session = Depends(get_session)):
    alert = session.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    alert.is_read = True
    session.add(alert)
    session.commit()
    session.refresh(alert)

    target = session.get(Target, alert.target_id)
    return _build_alert_read(alert, target)
