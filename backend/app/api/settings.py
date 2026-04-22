from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.database import engine
from app.core.scheduler import (
    SCHEDULER_JOB_ID,
    get_scheduler_runtime_snapshot,
    is_target_due,
    reconcile_scheduler,
    scheduler,
    start_scheduler,
)
from app.models.target import Target
from app.schemas.settings import SettingsRead, SettingsUpdate, WebhookTestResponse
from app.services.settings_service import SettingsService
from app.services.webhook_service import WebhookService

router = APIRouter()


@router.get("", response_model=SettingsRead)
def get_runtime_settings():
    settings = SettingsService.get_runtime_settings()
    return SettingsRead(
        project_name=settings.project_name,
        project_env=settings.project_env,
        timezone=settings.timezone,
        scheduler_enabled=settings.scheduler_enabled,
        scheduler_scan_interval_seconds=settings.scheduler_scan_interval_seconds,
        default_poll_interval_seconds=settings.default_poll_interval_seconds,
        max_concurrent_watchers=settings.max_concurrent_watchers,
        global_rate_limit_per_minute=settings.global_rate_limit_per_minute,
        enforce_target_poll_interval=settings.enforce_target_poll_interval,
        webhook_enabled=settings.webhook_enabled,
        webhook_url=settings.webhook_url,
        webhook_url_configured=bool(settings.webhook_url),
        webhook_timeout_seconds=settings.webhook_timeout_seconds,
        enable_screenshot=settings.enable_screenshot,
        screenshot_dir=settings.screenshot_dir,
        playwright_headless=settings.playwright_headless,
        playwright_timeout_ms=settings.playwright_timeout_ms,
        playwright_wait_until=settings.playwright_wait_until,
    )


@router.put("", response_model=SettingsRead)
def update_runtime_settings(payload: SettingsUpdate):
    try:
        settings = SettingsService.save_overrides(payload.model_dump())
        reconcile_scheduler()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    return SettingsRead(
        project_name=settings.project_name,
        project_env=settings.project_env,
        timezone=settings.timezone,
        scheduler_enabled=settings.scheduler_enabled,
        scheduler_scan_interval_seconds=settings.scheduler_scan_interval_seconds,
        default_poll_interval_seconds=settings.default_poll_interval_seconds,
        max_concurrent_watchers=settings.max_concurrent_watchers,
        global_rate_limit_per_minute=settings.global_rate_limit_per_minute,
        enforce_target_poll_interval=settings.enforce_target_poll_interval,
        webhook_enabled=settings.webhook_enabled,
        webhook_url=settings.webhook_url,
        webhook_url_configured=bool(settings.webhook_url),
        webhook_timeout_seconds=settings.webhook_timeout_seconds,
        enable_screenshot=settings.enable_screenshot,
        screenshot_dir=settings.screenshot_dir,
        playwright_headless=settings.playwright_headless,
        playwright_timeout_ms=settings.playwright_timeout_ms,
        playwright_wait_until=settings.playwright_wait_until,
    )


@router.delete("/overrides", response_model=SettingsRead)
def clear_runtime_setting_overrides():
    settings = SettingsService.clear_overrides()
    reconcile_scheduler()

    return SettingsRead(
        project_name=settings.project_name,
        project_env=settings.project_env,
        timezone=settings.timezone,
        scheduler_enabled=settings.scheduler_enabled,
        scheduler_scan_interval_seconds=settings.scheduler_scan_interval_seconds,
        default_poll_interval_seconds=settings.default_poll_interval_seconds,
        max_concurrent_watchers=settings.max_concurrent_watchers,
        global_rate_limit_per_minute=settings.global_rate_limit_per_minute,
        enforce_target_poll_interval=settings.enforce_target_poll_interval,
        webhook_enabled=settings.webhook_enabled,
        webhook_url=settings.webhook_url,
        webhook_url_configured=bool(settings.webhook_url),
        webhook_timeout_seconds=settings.webhook_timeout_seconds,
        enable_screenshot=settings.enable_screenshot,
        screenshot_dir=settings.screenshot_dir,
        playwright_headless=settings.playwright_headless,
        playwright_timeout_ms=settings.playwright_timeout_ms,
        playwright_wait_until=settings.playwright_wait_until,
    )


@router.post("/webhook/test", response_model=WebhookTestResponse)
async def send_webhook_test():
    settings = get_settings()
    if not settings.webhook_enabled or not settings.webhook_url:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Webhook is disabled or URL is not configured",
        )

    await WebhookService.send_test_event()
    return WebhookTestResponse(success=True, message="Webhook test event sent")


@router.post("/scheduler/sync")
def sync_scheduler_scan():
    start_scheduler()
    job = scheduler.get_job(SCHEDULER_JOB_ID)
    if job is not None:
        job.modify(next_run_time=None)
    return {"success": True, "message": "Scheduler scan requested"}


@router.get("/scheduler/status")
def get_scheduler_status():
    settings = get_settings()
    with Session(engine) as session:
        enabled_targets = session.exec(select(Target).where(Target.enabled.is_(True))).all()
        due_targets = [target for target in enabled_targets if is_target_due(target)]
        runtime = get_scheduler_runtime_snapshot()
        active_target_ids = runtime["active_target_ids"]
        running_targets = [
            {
                "id": target.id,
                "name": target.name,
                "url": target.url,
                "last_run_started_at": (
                    target.last_run_started_at.isoformat() if target.last_run_started_at else None
                ),
            }
            for target in enabled_targets
            if target.id in active_target_ids
        ]

    return {
        "scheduler_enabled": settings.scheduler_enabled,
        "scheduler_running": runtime["scheduler_running"],
        "scan_interval_seconds": settings.scheduler_scan_interval_seconds,
        "enabled_target_count": len(enabled_targets),
        "due_target_count": len(due_targets),
        "job_registered": runtime["job_registered"],
        "next_run_time": runtime["next_run_time"],
        "scan_in_progress": runtime["scan_in_progress"],
        "last_scan_started_at": runtime["last_scan_started_at"],
        "last_scan_finished_at": runtime["last_scan_finished_at"],
        "last_scan_error": runtime["last_scan_error"],
        "last_enabled_target_count": runtime["last_enabled_target_count"],
        "last_due_target_count": runtime["last_due_target_count"],
        "last_dispatched_target_count": runtime["last_dispatched_target_count"],
        "active_run_count": runtime["active_run_count"],
        "runs_started_last_minute": runtime["runs_started_last_minute"],
        "running_targets": running_targets,
    }
