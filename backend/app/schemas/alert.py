from datetime import datetime

from pydantic import BaseModel


class AlertRead(BaseModel):
    id: int
    target_id: int
    target_name: str | None = None
    target_url: str | None = None
    level: str
    title: str
    content: str
    is_read: bool
    created_at: datetime


class AlertListResponse(BaseModel):
    items: list[AlertRead]
    total: int
