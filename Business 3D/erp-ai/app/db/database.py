from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _make_engine():
    settings = get_settings()
    kwargs = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
    return create_engine(settings.DATABASE_URL, connect_args=kwargs)


engine = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.db import models              # noqa: F401
    from app.memory import models as _m   # noqa: F401
    from app.governance import models as _g  # noqa: F401
    Base.metadata.create_all(bind=engine)
