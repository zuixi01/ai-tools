import logging


def configure_logging(level: str = "INFO") -> None:
    """统一日志格式，便于后续接入 watcher、diff、告警日志。"""
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )

