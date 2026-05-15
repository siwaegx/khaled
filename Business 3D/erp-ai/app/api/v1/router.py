from fastapi import APIRouter

from app.api.v1 import agent, chat, crm, crm_designer, governance, health, memory

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(chat.router)
api_router.include_router(crm.router)
api_router.include_router(crm_designer.router)
api_router.include_router(agent.router)
api_router.include_router(memory.router)
api_router.include_router(governance.router)
