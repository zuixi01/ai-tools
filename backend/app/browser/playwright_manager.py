import os
from pathlib import Path
from typing import Any

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from app.core.config import get_settings

settings = get_settings()


class PlaywrightManager:
    """正式运行期浏览器管理器。

    这里只用于页面观察、DOM 采集、截图和公开响应监听，不负责下单或支付。
    """

    def __init__(self) -> None:
        self.browser: Browser | None = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None
        self._playwright = None

    async def __aenter__(self) -> "PlaywrightManager":
        workspace_browser_path = Path(__file__).resolve().parents[3] / "pw-browsers"
        if workspace_browser_path.exists():
            os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(workspace_browser_path))

        self._playwright = await async_playwright().start()
        self.browser = await self._playwright.chromium.launch(headless=settings.playwright_headless)
        self.context = await self.browser.new_context()
        self.page = await self.context.new_page()
        self.page.set_default_timeout(settings.playwright_timeout_ms)
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def observe(self, url: str) -> dict[str, Any]:
        """打开页面并返回原始观察结果。"""
        if not self.page:
            raise RuntimeError("PlaywrightManager has not been initialized")

        responses: list[dict[str, Any]] = []

        def on_response(response) -> None:
            if len(responses) >= 20:
                return
            responses.append(
                {
                    "url": response.url,
                    "status": response.status,
                    "resource_type": response.request.resource_type,
                }
            )

        self.page.on("response", on_response)
        await self.page.goto(url, wait_until=settings.playwright_wait_until)
        await self.page.wait_for_timeout(1000)

        return {
            "page": self.page,
            "title": await self.page.title(),
            "url": self.page.url,
            "content": await self.page.content(),
            "responses": responses,
        }
