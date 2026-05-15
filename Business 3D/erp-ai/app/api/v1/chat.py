from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.chat import handle_message
from app.core.logging import get_logger

router = APIRouter(prefix="/chat", tags=["chat"])
logger = get_logger(__name__)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000, examples=["Design an RO system for 100 m3/day, TDS 3000 ppm"])
    params: dict[str, Any] | None = Field(
        default=None,
        description="Optional structured parameters (flow_rate, tds). "
                    "Overrides values parsed from the message.",
        examples=[{"flow_rate": 100, "tds": 3000}],
    )


class ChatResponseBody(BaseModel):
    intent: str
    message: str
    data: dict[str, Any] | None = None


@router.post("", response_model=ChatResponseBody, summary="Rule-based AI chat")
def chat(body: ChatRequest) -> ChatResponseBody:
    logger.info("chat_request", intent_pending=True, message_preview=body.message[:80])
    result = handle_message(message=body.message, params=body.params or {})
    logger.info("chat_response", intent=result.intent)
    return ChatResponseBody(intent=result.intent, message=result.message, data=result.data)
