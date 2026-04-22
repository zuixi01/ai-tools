from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class AppSetting(SQLModel, table=True):
    __tablename__ = "app_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(index=True, unique=True)
    value_json: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)
