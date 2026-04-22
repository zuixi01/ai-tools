from pydantic import BaseModel


class SettingsRead(BaseModel):
    project_name: str
    project_env: str
    timezone: str
    scheduler_enabled: bool
    scheduler_scan_interval_seconds: int
    default_poll_interval_seconds: int
    max_concurrent_watchers: int
    global_rate_limit_per_minute: int
    enforce_target_poll_interval: bool
    webhook_enabled: bool
    webhook_url: str | None = None
    webhook_url_configured: bool
    webhook_timeout_seconds: int
    enable_screenshot: bool
    screenshot_dir: str
    playwright_headless: bool
    playwright_timeout_ms: int
    playwright_wait_until: str


class WebhookTestResponse(BaseModel):
    success: bool
    message: str


class SettingsUpdate(BaseModel):
    scheduler_enabled: bool
    scheduler_scan_interval_seconds: int
    default_poll_interval_seconds: int
    max_concurrent_watchers: int
    global_rate_limit_per_minute: int
    enforce_target_poll_interval: bool
    webhook_enabled: bool
    webhook_url: str | None = None
    webhook_timeout_seconds: int
