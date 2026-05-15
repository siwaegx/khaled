"""
Semantic retriever — BM25-style ranking over stored memories.

No external ML dependencies required.

BM25 formula (simplified, k1=1.5, b=0.75):
    score(q, d) = Σ IDF(t) * (tf(t,d) * (k1+1)) / (tf(t,d) + k1*(1-b+b*|d|/avgdl))

We operate over the search_text field which has already been normalised
(lowercased, stop-words removed).

Additionally applies a recency boost: score *= exp(-age_hours / RECENCY_HALF_LIFE).
"""

import math
import re
from collections import Counter
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.memory.models import Memory
from app.memory.store import MemoryEntry, MemoryStore, _normalise

# BM25 tuning
_K1 = 1.5
_B = 0.75
_RECENCY_HALF_LIFE_HOURS = 168.0  # 1 week — actions older than this score half as much


# ---------------------------------------------------------------------------
# BM25 ranker
# ---------------------------------------------------------------------------

def _tokenise(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _bm25_score(query_tokens: list[str], doc_tokens: list[str],
                avg_dl: float, corpus_size: int,
                df: dict[str, int]) -> float:
    tf = Counter(doc_tokens)
    dl = len(doc_tokens)
    score = 0.0
    for t in query_tokens:
        if t not in tf:
            continue
        idf = math.log((corpus_size - df.get(t, 0) + 0.5) / (df.get(t, 0) + 0.5) + 1)
        tf_norm = (tf[t] * (_K1 + 1)) / (tf[t] + _K1 * (1 - _B + _B * dl / max(avg_dl, 1)))
        score += idf * tf_norm
    return score


def _recency_boost(created_at: datetime) -> float:
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_hours = (now - created_at).total_seconds() / 3600
    return math.exp(-age_hours / _RECENCY_HALF_LIFE_HOURS)


# ---------------------------------------------------------------------------
# Public retriever
# ---------------------------------------------------------------------------

class MemoryRetriever:
    def __init__(self, db: Session):
        self.db = db
        self.store = MemoryStore(db)

    def search(
        self,
        query: str,
        session_id: str | None = None,
        memory_types: list[str] | None = None,
        limit: int = 8,
        min_score: float = 0.05,
    ) -> list[tuple[MemoryEntry, float]]:
        """
        Retrieve the most relevant memories for a query using BM25 + recency boost.

        Returns list of (MemoryEntry, score) sorted by descending score.
        """
        # Fetch candidate corpus from DB
        q = self.db.query(Memory)
        if session_id:
            q = q.filter(Memory.session_id == session_id)
        if memory_types:
            q = q.filter(Memory.memory_type.in_(memory_types))
        candidates = q.order_by(Memory.created_at.desc()).limit(500).all()

        if not candidates:
            return []

        # Precompute corpus stats for BM25
        doc_tokens_list = [_tokenise(c.search_text or "") for c in candidates]
        avg_dl = sum(len(t) for t in doc_tokens_list) / len(doc_tokens_list)
        df: dict[str, int] = Counter()
        for tokens in doc_tokens_list:
            for t in set(tokens):
                df[t] += 1

        query_tokens = _tokenise(_normalise(query))
        if not query_tokens:
            return []

        scored: list[tuple[MemoryEntry, float]] = []
        for candidate, doc_tokens in zip(candidates, doc_tokens_list):
            bm25 = _bm25_score(query_tokens, doc_tokens, avg_dl, len(candidates), df)
            if bm25 < min_score:
                continue
            boost = _recency_boost(candidate.created_at)
            final = bm25 * (0.7 + 0.3 * boost)  # 30% recency weight
            scored.append((MemoryEntry.from_orm(candidate), final))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:limit]

    def build_context_block(
        self,
        query: str,
        session_id: str,
        max_messages: int = 10,
        max_relevant: int = 5,
    ) -> str:
        """
        Assemble the memory context string injected into the AI system prompt.

        Sections:
          1. Session summary (if exists)
          2. Relevant past actions + facts (BM25)
          3. Recent conversation messages
        """
        lines: list[str] = []

        # 1. Session summary
        summary = self.store.get_latest_summary(session_id)
        if summary:
            lines.append("### Session Summary")
            lines.append(summary.content)
            lines.append("")

        # 2. Relevant memories (cross-session facts + actions)
        relevant = self.search(
            query=query,
            memory_types=["action", "fact"],
            limit=max_relevant,
        )
        if relevant:
            lines.append("### Relevant Past Context")
            for entry, score in relevant:
                ts = entry.created_at.strftime("%Y-%m-%d %H:%M")
                tag = f"[{entry.memory_type.upper()}]"
                lines.append(f"{tag} ({ts}) {entry.content}")
            lines.append("")

        # 3. Recent conversation
        recent = self.store.get_recent_messages(session_id, limit=max_messages)
        if recent:
            lines.append("### Recent Conversation")
            for msg in recent:
                role_label = "User" if msg.role == "user" else "Assistant"
                # Truncate very long messages
                text = msg.content[:300] + "..." if len(msg.content) > 300 else msg.content
                lines.append(f"{role_label}: {text}")
            lines.append("")

        return "\n".join(lines)
