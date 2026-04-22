from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Target(SQLModel, table=True):
    __tablename__ = "targets"

    id: Optional[int] = Field(default=None, primary_key=True)
    provider_id: int = Field(index=True)
    name: str
    url: str
    mode: str = Field(default="browser")
    poll_interval_seconds: int = Field(default=60)
    enabled: bool = Field(default=True)
    last_status: str | None = Field(default=None)
    last_checked_at: datetime | None = Field(default=None)
    last_run_started_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
