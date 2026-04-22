import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.provider import Provider
from app.models.target import Target
from app.schemas.provider import ProviderCreate, ProviderListResponse, ProviderRead, ProviderUpdate

router = APIRouter()


def _build_provider_read(provider: Provider, target_count: int = 0) -> ProviderRead:
    return ProviderRead(
        id=provider.id or 0,
        name=provider.name,
        type=provider.type,
        enabled=provider.enabled,
        config_json=json.loads(provider.config_json or "{}"),
        target_count=target_count,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


@router.get("", response_model=ProviderListResponse)
def list_providers(
    enabled: bool | None = Query(default=None),
    session: Session = Depends(get_session),
):
    statement = select(Provider).order_by(Provider.updated_at.desc())
    if enabled is not None:
        statement = statement.where(Provider.enabled == enabled)

    providers = session.exec(statement).all()
    target_counts = {
        provider_id: count
        for provider_id, count in (
            (provider.id, len(session.exec(select(Target).where(Target.provider_id == provider.id)).all()))
            for provider in providers
        )
    }

    return ProviderListResponse(
        items=[_build_provider_read(provider, target_counts.get(provider.id, 0)) for provider in providers],
        total=len(providers),
    )


@router.get("/{provider_id}", response_model=ProviderRead)
def get_provider(provider_id: int, session: Session = Depends(get_session)):
    provider = session.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    target_count = len(session.exec(select(Target).where(Target.provider_id == provider_id)).all())
    return _build_provider_read(provider, target_count)


@router.post("", response_model=ProviderRead, status_code=status.HTTP_201_CREATED)
def create_provider(payload: ProviderCreate, session: Session = Depends(get_session)):
    provider = Provider(
        name=payload.name,
        type=payload.type,
        enabled=payload.enabled,
        config_json=json.dumps(payload.config_json, ensure_ascii=False),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(provider)
    session.commit()
    session.refresh(provider)
    return _build_provider_read(provider, 0)


@router.put("/{provider_id}", response_model=ProviderRead)
def update_provider(provider_id: int, payload: ProviderUpdate, session: Session = Depends(get_session)):
    provider = session.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key == "config_json":
            setattr(provider, key, json.dumps(value, ensure_ascii=False))
        else:
            setattr(provider, key, value)

    provider.updated_at = datetime.utcnow()
    session.add(provider)
    session.commit()
    session.refresh(provider)

    target_count = len(session.exec(select(Target).where(Target.provider_id == provider_id)).all())
    return _build_provider_read(provider, target_count)


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_provider(provider_id: int, session: Session = Depends(get_session)):
    provider = session.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    has_targets = session.exec(select(Target).where(Target.provider_id == provider_id)).first()
    if has_targets:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Provider still has targets. Delete targets first.",
        )

    session.delete(provider)
    session.commit()
