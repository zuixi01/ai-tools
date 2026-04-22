from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class RunRecord(SQLModel, table=True):
    __tablename__ = "run_records"

    id: Optional[int] = Field(default=None, primary_key=True)
    target_id: int = Field(index=True)
    status: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: datetime | None = Field(default=None)
    duration_ms: int | None = Field(default=None)
    has_change: bool = Field(default=False)
    summary: str | None = Field(default=None)
    error_message: str | None = Field(default=None)

