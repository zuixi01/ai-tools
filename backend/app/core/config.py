from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置入口，统一从环境变量读取。"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    project_name: str = Field(default="cloud-offer-watch", alias="PROJECT_NAME")
    project_env: str = Field(default="development", alias="PROJECT_ENV")
    backend_host: str = Field(default="0.0.0.0", alias="BACKEND_HOST")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")
    backend_cors_origins: str = Field(default="http://localhost:3000", alias="BACKEND_CORS_ORIGINS")
    database_url: str = Field(default="sqlite:///./data/cloud_offer_watch.db", alias="DATABASE_URL")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    timezone: str = Field(default="Asia/Shanghai", alias="APP_TIMEZONE")
    scheduler_enabled: bool = Field(default=False, alias="SCHEDULER_ENABLED")
    scheduler_scan_interval_seconds: int = Field(default=15, alias="SCHEDULER_SCAN_INTERVAL_SECONDS")
    default_poll_interval_seconds: int = Field(default=60, alias="DEFAULT_POLL_INTERVAL_SECONDS")
    max_concurrent_watchers: int = Field(default=2, alias="MAX_CONCURRENT_WATCHERS")
    global_rate_limit_per_minute: int = Field(default=30, alias="GLOBAL_RATE_LIMIT_PER_MINUTE")
    enforce_target_poll_interval: bool = Field(default=True, alias="ENFORCE_TARGET_POLL_INTERVAL")
    enable_screenshot: bool = Field(default=True, alias="ENABLE_SCREENSHOT")
    screenshot_dir: str = Field(default="./captures", alias="SCREENSHOT_DIR")
    webhook_url: str | None = Field(default=None, alias="WEBHOOK_URL")
    webhook_enabled: bool = Field(default=False, alias="WEBHOOK_ENABLED")
    webhook_timeout_seconds: int = Field(default=10, alias="WEBHOOK_TIMEOUT_SECONDS")
    playwright_headless: bool = Field(default=True, alias="PLAYWRIGHT_HEADLESS")
    playwright_timeout_ms: int = Field(default=15000, alias="PLAYWRIGHT_TIMEOUT_MS")
    playwright_wait_until: str = Field(default="domcontentloaded", alias="PLAYWRIGHT_WAIT_UNTIL")
    html_excerpt_max_chars: int = Field(default=3000, alias="HTML_EXCERPT_MAX_CHARS")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def screenshot_dir_path(self) -> Path:
        return Path(self.screenshot_dir)


@lru_cache
def get_settings() -> Settings:
    return Settings()
