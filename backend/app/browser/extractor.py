import re
from typing import Any

from playwright.async_api import Page

from app.core.config import get_settings

settings = get_settings()


class PageExtractor:
    """通用页面信号提取器。

    这一层只做平台无关的公开信息采集，后续再交给 ProviderAdapter 做规则增强。
    """

    BUTTON_SELECTOR = ",".join(
        [
            "button",
            "a",
            "[role='button']",
            "input[type='button']",
            "input[type='submit']",
        ]
    )

    HEADING_SELECTOR = "h1, h2, h3, [data-testid*='title'], [class*='title']"
    PRICE_PATTERN = re.compile(r"(?:¥|￥|RMB\s?|USD\s?\$|\$)\s?\d+(?:[.,]\d{1,2})?")

    @staticmethod
    def clean_text(value: str) -> str:
        return re.sub(r"\s+", " ", value or "").strip()

    @classmethod
    async def extract(
        cls,
        page: Page,
        raw_content: str,
        title: str,
        url: str,
        responses: list[dict[str, Any]],
    ) -> dict[str, Any]:
        button_entries = await page.locator(cls.BUTTON_SELECTOR).evaluate_all(
            """
            (elements) => elements.slice(0, 50).map((element) => ({
              text: (element.innerText || element.value || "").trim(),
              disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
              className: element.className || "",
              tagName: element.tagName || ""
            }))
            """
        )

        heading_entries = await page.locator(cls.HEADING_SELECTOR).evaluate_all(
            """
            (elements) => elements.slice(0, 12).map((element) => (element.innerText || "").trim())
            """
        )

        normalized_buttons: list[dict[str, Any]] = []
        seen_button_texts: set[str] = set()
        for entry in button_entries:
            text = cls.clean_text(entry.get("text", ""))
            if not text or text in seen_button_texts:
                continue
            seen_button_texts.add(text)
            normalized_buttons.append(
                {
                    "text": text,
                    "disabled": bool(entry.get("disabled")),
                    "class_name": cls.clean_text(str(entry.get("className", ""))),
                    "tag_name": cls.clean_text(str(entry.get("tagName", ""))).lower(),
                }
            )

        normalized_headings: list[str] = []
        seen_headings: set[str] = set()
        for heading in heading_entries:
            text = cls.clean_text(str(heading))
            if not text or text in seen_headings:
                continue
            seen_headings.add(text)
            normalized_headings.append(text)

        body_text = cls.clean_text(await page.locator("body").inner_text())
        excerpt_source = body_text or cls.clean_text(raw_content)
        raw_excerpt = excerpt_source[: settings.html_excerpt_max_chars]

        body_prices = cls.PRICE_PATTERN.findall(body_text)
        unique_prices: list[str] = []
        for price in body_prices:
            if price not in unique_prices:
                unique_prices.append(price)

        active_buttons = [item["text"] for item in normalized_buttons if not item["disabled"]]
        disabled_buttons = [item["text"] for item in normalized_buttons if item["disabled"]]
        primary_button = normalized_buttons[0]["text"] if normalized_buttons else ""
        primary_heading = normalized_headings[0] if normalized_headings else cls.clean_text(title)

        signals: list[str] = []
        signal_keywords = [
            "购买",
            "立即购买",
            "立即开通",
            "订阅",
            "申请",
            "限时",
            "倒计时",
            "库存",
            "售罄",
            "开售",
        ]
        for keyword in signal_keywords:
            if keyword in body_text and keyword not in signals:
                signals.append(keyword)

        available_keywords = ("购买", "立即", "开通", "订阅", "申请", "加入", "抢购")
        available = any(keyword in button for button in active_buttons for keyword in available_keywords)

        return {
            "title": cls.clean_text(title),
            "url": url,
            "available": available,
            "button_text": primary_button,
            "price_text": unique_prices[0] if unique_prices else "",
            "stock_text": "",
            "plan_name": primary_heading,
            "countdown_text": "",
            "signals": signals,
            "raw_excerpt": raw_excerpt,
            "raw_meta": {
                "title": cls.clean_text(title),
                "headings": normalized_headings[:8],
                "buttons": normalized_buttons[:12],
                "active_buttons": active_buttons[:8],
                "disabled_buttons": disabled_buttons[:8],
                "prices": unique_prices[:8],
                "responses": responses,
                "content_length": len(raw_content),
                "body_text_excerpt": body_text[:1500],
            },
        }
