"""
Governance models — three independent tables.

ActivityLog   — immutable audit trail of every AI action
Approval      — pending AI suggestions awaiting user decision
EntitySnapshot — full-record version snapshots for rollback
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    session_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    tool_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    input_params: Mapped[str] = mapped_column(Text, nullable=False)      # JSON
    output_result: Mapped[str | None] = mapped_column(Text)              # JSON
    error_message: Mapped[str | None] = mapped_column(Text)

    # pending | executing | success | failed | undone | skipped_approval
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="executing")

    is_undoable: Mapped[bool] = mapped_column(default=False)
    undo_data: Mapped[str | None] = mapped_column(Text)                  # JSON
    undone_by_log_id: Mapped[int | None] = mapped_column(Integer)        # points to the undo log entry

    approval_id: Mapped[int | None] = mapped_column(ForeignKey("approvals.id"), nullable=True)
    duration_ms: Mapped[float | None] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    __table_args__ = (
        Index("ix_activity_logs_session_tool", "session_id", "tool_name"),
        Index("ix_activity_logs_status", "status"),
    )


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    session_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    tool_name: Mapped[str] = mapped_column(String(128), nullable=False)
    tool_params: Mapped[str] = mapped_column(Text, nullable=False)       # JSON

    # low | medium | high
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    # pending | approved | rejected | expired
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)

    review_note: Mapped[str | None] = mapped_column(Text)
    activity_log_id: Mapped[int | None] = mapped_column(Integer)         # set after execution

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)


class EntitySnapshot(Base):
    __tablename__ = "entity_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)   # customer | deal
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[str] = mapped_column(Text, nullable=False)               # full record JSON
    change_summary: Mapped[str] = mapped_column(String(512), default="")

    activity_log_id: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_snapshots_entity", "entity_type", "entity_id"),
        Index("ix_snapshots_version", "entity_type", "entity_id", "version", unique=True),
    )
