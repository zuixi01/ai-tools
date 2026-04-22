from datetime import datetime

import httpx

from app.core.config import get_settings
from app.models.target import Target

settings = get_settings()


class WebhookService:
    """最小 webhook 推送服务。

    只推送观察结果摘要，不触发任何自动购买动作。
    """

    @staticmethod
    async def send_event(*, event_type: str, target: Target, payload: dict) -> bool:
        if not settings.webhook_enabled or not settings.webhook_url:
            return False

        body = {
            "event_type": event_type,
            "sent_at": datetime.utcnow().isoformat(),
            "target": {
                "id": target.id,
                "name": target.name,
                "url": target.url,
                "mode": target.mode,
            },
            "payload": payload,
        }

        async with httpx.AsyncClient(timeout=settings.webhook_timeout_seconds) as client:
            response = await client.post(settings.webhook_url, json=body)
            response.raise_for_status()
        return True

    @staticmethod
    async def send_test_event() -> bool:
        if not settings.webhook_enabled or not settings.webhook_url:
            return False

        body = {
            "event_type": "webhook.test",
            "sent_at": datetime.utcnow().isoformat(),
            "target": {
                "id": 0,
                "name": "Webhook Test",
                "url": "https://example.com",
                "mode": "manual",
            },
            "payload": {
                "message": "This is a test webhook from cloud-offer-watch.",
                "boundary": "observe-alert-manual-confirmation-only",
            },
        }

        async with httpx.AsyncClient(timeout=settings.webhook_timeout_seconds) as client:
            response = await client.post(settings.webhook_url, json=body)
            response.raise_for_status()
        return True
