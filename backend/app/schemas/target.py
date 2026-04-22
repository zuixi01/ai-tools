from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


TargetMode = Literal["browser", "http"]
PollIntervalSource = Literal["provider", "global", "custom"]


class TargetBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    provider_id: int
    url: HttpUrl
    mode: TargetMode = "browser"
    poll_interval_seconds: int = Field(default=60, ge=10, le=3600)
    enabled: bool = True
    last_status: str | None = None


class TargetCreate(TargetBase):
    poll_interval_seconds: int | None = Field(default=None, ge=10, le=3600)


class TargetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    provider_id: int | None = None
    url: HttpUrl | None = None
    mode: TargetMode | None = None
    poll_interval_seconds: int | None = Field(default=None, ge=10, le=3600)
    enabled: bool | None = None
    last_status: str | None = None


class TargetRead(TargetBase):
    id: int
    provider_name: str | None = None
    provider_type: str | None = None
    provider_default_poll_interval_seconds: int | None = None
    effective_poll_interval_seconds: int
    poll_interval_source: PollIntervalSource = "custom"
    last_checked_at: datetime | None = None
    last_run_started_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TargetListResponse(BaseModel):
    items: list[TargetRead]
    total: int
