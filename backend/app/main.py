from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.alert import router as alert_router
from app.api.dashboard import router as dashboard_router
from app.api.provider import router as provider_router
from app.api.run_record import router as run_record_router
from app.api.settings import router as settings_router
from app.api.target import router as target_router
from app.core.config import get_settings
from app.core.database import init_db
from app.core.logging import configure_logging
from app.core.scheduler import start_scheduler, stop_scheduler
from app.services.settings_service import SettingsService

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """应用启动与关闭时执行的生命周期逻辑。"""
    configure_logging(settings.log_level)
    init_db()
    SettingsService.load_overrides_into_runtime()
    if settings.scheduler_enabled:
        start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title=settings.project_name,
    version="0.1.0",
    description="GLM + 阿里云机会监控与人工确认平台",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz", tags=["system"])
def healthz():
    """最基础的健康检查，供 Phase 1 验证启动是否成功。"""
    return {
        "status": "ok",
        "project": settings.project_name,
        "environment": settings.project_env,
    }


app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(settings_router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(provider_router, prefix="/api/v1/providers", tags=["providers"])
app.include_router(target_router, prefix="/api/v1/targets", tags=["targets"])
app.include_router(run_record_router, prefix="/api/v1/runs", tags=["runs"])
app.include_router(alert_router, prefix="/api/v1/alerts", tags=["alerts"])
