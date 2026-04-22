import json
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.database import engine
from app.models.app_setting import AppSetting

EDITABLE_FIELDS = {
    "scheduler_enabled": bool,
    "scheduler_scan_interval_seconds": int,
    "default_poll_interval_seconds": int,
    "max_concurrent_watchers": int,
    "global_rate_limit_per_minute": int,
    "enforce_target_poll_interval": bool,
    "webhook_enabled": bool,
    "webhook_url": (str, type(None)),
    "webhook_timeout_seconds": int,
}


class SettingsService:
    """Runtime settings persistence and safe override application."""

    @staticmethod
    def get_runtime_settings() -> Settings:
        return get_settings()

    @staticmethod
    def get_environment_defaults() -> Settings:
        return Settings()

    @staticmethod
    def load_overrides_into_runtime(session: Session | None = None) -> Settings:
        settings = get_settings()
        owns_session = session is None
        if owns_session:
            session = Session(engine)

        try:
            rows = session.exec(select(AppSetting)).all()
            for row in rows:
                if row.key not in EDITABLE_FIELDS:
                    continue
                setattr(settings, row.key, json.loads(row.value_json))
            return settings
        finally:
            if owns_session and session is not None:
                session.close()

    @staticmethod
    def validate_payload(payload: dict[str, Any]) -> dict[str, Any]:
        normalized: dict[str, Any] = {}
        for key, expected_type in EDITABLE_FIELDS.items():
            if key not in payload:
                continue

            value = payload[key]
            if expected_type is int and isinstance(value, bool):
                raise ValueError(f"{key} must be an integer")
            if expected_type is bool and not isinstance(value, bool):
                raise ValueError(f"{key} must be a boolean")
            if expected_type is int and not isinstance(value, int):
                raise ValueError(f"{key} must be an integer")
            if isinstance(expected_type, tuple):
                if not isinstance(value, expected_type):
                    raise ValueError(f"{key} has an invalid type")
            elif expected_type is not bool and expected_type is not int and not isinstance(value, expected_type):
                raise ValueError(f"{key} has an invalid type")

            normalized[key] = value

        if "scheduler_scan_interval_seconds" in normalized and normalized["scheduler_scan_interval_seconds"] < 5:
            raise ValueError("scheduler_scan_interval_seconds must be at least 5 seconds")
        if "default_poll_interval_seconds" in normalized and normalized["default_poll_interval_seconds"] < 15:
            raise ValueError("default_poll_interval_seconds must be at least 15 seconds")
        if "max_concurrent_watchers" in normalized:
            value = normalized["max_concurrent_watchers"]
            if value < 1 or value > 5:
                raise ValueError("max_concurrent_watchers must be between 1 and 5")
        if "global_rate_limit_per_minute" in normalized:
            value = normalized["global_rate_limit_per_minute"]
            if value < 1 or value > 120:
                raise ValueError("global_rate_limit_per_minute must be between 1 and 120")
        if "webhook_timeout_seconds" in normalized:
            value = normalized["webhook_timeout_seconds"]
            if value < 3 or value > 60:
                raise ValueError("webhook_timeout_seconds must be between 3 and 60")
        if "webhook_url" in normalized and isinstance(normalized["webhook_url"], str):
            normalized["webhook_url"] = normalized["webhook_url"].strip() or None

        return normalized

    @staticmethod
    def save_overrides(payload: dict[str, Any]) -> Settings:
        normalized = SettingsService.validate_payload(payload)
        settings = get_settings()

        with Session(engine) as session:
            for key, value in normalized.items():
                row = session.exec(select(AppSetting).where(AppSetting.key == key)).first()
                if row is None:
                    row = AppSetting(key=key, value_json=json.dumps(value, ensure_ascii=False))
                else:
                    row.value_json = json.dumps(value, ensure_ascii=False)
                    row.updated_at = datetime.utcnow()
                session.add(row)
                setattr(settings, key, value)

            session.commit()

        return settings

    @staticmethod
    def clear_overrides() -> Settings:
        settings = get_settings()
        defaults = SettingsService.get_environment_defaults()

        with Session(engine) as session:
            rows = session.exec(select(AppSetting)).all()
            for row in rows:
                if row.key in EDITABLE_FIELDS:
                    session.delete(row)
            session.commit()

        for key in EDITABLE_FIELDS:
            setattr(settings, key, getattr(defaults, key))

        return settings
