"""
ActivityLogger — creates and updates ActivityLog entries.

Usage:
    log = logger.start(session_id, tool_name, params)
    try:
        result = run_tool(...)
        logger.complete(log, result, undo_data={...})
    except Exception as e:
        logger.fail(log, str(e))
"""

import json
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.governance.models import ActivityLog

# Tools that are read-only — logged for audit but marked not undoable
_READ_ONLY_TOOLS = {"find_customer", "list_customers", "list_deals", "generate_crm_schema"}

# Tools that produce undoable actions
_UNDOABLE_TOOLS = {"create_customer", "create_deal"}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _j(obj: Any) -> str:
    return json.dumps(obj, default=str)


class ActivityLogger:
    def __init__(self, db: Session):
        self.db = db

    def start(self, session_id: str, tool_name: str,
              params: dict, approval_id: int | None = None) -> ActivityLog:
        log = ActivityLog(
            session_id=session_id,
            tool_name=tool_name,
            input_params=_j(params),
            status="executing",
            is_undoable=tool_name in _UNDOABLE_TOOLS,
            approval_id=approval_id,
            created_at=_now(),
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def complete(self, log: ActivityLog, result: dict,
                 undo_data: dict | None = None) -> ActivityLog:
        log.status = "success"
        log.output_result = _j(result)
        log.completed_at = _now()
        log.duration_ms = _elapsed_ms(log.created_at)
        if undo_data:
            log.undo_data = _j(undo_data)
        self.db.commit()
        self.db.refresh(log)
        return log

    def fail(self, log: ActivityLog, error: str) -> ActivityLog:
        log.status = "failed"
        log.error_message = error
        log.completed_at = _now()
        log.duration_ms = _elapsed_ms(log.created_at)
        self.db.commit()
        self.db.refresh(log)
        return log

    def mark_undone(self, log: ActivityLog, undo_log_id: int) -> ActivityLog:
        log.status = "undone"
        log.undone_by_log_id = undo_log_id
        self.db.commit()
        self.db.refresh(log)
        return log

    # --- queries ---

    def get(self, log_id: int) -> ActivityLog | None:
        return self.db.query(ActivityLog).filter(ActivityLog.id == log_id).first()

    def list(self, session_id: str | None = None, tool_name: str | None = None,
             status: str | None = None, limit: int = 50) -> list[ActivityLog]:
        q = self.db.query(ActivityLog)
        if session_id:
            q = q.filter(ActivityLog.session_id == session_id)
        if tool_name:
            q = q.filter(ActivityLog.tool_name == tool_name)
        if status:
            q = q.filter(ActivityLog.status == status)
        return q.order_by(desc(ActivityLog.created_at)).limit(limit).all()

    def get_undoable(self, session_id: str | None = None) -> list[ActivityLog]:
        q = (self.db.query(ActivityLog)
             .filter(ActivityLog.is_undoable == True,        # noqa: E712
                     ActivityLog.status == "success"))
        if session_id:
            q = q.filter(ActivityLog.session_id == session_id)
        return q.order_by(desc(ActivityLog.created_at)).all()


def _elapsed_ms(started: datetime) -> float:
    delta = datetime.now(timezone.utc).replace(tzinfo=None) - started
    return round(delta.total_seconds() * 1000, 2)
