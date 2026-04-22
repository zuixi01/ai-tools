import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.run_record import RunRecord
from app.models.snapshot import Snapshot
from app.models.target import Target
from app.schemas.run_record import RunExecutionResponse, RunRecordListResponse, RunRecordRead
from app.services.watcher_service import WatcherService

router = APIRouter()


def _build_run_read(run: RunRecord, target: Target | None, snapshot: Snapshot | None) -> RunRecordRead:
    snapshot_payload = json.loads(snapshot.parsed_json) if snapshot and snapshot.parsed_json else None
    parsed_summary = None
    diff_summary = None
    if run.summary:
        try:
            parsed_summary = json.loads(run.summary)
            diff_summary = parsed_summary.get("diff_summary")
        except json.JSONDecodeError:
            parsed_summary = None

    return RunRecordRead(
        id=run.id or 0,
        target_id=run.target_id,
        target_name=target.name if target else None,
        target_url=target.url if target else None,
        status=run.status,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_ms=run.duration_ms,
        has_change=run.has_change,
        summary=run.summary,
        diff_summary=diff_summary,
        error_message=run.error_message,
        screenshot_path=snapshot.screenshot_path if snapshot else None,
        snapshot=snapshot_payload or parsed_summary,
    )


@router.get("", response_model=RunRecordListResponse)
def list_runs(
    since_hours: int | None = Query(default=None, ge=1, le=24 * 90),
    provider_id: int | None = Query(default=None, ge=1),
    target_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    statement = select(RunRecord).order_by(RunRecord.started_at.desc())
    if since_hours is not None:
        since_at = datetime.now(timezone.utc) - timedelta(hours=since_hours)
        statement = statement.where(RunRecord.started_at >= since_at)
    if target_id is not None:
        statement = statement.where(RunRecord.target_id == target_id)
    elif provider_id is not None:
        provider_target_ids = session.exec(
            select(Target.id).where(Target.provider_id == provider_id)
        ).all()
        if not provider_target_ids:
            return RunRecordListResponse(items=[], total=0)
        statement = statement.where(RunRecord.target_id.in_(provider_target_ids))

    runs = session.exec(statement).all()[:limit]
    target_ids = {run.target_id for run in runs}
    targets = {
        target.id: target for target in session.exec(select(Target).where(Target.id.in_(target_ids))).all()
    } if target_ids else {}

    snapshots = {}
    for run in runs:
        snapshot = session.exec(
            select(Snapshot)
            .where(Snapshot.run_record_id == run.id)
            .order_by(Snapshot.created_at.desc())
        ).first()
        if snapshot:
            snapshots[run.id] = snapshot

    return RunRecordListResponse(
        items=[_build_run_read(run, targets.get(run.target_id), snapshots.get(run.id)) for run in runs],
        total=len(runs),
    )


@router.post("/targets/{target_id}/execute", response_model=RunExecutionResponse, status_code=status.HTTP_201_CREATED)
async def execute_target_run(target_id: int, session: Session = Depends(get_session)):
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

    try:
        result = await WatcherService.execute_target(session, target_id)
        return RunExecutionResponse(**result)
    except Exception as exc:
        detail = str(exc)
        if any(
            marker in detail
            for marker in [
                "disabled",
                "already running",
                "poll interval not reached",
                "concurrency limit",
                "rate limit",
            ]
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc
