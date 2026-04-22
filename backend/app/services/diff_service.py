from typing import Any


class DiffService:
    """快照差异计算服务。"""

    TRACKED_FIELDS = [
        "title",
        "available",
        "button_text",
        "price_text",
        "stock_text",
        "plan_name",
        "countdown_text",
    ]

    @classmethod
    def compare(cls, previous: dict[str, Any] | None, current: dict[str, Any]) -> dict[str, Any]:
        if not previous:
            return {
                "has_change": True,
                "changes": [{"field": "initial_snapshot", "before": None, "after": "created"}],
                "summary": "首次采集到该目标的页面快照",
                "opportunity_detected": bool(current.get("available")),
            }

        changes: list[dict[str, Any]] = []
        for field in cls.TRACKED_FIELDS:
            before = previous.get(field)
            after = current.get(field)
            if before != after:
                changes.append({"field": field, "before": before, "after": after})

        has_change = len(changes) > 0
        summary = cls._build_summary(changes) if has_change else "本次检查未发现关键字段变化"
        opportunity_detected = cls._is_opportunity(previous, current, changes)

        return {
            "has_change": has_change,
            "changes": changes,
            "summary": summary,
            "opportunity_detected": opportunity_detected,
        }

    @staticmethod
    def _build_summary(changes: list[dict[str, Any]]) -> str:
        field_labels = {
            "title": "标题",
            "available": "可用状态",
            "button_text": "按钮文案",
            "price_text": "价格",
            "stock_text": "库存",
            "plan_name": "套餐名称",
            "countdown_text": "倒计时",
            "initial_snapshot": "初始快照",
        }
        formatted = []
        for change in changes[:6]:
            field = change["field"]
            before = change["before"]
            after = change["after"]
            label = field_labels.get(field, field)
            before_text = DiffService._humanize_value(before)
            after_text = DiffService._humanize_value(after)
            if field == "initial_snapshot":
                formatted.append("首次建立页面快照")
            else:
                formatted.append(f"{label}由“{before_text}”变为“{after_text}”")
        return "；".join(formatted)

    @staticmethod
    def _humanize_value(value: Any) -> str:
        if value is True:
            return "可用"
        if value is False:
            return "不可用"
        if value in (None, ""):
            return "空"
        return str(value)

    @staticmethod
    def _is_opportunity(previous: dict[str, Any], current: dict[str, Any], changes: list[dict[str, Any]]) -> bool:
        if current.get("available") and not previous.get("available"):
            return True

        watched_fields = {"button_text", "stock_text", "countdown_text", "price_text"}
        for change in changes:
            if change["field"] in watched_fields and current.get("available"):
                return True

        return False
