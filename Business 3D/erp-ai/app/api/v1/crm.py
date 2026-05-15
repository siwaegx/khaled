from fastapi import APIRouter

from app.modules.crm.router import router as crm_router

router = APIRouter(prefix="/crm", tags=["crm"])
router.include_router(crm_router)
