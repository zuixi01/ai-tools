from app.providers.aliyun import AliyunProviderAdapter
from app.providers.base import BaseProviderAdapter
from app.providers.glm import GlmProviderAdapter


def get_provider_adapter(provider_type: str) -> BaseProviderAdapter:
    provider_type = (provider_type or "").strip().lower()
    mapping = {
        "glm": GlmProviderAdapter(),
        "aliyun": AliyunProviderAdapter(),
    }

    if provider_type not in mapping:
        raise ValueError(f"Unsupported provider type: {provider_type}")

    return mapping[provider_type]
