from datetime import datetime


def utc_now() -> datetime:
    """统一时间工具，避免后续各处直接散落调用。"""
    return datetime.utcnow()

