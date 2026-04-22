from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Provider(SQLModel, table=True):
    """Provider 表定义，Phase 2 会继续扩展 CRUD 与关系。"""

    __tablename__ = "providers"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    type: str = Field(index=True)
    enabled: bool = Field(default=True)
    config_json: str = Field(default="{}")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

