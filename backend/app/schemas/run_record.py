from datetime import datetime
from typing import Any

from pydantic import BaseModel


class RunRecordRead(BaseModel):
    id: int
    target_id: int
    target_name: str | None = None
    target_url: str | None = None
    status: str
    started_at: datetime
    finished_at: datetime | None = None
    duration_ms: int | None = None
    has_change: bool
    summary: str | None = None
    diff_summary: str | None = None
    error_message: str | None = None
    screenshot_path: str | None = None
    snapshot: dict[str, Any] | None = None


class RunRecordListResponse(BaseModel):
    items: list[RunRecordRead]
    total: int


class RunExecutionResponse(BaseModel):
    run_id: int | None
    target_id: int
    status: str
    duration_ms: int | None
    has_change: bool
    snapshot_id: int | None
    snapshot: dict[str, Any]
    screenshot_path: str | None
    diff_summary: str | None = None
    alert_ids: list[int] = []
    webhook_sent: bool = False
