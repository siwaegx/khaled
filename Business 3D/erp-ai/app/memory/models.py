"""
SQLAlchemy models for the memory system.

Memory types:
  message  — one conversation turn (user or assistant)
  action   — a tool call that was executed, with params and result
  fact     — a durable fact extracted from the conversation
  summary  — a compressed summary of a session segment
"""

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    session_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    memory_type: Mapped[str] = mapped_column(String(32), nullable=False)   # message|action|fact|summary
    role: Mapped[str | None] = mapped_column(String(32))                   # user|assistant|system (messages only)

    content: Mapped[str] = mapped_column(Text, nullable=False)             # human-readable text
    tool_name: Mapped[str | None] = mapped_column(String(128))             # set for action memories
    tool_params: Mapped[str | None] = mapped_column(Text)                  # JSON string
    tool_result: Mapped[str | None] = mapped_column(Text)                  # JSON string
    tags: Mapped[str | None] = mapped_column(String(512))                  # comma-separated labels

    # Normalised search text — lowercase, stopwords removed
    search_text: Mapped[str] = mapped_column(Text, nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_memories_session_type", "session_id", "memory_type"),
        Index("ix_memories_tool",         "tool_name"),
    )

    def __repr__(self) -> str:
        return f"<Memory id={self.id} type={self.memory_type} session={self.session_id}>"
