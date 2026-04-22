import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.provider import Provider
from app.models.target import Target
from app.schemas.target import TargetCreate, TargetListResponse, TargetRead, TargetUpdate
from app.services.settings_service import SettingsService

router = APIRouter()


def _ensure_provider_exists(session: Session, provider_id: int) -> Provider:
    provider = session.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider does not exist")
    return provider


def _get_provider_default_poll_interval_seconds(provider: Provider) -> int | None:
    try:
        config = json.loads(provider.config_json or "{}")
    except json.JSONDecodeError:
        return None

    value = config.get("default_poll_interval_seconds")
    if not isinstance(value, int) or isinstance(value, bool):
        return None
    if value < 10 or value > 3600:
        return None
    return value


def _get_poll_interval_source(
    target: Target,
    provider: Provider | None,
    global_default_poll_interval_seconds: int,
) -> str:
    provider_default = _get_provider_default_poll_interval_seconds(provider) if provider else None
    inherited_default = (
        provider_default if provider_default is not None else global_default_poll_interval_seconds
    )

    if target.poll_interval_seconds == inherited_default:
        if provider_default is not None:
            return "provider"
        return "global"

    return "custom"


def _build_target_read(target: Target, provider: Provider | None) -> TargetRead:
    runtime_settings = SettingsService.get_runtime_settings()
    provider_default_poll_interval_seconds = (
        _get_provider_default_poll_interval_seconds(provider) if provider else None
    )
    return TargetRead(
        id=target.id or 0,
        provider_id=target.provider_id,
        provider_name=provider.name if provider else None,
        provider_type=provider.type if provider else None,
        name=target.name,
        url=target.url,
        mode=target.mode,
        poll_interval_seconds=target.poll_interval_seconds,
        provider_default_poll_interval_seconds=provider_default_poll_interval_seconds,
        effective_poll_interval_seconds=target.poll_interval_seconds,
        poll_interval_source=_get_poll_interval_source(
            target,
            provider,
            runtime_settings.default_poll_interval_seconds,
        ),
        enabled=target.enabled,
        last_status=target.last_status,
        last_checked_at=target.last_checked_at,
        last_run_started_at=target.last_run_started_at,
        created_at=target.created_at,
        updated_at=target.updated_at,
    )


@router.get("", response_model=TargetListResponse)
def list_targets(
    enabled: bool | None = Query(default=None),
    provider_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
):
    statement = select(Target).order_by(Target.updated_at.desc())
    if enabled is not None:
        statement = statement.where(Target.enabled == enabled)
    if provider_id is not None:
        statement = statement.where(Target.provider_id == provider_id)

    targets = session.exec(statement).all()
    provider_ids = {target.provider_id for target in targets}
    providers = {
        provider.id: provider
        for provider in session.exec(select(Provider).where(Provider.id.in_(provider_ids))).all()
    } if provider_ids else {}

    return TargetListResponse(
        items=[_build_target_read(target, providers.get(target.provider_id)) for target in targets],
        total=len(targets),
    )


@router.get("/{target_id}", response_model=TargetRead)
def get_target(target_id: int, session: Session = Depends(get_session)):
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

    provider = session.get(Provider, target.provider_id)
    return _build_target_read(target, provider)


@router.post("", response_model=TargetRead, status_code=status.HTTP_201_CREATED)
def create_target(payload: TargetCreate, session: Session = Depends(get_session)):
    provider = _ensure_provider_exists(session, payload.provider_id)
    runtime_settings = SettingsService.get_runtime_settings()
    provider_default_poll_interval_seconds = _get_provider_default_poll_interval_seconds(provider)
    poll_interval_seconds = (
        payload.poll_interval_seconds
        if payload.poll_interval_seconds is not None
        else (
            provider_default_poll_interval_seconds
            if provider_default_poll_interval_seconds is not None
            else runtime_settings.default_poll_interval_seconds
        )
    )

    target = Target(
        provider_id=payload.provider_id,
        name=payload.name,
        url=str(payload.url),
        mode=payload.mode,
        poll_interval_seconds=poll_interval_seconds,
        enabled=payload.enabled,
        last_status=payload.last_status,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(target)
    session.commit()
    session.refresh(target)
    return _build_target_read(target, provider)


@router.put("/{target_id}", response_model=TargetRead)
def update_target(target_id: int, payload: TargetUpdate, session: Session = Depends(get_session)):
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

    data = payload.model_dump(exclude_unset=True)
    if "provider_id" in data:
        _ensure_provider_exists(session, data["provider_id"])

    for key, value in data.items():
        if key == "url" and value is not None:
            setattr(target, key, str(value))
        else:
            setattr(target, key, value)

    target.updated_at = datetime.utcnow()
    session.add(target)
    session.commit()
    session.refresh(target)

    provider = session.get(Provider, target.provider_id)
    return _build_target_read(target, provider)


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_target(target_id: int, session: Session = Depends(get_session)):
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

    session.delete(target)
    session.commit()


@router.post("/{target_id}/enable", response_model=TargetRead)
def enable_target(target_id: int, session: Session = Depends(get_session)):
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

    target.enabled = True
    target.last_status = "enabled"
    target.updated_at = datetime.utcnow()
    session.add(target)
    session.commit()
    session.refresh(target)

    provider = session.get(Provider, target.provider_id)
    return _build_target_read(target, provider)


@router.post("/{target_id}/disable", response_model=TargetRead)
def disable_target(target_id: int, session: Session = Depends(get_session)):
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

    target.enabled = False
    target.last_status = "disabled"
    target.updated_at = datetime.utcnow()
    session.add(target)
    session.commit()
    session.refresh(target)

    provider = session.get(Provider, target.provider_id)
    return _build_target_read(target, provider)
