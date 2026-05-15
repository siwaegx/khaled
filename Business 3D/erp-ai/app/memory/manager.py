"""
MemoryManager — high-level API used by the AI runner and API layer.

Responsibilities:
  - Store every conversation turn and tool action
  - Auto-summarise sessions that grow beyond a threshold
  - Extract and store durable facts from AI responses
  - Provide context blocks for injection into Ollama prompts
"""

import json
import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.memory.retriever import MemoryRetriever
from app.memory.store import MemoryEntry, MemoryStore

logger = get_logger(__name__)

# Summarise after this many messages in a session
_SUMMARY_THRESHOLD = 30
_SUMMARY_KEEP_RECENT = 6  # messages to keep verbatim after summarising


# ---------------------------------------------------------------------------
# Fact extraction (rule-based — no LLM dependency)
# ---------------------------------------------------------------------------

_FACT_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"customer[s]?\s+(?:from|in|at)\s+([A-Za-z\s]+)", re.I), "location"),
    (re.compile(r"(?:company|organisation|org)\s+(?:is|called|named)\s+([A-Za-z\s&]+)", re.I), "company"),
    (re.compile(r"(?:email|e-mail)\s+(?:is\s+)?([\w.+-]+@[\w.-]+\.\w+)", re.I), "email"),
    (re.compile(r"(?:phone|tel|mobile)\s+(?:is\s+)?([\d\s+\-().]{7,20})", re.I), "phone"),
    (re.compile(r"(?:industry|sector|field)\s+(?:is\s+)?([A-Za-z\s]+?)(?:\.|,|$)", re.I), "industry"),
    (re.compile(r"(?:budget|value|worth)\s+(?:is\s+|of\s+)?\$?([\d,]+(?:\.\d+)?)", re.I), "value"),
]


def _extract_facts(text: str) -> list[str]:
    facts: list[str] = []
    for pattern, fact_type in _FACT_PATTERNS:
        for m in pattern.finditer(text):
            value = m.group(1).strip()
            if value and len(value) > 1:
                facts.append(f"{fact_type}: {value}")
    return list(dict.fromkeys(facts))  # deduplicate, preserve order


# ---------------------------------------------------------------------------
# MemoryManager
# ---------------------------------------------------------------------------

class MemoryManager:
    def __init__(self, db: Session):
        self.db = db
        self.store = MemoryStore(db)
        self.retriever = MemoryRetriever(db)

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def record_user_message(self, session_id: str, content: str) -> MemoryEntry:
        entry = self.store.add_message(session_id, "user", content)
        facts = _extract_facts(content)
        for fact in facts:
            self.store.add_fact(session_id, fact, tags=["auto_extracted"])
            logger.debug("fact_extracted", session=session_id, fact=fact)
        self._maybe_summarise(session_id)
        return entry

    def record_assistant_message(self, session_id: str, content: str) -> MemoryEntry:
        return self.store.add_message(session_id, "assistant", content)

    def record_action(
        self,
        session_id: str,
        tool_name: str,
        params: dict,
        result: dict,
        summary: str,
    ) -> MemoryEntry:
        # Tag with entity names for easier recall
        tags = [tool_name]
        for key in ("name", "email", "title", "query"):
            if key in params:
                tags.append(str(params[key])[:40])

        entry = self.store.add_action(
            session_id=session_id,
            tool_name=tool_name,
            params=params,
            result=result,
            summary=summary,
            tags=tags,
        )
        logger.info("memory_action_stored", session=session_id, tool=tool_name, id=entry.id)
        return entry

    def record_fact(self, session_id: str, content: str,
                    tags: list[str] | None = None) -> MemoryEntry:
        return self.store.add_fact(session_id, content, tags)

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def get_context_for_ai(self, query: str, session_id: str) -> str:
        """
        Build the memory context string to inject into the AI system prompt.
        Returns empty string if no relevant memories exist.
        """
        block = self.retriever.build_context_block(query=query, session_id=session_id)
        return block

    def get_ollama_messages(self, session_id: str, limit: int = 20) -> list[dict]:
        """
        Return recent messages as Ollama-compatible {role, content} dicts.
        Used to reconstruct conversation history for the LLM.
        """
        recent = self.store.get_recent_messages(session_id, limit=limit)
        return [{"role": m.role or "user", "content": m.content} for m in recent]

    def get_session_stats(self, session_id: str) -> dict:
        entries = self.store.get_all_for_session(session_id)
        return {
            "session_id": session_id,
            "total_entries": len(entries),
            "messages": sum(1 for e in entries if e.memory_type == "message"),
            "actions": sum(1 for e in entries if e.memory_type == "action"),
            "facts": sum(1 for e in entries if e.memory_type == "fact"),
            "summaries": sum(1 for e in entries if e.memory_type == "summary"),
        }

    def search(self, query: str, session_id: str | None = None,
               limit: int = 8) -> list[dict]:
        results = self.retriever.search(query=query, session_id=session_id, limit=limit)
        return [
            {
                "id": e.id,
                "session_id": e.session_id,
                "type": e.memory_type,
                "content": e.content,
                "tool_name": e.tool_name,
                "tags": e.tags,
                "created_at": e.created_at.isoformat(),
                "score": round(score, 4),
            }
            for e, score in results
        ]

    def clear_session(self, session_id: str) -> int:
        return self.store.delete_session(session_id)

    def list_sessions(self) -> list[str]:
        return self.store.get_all_sessions()

    # ------------------------------------------------------------------
    # Auto-summarise long sessions
    # ------------------------------------------------------------------

    def _maybe_summarise(self, session_id: str) -> None:
        count = self.store.count_messages(session_id)
        if count < _SUMMARY_THRESHOLD:
            return

        existing = self.store.get_latest_summary(session_id)
        recent = self.store.get_recent_messages(session_id, limit=_SUMMARY_THRESHOLD)
        # Don't re-summarise if the latest summary covers the current window
        if existing and len(recent) < _SUMMARY_THRESHOLD:
            return

        actions = self.store.get_recent_actions(session_id=session_id, limit=10)
        facts = self.store.get_facts(session_id=session_id)

        summary_lines = [f"Session '{session_id}' — auto-summary ({count} messages):"]
        if actions:
            summary_lines.append("Actions performed:")
            for a in actions[:8]:
                summary_lines.append(f"  • {a.content}")
        if facts:
            summary_lines.append("Known facts:")
            for f in facts[:8]:
                summary_lines.append(f"  • {f.content}")

        summary_text = "\n".join(summary_lines)
        self.store.add_summary(session_id, summary_text)
        logger.info("session_summarised", session=session_id, messages=count)
