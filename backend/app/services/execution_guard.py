from collections import deque
from datetime import datetime, timedelta

from app.core.config import get_settings
from app.models.target import Target

settings = get_settings()


class ExecutionGuard:
    """执行保护器。

    用于限制全局并发、每分钟执行次数，以及单个 target 的最小执行间隔。
    """

    _active_runs = 0
    _run_started_at: deque[datetime] = deque()
    _active_target_ids: set[int] = set()

    @classmethod
    def acquire_slot(cls, target_id: int | None = None) -> None:
        cls._prune_old_records()
        if cls._active_runs >= settings.max_concurrent_watchers:
            raise RuntimeError("Global concurrency limit reached")
        if len(cls._run_started_at) >= settings.global_rate_limit_per_minute:
            raise RuntimeError("Global rate limit per minute reached")

        cls._active_runs += 1
        cls._run_started_at.append(datetime.utcnow())
        if target_id is not None:
            cls._active_target_ids.add(target_id)

    @classmethod
    def release_slot(cls, target_id: int | None = None) -> None:
        cls._active_runs = max(0, cls._active_runs - 1)
        if target_id is not None:
            cls._active_target_ids.discard(target_id)

    @classmethod
    def assert_target_can_run(cls, target: Target) -> None:
        if not target.enabled:
            raise RuntimeError("Target is disabled")

        if target.last_status == "running":
            raise RuntimeError("Target is already running")

        if settings.enforce_target_poll_interval and target.last_checked_at:
            next_allowed_at = target.last_checked_at + timedelta(seconds=target.poll_interval_seconds)
            if datetime.utcnow() < next_allowed_at:
                remaining = int((next_allowed_at - datetime.utcnow()).total_seconds())
                raise RuntimeError(f"Target poll interval not reached, retry after {remaining}s")

    @classmethod
    def _prune_old_records(cls) -> None:
        cutoff = datetime.utcnow() - timedelta(minutes=1)
        while cls._run_started_at and cls._run_started_at[0] < cutoff:
            cls._run_started_at.popleft()

    @classmethod
    def snapshot(cls) -> dict:
        cls._prune_old_records()
        return {
            "active_runs": cls._active_runs,
            "active_target_ids": sorted(cls._active_target_ids),
            "runs_started_last_minute": len(cls._run_started_at),
        }
