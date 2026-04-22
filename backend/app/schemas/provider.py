from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


ProviderType = Literal["glm", "aliyun"]


class ProviderBase(BaseModel):
    """Provider 基础字段。

    这里用结构化 config_json，避免前端手填原始 JSON 字符串。
    """

    name: str = Field(min_length=2, max_length=100)
    type: ProviderType
    enabled: bool = True
    config_json: dict[str, Any] = Field(default_factory=dict)


class ProviderCreate(ProviderBase):
    pass


class ProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    type: ProviderType | None = None
    enabled: bool | None = None
    config_json: dict[str, Any] | None = None


class ProviderRead(ProviderBase):
    id: int
    target_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProviderListResponse(BaseModel):
    items: list[ProviderRead]
    total: int
