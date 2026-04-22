from typing import Any

from app.providers.base import BaseProviderAdapter


class AliyunProviderAdapter(BaseProviderAdapter):
    provider_type = "aliyun"

    BUTTON_KEYWORDS = ("立即购买", "立即开通", "购买", "开通", "立即申请", "申请试用", "咨询")
    COUNTDOWN_PATTERNS = [
        r"\d{1,2}:\d{2}:\d{2}",
        r"(?:距离结束|倒计时|距开始|距结束)\s*[:：]?\s*[^ ]+",
        r"\d+\s*(?:天|小时|分钟|秒)",
    ]
    STOCK_PATTERNS = [
        r"(?:库存|余量|剩余)\s*[:：]?\s*\d+",
        r"售罄",
        r"活动结束",
    ]

    def parse(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw_meta = payload.get("raw_meta", {})
        body_text = self.clean_text(str(raw_meta.get("body_text_excerpt", "")))
        title = self.pick_title(payload)
        button_text, button_clickable = self.pick_button(payload, self.BUTTON_KEYWORDS)
        price_text = self.pick_price(payload)
        countdown_text = self.pick_countdown(payload, self.COUNTDOWN_PATTERNS)
        stock_text = self.pick_stock(payload, self.STOCK_PATTERNS)

        signals = list(payload.get("signals", []))
        if "aliyun" not in signals:
            signals.append("aliyun")
        if button_clickable and "button-clickable" not in signals:
            signals.append("button-clickable")
        if not button_clickable and button_text and "button-disabled" not in signals:
            signals.append("button-disabled")
        if price_text and "price-detected" not in signals:
            signals.append("price-detected")

        plan_name = payload.get("plan_name") or title
        available = button_clickable and any(
            keyword in button_text for keyword in ("购买", "开通", "申请", "试用")
        )
        if stock_text in {"售罄", "活动结束"}:
            available = False
        if countdown_text and "countdown-detected" not in signals:
            signals.append("countdown-detected")
        if stock_text and "stock-detected" not in signals:
            signals.append("stock-detected")

        return self.merge_result(
            payload,
            title=title,
            available=available,
            button_text=button_text,
            price_text=price_text,
            stock_text=stock_text,
            plan_name=self.clean_text(str(plan_name)),
            countdown_text=countdown_text,
            signals=signals,
            extra_meta={
                "provider_type": self.provider_type,
                "button_clickable": button_clickable,
            },
        )
