from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.memory.manager import MemoryManager

router = APIRouter(prefix="/memory", tags=["memory"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class MemoryEntryOut(BaseModel):
    id: int
    session_id: str
    type: str
    role: str | None
    content: str
    tool_name: str | None
    tags: list[str]
    created_at: str
    score: float | None = None


class FactCreate(BaseModel):
    session_id: str = Field(..., examples=["user-123"])
    content: str = Field(..., examples=["Customer prefers RO systems for brackish water"])
    tags: list[str] = Field(default_factory=list)


class SessionStats(BaseModel):
    session_id: str
    total_entries: int
    messages: int
    actions: int
    facts: int
    summaries: int


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, examples=["water treatment customer Cairo"])
    session_id: str | None = None
    limit: int = Field(default=8, ge=1, le=50)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/sessions", response_model=list[str], summary="List all session IDs")
def list_sessions(db: Session = Depends(get_db)):
    return MemoryManager(db).list_sessions()


@router.get("/sessions/{session_id}", response_model=SessionStats, summary="Session memory stats")
def session_stats(session_id: str, db: Session = Depends(get_db)):
    return MemoryManager(db).get_session_stats(session_id)


@router.get("/sessions/{session_id}/messages",
            response_model=list[MemoryEntryOut], summary="Get conversation messages")
def get_messages(
    session_id: str,
    limit: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    store = MemoryManager(db).store
    entries = store.get_recent_messages(session_id, limit=limit)
    return [_to_out(e) for e in entries]


@router.get("/sessions/{session_id}/actions",
            response_model=list[MemoryEntryOut], summary="Get past tool actions")
def get_actions(
    session_id: str,
    tool_name: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    store = MemoryManager(db).store
    entries = store.get_recent_actions(session_id=session_id, tool_name=tool_name, limit=limit)
    return [_to_out(e) for e in entries]


@router.get("/sessions/{session_id}/facts",
            response_model=list[MemoryEntryOut], summary="Get stored facts")
def get_facts(session_id: str, db: Session = Depends(get_db)):
    entries = MemoryManager(db).store.get_facts(session_id=session_id)
    return [_to_out(e) for e in entries]


@router.post("/facts", response_model=MemoryEntryOut, status_code=201,
             summary="Manually store a fact")
def store_fact(body: FactCreate, db: Session = Depends(get_db)):
    entry = MemoryManager(db).record_fact(
        session_id=body.session_id,
        content=body.content,
        tags=body.tags,
    )
    return _to_out(entry)


@router.post("/search", response_model=list[MemoryEntryOut], summary="Semantic memory search")
def search_memory(body: SearchRequest, db: Session = Depends(get_db)):
    results = MemoryManager(db).search(
        query=body.query,
        session_id=body.session_id,
        limit=body.limit,
    )
    return [
        MemoryEntryOut(
            id=r["id"], session_id=r["session_id"], type=r["type"],
            role=None, content=r["content"], tool_name=r["tool_name"],
            tags=r["tags"], created_at=r["created_at"], score=r["score"],
        )
        for r in results
    ]


@router.get("/search", response_model=list[MemoryEntryOut], summary="Semantic search (GET)")
def search_memory_get(
    q: str = Query(..., min_length=1),
    session_id: str | None = Query(default=None),
    limit: int = Query(default=8, ge=1, le=50),
    db: Session = Depends(get_db),
):
    results = MemoryManager(db).search(query=q, session_id=session_id, limit=limit)
    return [
        MemoryEntryOut(
            id=r["id"], session_id=r["session_id"], type=r["type"],
            role=None, content=r["content"], tool_name=r["tool_name"],
            tags=r["tags"], created_at=r["created_at"], score=r["score"],
        )
        for r in results
    ]


@router.delete("/sessions/{session_id}", status_code=204, summary="Delete all memory for a session")
def delete_session_memory(session_id: str, db: Session = Depends(get_db)):
    MemoryManager(db).clear_session(session_id)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _to_out(e) -> MemoryEntryOut:
    return MemoryEntryOut(
        id=e.id,
        session_id=e.session_id,
        type=e.memory_type,
        role=e.role,
        content=e.content,
        tool_name=e.tool_name,
        tags=e.tags,
        created_at=e.created_at.isoformat(),
    )
