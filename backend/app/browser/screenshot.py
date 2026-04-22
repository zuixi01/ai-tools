from datetime import datetime
from pathlib import Path

from playwright.async_api import Page

from app.core.config import get_settings

settings = get_settings()


class ScreenshotService:
    """截图服务。"""

    @staticmethod
    def _safe_name(value: str) -> str:
        return "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in value.lower()).strip("-")

    @classmethod
    async def capture(cls, page: Page, target_name: str, target_id: int) -> str | None:
        if not settings.enable_screenshot:
            return None

        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        directory = settings.screenshot_dir_path / datetime.utcnow().strftime("%Y%m%d")
        directory.mkdir(parents=True, exist_ok=True)

        file_name = f"target-{target_id}-{cls._safe_name(target_name) or 'capture'}-{timestamp}.png"
        file_path = directory / file_name
        await page.screenshot(path=str(file_path), full_page=True)
        return str(file_path)
