import platform
import time
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter(prefix="/health", tags=["health"])

_start_time = time.time()


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    environment: str
    uptime_seconds: float
    timestamp: str
    python: str


class LivenessResponse(BaseModel):
    status: str


@router.get("", response_model=HealthResponse, summary="Full health check")
def health_check():
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        uptime_seconds=round(time.time() - _start_time, 2),
        timestamp=datetime.now(timezone.utc).isoformat(),
        python=platform.python_version(),
    )


@router.get("/live", response_model=LivenessResponse, summary="Liveness probe")
def liveness():
    return LivenessResponse(status="ok")


@router.get("/ready", response_model=LivenessResponse, summary="Readiness probe")
def readiness():
    # Expand later: check DB connection, external deps, etc.
    return LivenessResponse(status="ok")
