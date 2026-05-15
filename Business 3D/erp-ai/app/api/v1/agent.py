from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.agent.ai_runner import clear_session, run_ai
from app.agent.registry import registry
from app.agent.runner import run as rules_run
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.ollama import OllamaUnavailable, get_ollama
from app.db.database import get_db

router = APIRouter(prefix="/agent", tags=["agent"])
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AgentRequest(BaseModel):
    command: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        examples=[
            "Create a customer named Nile Water Co, email info@nilewater.com",
            "Find customer acme",
            "List all customers",
            "Create a deal called RO Plant Upgrade for customer 1 worth 120000",
            "Design a CRM for a water treatment company in Egypt",
            "What deals do we have in the proposal stage?",
        ],
    )
    session_id: str = Field(
        default="default",
        description="Conversation session ID — keeps multi-turn memory.",
    )
    use_ai: bool = Field(
        default=True,
        description="Use Ollama AI (true) or rule-based parser (false).",
    )


class AgentResponse(BaseModel):
    status: str
    tool: str | None
    params: dict[str, Any]
    result: dict[str, Any] | None
    message: str
    confidence: float
    engine: str   # "ai" | "rules" | "ai_fallback"


class ToolInfo(BaseModel):
    name: str
    description: str
    params: list[str]
    required: list[str]


class OllamaStatus(BaseModel):
    available: bool
    model: str
    models: list[str]
    message: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/run", response_model=AgentResponse, summary="Run an agent command")
def agent_run(body: AgentRequest, db: Session = Depends(get_db)) -> AgentResponse:
    logger.info("agent_command", engine="ai" if body.use_ai else "rules",
                session=body.session_id, command=body.command[:120])

    if body.use_ai:
        result = run_ai(command=body.command, db=db, session_id=body.session_id)
        engine = "ai_fallback" if result.message.startswith("[rule-based fallback]") else "ai"
    else:
        result = rules_run(command=body.command, db=db)
        engine = "rules"

    logger.info("agent_result", tool=result.tool, status=result.status, engine=engine)
    return AgentResponse(
        status=result.status,
        tool=result.tool,
        params=result.params,
        result=result.result,
        message=result.message,
        confidence=result.confidence,
        engine=engine,
    )


@router.delete("/session/{session_id}", status_code=204, summary="Clear conversation history")
def clear_conversation(session_id: str, db: Session = Depends(get_db)):
    clear_session(session_id, db)


@router.get("/tools", response_model=list[ToolInfo], summary="List available tools")
def agent_tools() -> list[ToolInfo]:
    return [
        ToolInfo(name=t.name, description=t.description,
                 params=t.params, required=t.required)
        for t in registry.all()
    ]


@router.get("/ollama", response_model=OllamaStatus, summary="Ollama health & model info")
def ollama_status() -> OllamaStatus:
    settings = get_settings()
    try:
        info = get_ollama().health()
        return OllamaStatus(
            available=True,
            model=settings.OLLAMA_MODEL,
            models=info["models"],
            message=f"Ollama is running. Active model: {settings.OLLAMA_MODEL}",
        )
    except OllamaUnavailable as e:
        return OllamaStatus(
            available=False,
            model=settings.OLLAMA_MODEL,
            models=[],
            message=str(e),
        )
