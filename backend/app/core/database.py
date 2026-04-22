from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings
from app.models import alert, app_setting, provider, run_record, snapshot, target  # noqa: F401

settings = get_settings()

# 提前创建 SQLite 目录，保证 Phase 1 首次启动即可建库。
db_path = settings.database_url.replace("sqlite:///", "")
if db_path.startswith("./"):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.database_url, echo=False, connect_args={"check_same_thread": False})


def init_db() -> None:
    """初始化数据库表结构。Phase 1 先让元数据流程跑通。"""
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
