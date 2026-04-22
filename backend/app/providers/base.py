import re
from abc import ABC, abstractmethod
from typing import Any


class BaseProviderAdapter(ABC):
    """Provider 适配器基类。

    各平台都输出统一 parsed 结构，上层只关心监控结果，不关心站点细节。
    """

    provider_type: str = "base"

    PRICE_PATTERN = re.compile(r"(?:¥|￥|RMB\s?|USD\s?\$|\$)\s?\d+(?:[.,]\d{1,2})?")
    COUNTDOWN_PATTERNS = [
        r"\d{1,2}:\d{2}:\d{2}",
        r"\d+\s*(?:天|小时|分钟|秒)",
        r"(?:距离结束|倒计时)\s*[:：]?\s*[^ ]+",
    ]
    STOCK_PATTERNS = [
        r"(?:库存|余量|剩余)\s*[:：]?\s*\d+",
        r"售罄",
        r"活动结束",
        r"已售罄",
        r"缺货",
    ]

    @staticmethod
    def clean_text(value: str) -> str:
        return re.sub(r"\s+", " ", value or "").strip()

    @classmethod
    def find_first_match(cls, text: str, patterns: list[str]) -> str:
        cleaned = cls.clean_text(text)
        for pattern in patterns:
            match = re.search(pattern, cleaned, re.IGNORECASE)
            if match:
                return cls.clean_text(match.group(0))
        return ""

    @classmethod
    def pick_price(cls, payload: dict[str, Any]) -> str:
        raw_meta = payload.get("raw_meta", {})
        prices = raw_meta.get("prices", [])
        if prices:
            return cls.clean_text(str(prices[0]))

        body_text = cls.clean_text(str(raw_meta.get("body_text_excerpt", "")))
        match = cls.PRICE_PATTERN.search(body_text)
        return cls.clean_text(match.group(0)) if match else ""

    @classmethod
    def pick_countdown(cls, payload: dict[str, Any], patterns: list[str] | None = None) -> str:
        raw_meta = payload.get("raw_meta", {})
        body_text = cls.clean_text(str(raw_meta.get("body_text_excerpt", "")))
        return cls.find_first_match(body_text, patterns or cls.COUNTDOWN_PATTERNS)

    @classmethod
    def pick_stock(cls, payload: dict[str, Any], patterns: list[str] | None = None) -> str:
        raw_meta = payload.get("raw_meta", {})
        body_text = cls.clean_text(str(raw_meta.get("body_text_excerpt", "")))
        return cls.find_first_match(body_text, patterns or cls.STOCK_PATTERNS)

    @classmethod
    def pick_button(cls, payload: dict[str, Any], keywords: tuple[str, ...]) -> tuple[str, bool]:
        raw_meta = payload.get("raw_meta", {})
        buttons = raw_meta.get("buttons", [])

        for keyword in keywords:
            for button in buttons:
                text = cls.clean_text(str(button.get("text", "")))
                if keyword in text:
                    return text, not bool(button.get("disabled"))

        if buttons:
            fallback = buttons[0]
            return cls.clean_text(str(fallback.get("text", ""))), not bool(fallback.get("disabled"))

        return cls.clean_text(payload.get("button_text", "")), bool(payload.get("available", False))

    @classmethod
    def pick_title(cls, payload: dict[str, Any]) -> str:
        raw_meta = payload.get("raw_meta", {})
        headings = raw_meta.get("headings", [])
        if headings:
            return cls.clean_text(str(headings[0]))
        return cls.clean_text(str(payload.get("title", "")))

    @classmethod
    def merge_result(cls, payload: dict[str, Any], *, title: str, available: bool, button_text: str, price_text: str, plan_name: str, stock_text: str = "", countdown_text: str = "", signals: list[str] | None = None, extra_meta: dict[str, Any] | None = None) -> dict[str, Any]:
        raw_meta = dict(payload.get("raw_meta", {}))
        if extra_meta:
            raw_meta.update(extra_meta)

        return {
            "title": title,
            "url": payload.get("url", ""),
            "available": available,
            "button_text": button_text,
            "price_text": price_text,
            "stock_text": stock_text,
            "plan_name": plan_name,
            "countdown_text": countdown_text,
            "signals": signals or payload.get("signals", []),
            "raw_meta": raw_meta,
            "raw_excerpt": payload.get("raw_excerpt", ""),
        }

    @abstractmethod
    def parse(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError
