"""
MemoryStore — raw CRUD for the memories table.

All methods are synchronous (matching the existing SQLAlchemy sync setup).
"""

import json
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.memory.models import Memory


# ---------------------------------------------------------------------------
# Stop-words for search normalisation
# ---------------------------------------------------------------------------

_STOP = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "i", "my", "we", "our", "you", "your", "it", "its", "this", "that",
    "do", "did", "has", "have", "had", "can", "will", "would", "could",
    "should", "may", "might", "not", "no", "so", "if", "me", "him", "her",
})


def _normalise(text: str) -> str:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return " ".join(t for t in tokens if t not in _STOP)


# ---------------------------------------------------------------------------
# Dataclass returned to callers
# ---------------------------------------------------------------------------

@dataclass
class MemoryEntry:
    id: int
    session_id: str
    memory_type: str
    role: str | None
    content: str
    tool_name: str | None
    tool_params: dict | None
    tool_result: dict | None
    tags: list[str]
    created_at: datetime

    @classmethod
    def from_orm(cls, m: Memory) -> "MemoryEntry":
        return cls(
            id=m.id,
            session_id=m.session_id,
            memory_type=m.memory_type,
            role=m.role,
            content=m.content,
            tool_name=m.tool_name,
            tool_params=_try_json(m.tool_params),
            tool_result=_try_json(m.tool_result),
            tags=[t.strip() for t in (m.tags or "").split(",") if t.strip()],
            created_at=m.created_at,
        )


def _try_json(s: str | None) -> dict | None:
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------

class MemoryStore:
    def __init__(self, db: Session):
        self.db = db

    # --- write ---

    def add_message(self, session_id: str, role: str, content: str,
                    tags: list[str] | None = None) -> MemoryEntry:
        obj = Memory(
            session_id=session_id,
            memory_type="message",
            role=role,
            content=content,
            search_text=_normalise(content),
            tags=",".join(tags or []),
        )
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return MemoryEntry.from_orm(obj)

    def add_action(self, session_id: str, tool_name: str,
                   params: dict, result: dict, summary: str,
                   tags: list[str] | None = None) -> MemoryEntry:
        search_parts = [tool_name, summary, " ".join(str(v) for v in params.values())]
        obj = Memory(
            session_id=session_id,
            memory_type="action",
            role="system",
            content=summary,
            tool_name=tool_name,
            tool_params=json.dumps(params),
            tool_result=json.dumps(result),
            search_text=_normalise(" ".join(search_parts)),
            tags=",".join(tags or [tool_name]),
        )
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return MemoryEntry.from_orm(obj)

    def add_fact(self, session_id: str, content: str,
                 tags: list[str] | None = None) -> MemoryEntry:
        obj = Memory(
            session_id=session_id,
            memory_type="fact",
            role=None,
            content=content,
            search_text=_normalise(content),
            tags=",".join(tags or []),
        )
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return MemoryEntry.from_orm(obj)

    def add_summary(self, session_id: str, content: str) -> MemoryEntry:
        obj = Memory(
            session_id=session_id,
            memory_type="summary",
            role=None,
            content=content,
            search_text=_normalise(content),
            tags="summary",
        )
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return MemoryEntry.from_orm(obj)

    # --- read ---

    def get_recent_messages(self, session_id: str, limit: int = 20) -> list[MemoryEntry]:
        rows = (
            self.db.query(Memory)
            .filter(Memory.session_id == session_id, Memory.memory_type == "message")
            .order_by(desc(Memory.created_at))
            .limit(limit)
            .all()
        )
        return [MemoryEntry.from_orm(r) for r in reversed(rows)]

    def get_recent_actions(self, session_id: str | None = None,
                           tool_name: str | None = None,
                           limit: int = 10) -> list[MemoryEntry]:
        q = self.db.query(Memory).filter(Memory.memory_type == "action")
        if session_id:
            q = q.filter(Memory.session_id == session_id)
        if tool_name:
            q = q.filter(Memory.tool_name == tool_name)
        rows = q.order_by(desc(Memory.created_at)).limit(limit).all()
        return [MemoryEntry.from_orm(r) for r in rows]

    def get_facts(self, session_id: str | None = None) -> list[MemoryEntry]:
        q = self.db.query(Memory).filter(Memory.memory_type == "fact")
        if session_id:
            q = q.filter(Memory.session_id == session_id)
        return [MemoryEntry.from_orm(r) for r in q.order_by(desc(Memory.created_at)).limit(50).all()]

    def get_latest_summary(self, session_id: str) -> MemoryEntry | None:
        row = (
            self.db.query(Memory)
            .filter(Memory.session_id == session_id, Memory.memory_type == "summary")
            .order_by(desc(Memory.created_at))
            .first()
        )
        return MemoryEntry.from_orm(row) if row else None

    def count_messages(self, session_id: str) -> int:
        return (
            self.db.query(func.count(Memory.id))
            .filter(Memory.session_id == session_id, Memory.memory_type == "message")
            .scalar() or 0
        )

    def get_all_for_session(self, session_id: str) -> list[MemoryEntry]:
        rows = (
            self.db.query(Memory)
            .filter(Memory.session_id == session_id)
            .order_by(Memory.created_at)
            .all()
        )
        return [MemoryEntry.from_orm(r) for r in rows]

    def delete_session(self, session_id: str) -> int:
        deleted = (
            self.db.query(Memory)
            .filter(Memory.session_id == session_id)
            .delete()
        )
        self.db.commit()
        return deleted

    def get_all_sessions(self) -> list[str]:
        rows = (
            self.db.query(Memory.session_id)
            .distinct()
            .order_by(Memory.session_id)
            .all()
        )
        return [r[0] for r in rows]

    def search_raw(self, memory_type: str | None = None,
                   session_id: str | None = None,
                   limit: int = 100) -> list[MemoryEntry]:
        q = self.db.query(Memory)
        if memory_type:
            q = q.filter(Memory.memory_type == memory_type)
        if session_id:
            q = q.filter(Memory.session_id == session_id)
        rows = q.order_by(desc(Memory.created_at)).limit(limit).all()
        return [MemoryEntry.from_orm(r) for r in rows]
