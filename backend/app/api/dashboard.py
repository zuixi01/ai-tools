from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.database import get_session
from app.core.scheduler import get_scheduler_runtime_snapshot
from app.models.alert import Alert
from app.models.provider import Provider
from app.models.run_record import RunRecord
from app.models.target import Target

router = APIRouter()


@router.get("/summary")
def get_dashboard_summary(session: Session = Depends(get_session)):
    """Dashboard summary."""
    settings = get_settings()
    since_24h = datetime.utcnow() - timedelta(hours=24)

    provider_count = session.exec(select(func.count()).select_from(Provider)).one()
    active_targets = session.exec(
        select(func.count()).select_from(Target).where(Target.enabled.is_(True))
    ).one()
    changes_last_24h = session.exec(
        select(func.count())
        .select_from(RunRecord)
        .where(RunRecord.has_change.is_(True), RunRecord.started_at >= since_24h)
    ).one()
    recent_failures_rows = session.exec(
        select(RunRecord)
        .where(RunRecord.status == "failed")
        .order_by(RunRecord.started_at.desc())
        .limit(5)
    ).all()
    recent_alerts = session.exec(
        select(Alert).where(Alert.is_read.is_(False)).order_by(Alert.created_at.desc()).limit(5)
    ).all()
    scheduler_runtime = get_scheduler_runtime_snapshot()

    recent_failures = [
        {
            "run_id": run.id,
            "target_id": run.target_id,
            "error_message": run.error_message,
        }
        for run in recent_failures_rows
    ]
    recent_opportunities = [
        {
            "id": alert.id,
            "target_id": alert.target_id,
            "title": alert.title,
        }
        for alert in recent_alerts
        if alert.level == "success"
    ]

    return {
        "project": settings.project_name,
        "provider_count": provider_count,
        "active_targets": active_targets,
        "changes_last_24h": changes_last_24h,
        "scheduler": {
            "enabled": settings.scheduler_enabled,
            "running": scheduler_runtime["scheduler_running"],
            "scan_interval_seconds": settings.scheduler_scan_interval_seconds,
            "job_registered": scheduler_runtime["job_registered"],
            "scan_in_progress": scheduler_runtime["scan_in_progress"],
            "next_run_time": scheduler_runtime["next_run_time"],
            "last_scan_started_at": scheduler_runtime["last_scan_started_at"],
            "last_scan_finished_at": scheduler_runtime["last_scan_finished_at"],
            "active_run_count": scheduler_runtime["active_run_count"],
        },
        "recent_alerts": [
            {"id": alert.id, "title": alert.title, "level": alert.level}
            for alert in recent_alerts
        ],
        "recent_failures": recent_failures,
        "recent_opportunities": recent_opportunities,
        "message": (
            "Monitoring controls, alerts, execution safeguards, and safe scheduler scanning are active."
            if settings.scheduler_enabled
            else "Monitoring controls, alerts, and execution safeguards are active."
        ),
    }
