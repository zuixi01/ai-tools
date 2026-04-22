from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Snapshot(SQLModel, table=True):
    __tablename__ = "snapshots"

    id: Optional[int] = Field(default=None, primary_key=True)
    target_id: int = Field(index=True)
    run_record_id: int = Field(index=True)
    hash: str
    title: str | None = Field(default=None)
    available: bool = Field(default=False)
    button_text: str | None = Field(default=None)
    price_text: str | None = Field(default=None)
    stock_text: str | None = Field(default=None)
    plan_name: str | None = Field(default=None)
    countdown_text: str | None = Field(default=None)
    parsed_json: str = Field(default="{}")
    raw_excerpt: str | None = Field(default=None)
    screenshot_path: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

