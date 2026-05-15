"""
UndoEngine — executes the inverse of a logged action.

Each undoable tool has a registered inverse function.
The inverse receives the original params, the original result, and a DB session.
"""

import json
from dataclasses import dataclass
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class UndoResult:
    success: bool
    original_log_id: int
    undo_log_id: int | None
    message: str
    restored_data: dict | None = None


# ------------------------------------------------------------------
# Inverse operation registry
# ------------------------------------------------------------------

InverseFn = Callable[[dict, dict, Session], dict]
_INVERSES: dict[str, InverseFn] = {}


def register_inverse(tool_name: str):
    def decorator(fn: InverseFn) -> InverseFn:
        _INVERSES[tool_name] = fn
        return fn
    return decorator


def has_inverse(tool_name: str) -> bool:
    return tool_name in _INVERSES


# ------------------------------------------------------------------
# Registered inverses
# ------------------------------------------------------------------

@register_inverse("create_customer")
def _undo_create_customer(params: dict, result: dict, db: Session) -> dict:
    from app.modules.crm.repository import CustomerRepo
    customer_id = result.get("id")
    if not customer_id:
        raise ValueError("Cannot undo: no customer ID in result")
    repo = CustomerRepo(db)
    name = result.get("name", "?")
    deleted = repo.delete(int(customer_id))
    if not deleted:
        raise ValueError(f"Customer {customer_id} not found — may have been deleted already")
    return {"deleted_customer_id": customer_id, "deleted_name": name}


@register_inverse("create_deal")
def _undo_create_deal(params: dict, result: dict, db: Session) -> dict:
    from app.modules.crm.repository import DealRepo
    deal_id = result.get("id")
    if not deal_id:
        raise ValueError("Cannot undo: no deal ID in result")
    repo = DealRepo(db)
    title = result.get("title", "?")
    deleted = repo.delete(int(deal_id))
    if not deleted:
        raise ValueError(f"Deal {deal_id} not found — may have been deleted already")
    return {"deleted_deal_id": deal_id, "deleted_title": title}


# ------------------------------------------------------------------
# Undo engine
# ------------------------------------------------------------------

class UndoEngine:
    def __init__(self, db: Session):
        self.db = db

    def undo(self, log_id: int) -> UndoResult:
        from app.governance.logger import ActivityLogger
        from app.governance.models import ActivityLog

        activity_logger = ActivityLogger(self.db)
        log = activity_logger.get(log_id)

        if not log:
            return UndoResult(success=False, original_log_id=log_id,
                              undo_log_id=None,
                              message=f"Activity log {log_id} not found.")

        if log.status == "undone":
            return UndoResult(success=False, original_log_id=log_id,
                              undo_log_id=log.undone_by_log_id,
                              message=f"Log {log_id} has already been undone.")

        if log.status != "success":
            return UndoResult(success=False, original_log_id=log_id,
                              undo_log_id=None,
                              message=f"Cannot undo log {log_id} — status is '{log.status}'.")

        if not log.is_undoable or not has_inverse(log.tool_name):
            return UndoResult(success=False, original_log_id=log_id,
                              undo_log_id=None,
                              message=f"Tool '{log.tool_name}' is not undoable.")

        params = json.loads(log.input_params or "{}")
        result = json.loads(log.output_result or "{}")

        # Create an undo log entry
        undo_log = activity_logger.start(
            session_id=log.session_id,
            tool_name=f"undo_{log.tool_name}",
            params={"original_log_id": log_id, "original_tool": log.tool_name},
        )

        try:
            inverse_fn = _INVERSES[log.tool_name]
            restored = inverse_fn(params, result, self.db)

            activity_logger.complete(undo_log, restored)
            activity_logger.mark_undone(log, undo_log.id)

            logger.info("undo_success", original_log_id=log_id,
                        tool=log.tool_name, undo_log_id=undo_log.id)
            return UndoResult(
                success=True,
                original_log_id=log_id,
                undo_log_id=undo_log.id,
                message=f"Successfully undid '{log.tool_name}' (log {log_id}).",
                restored_data=restored,
            )

        except Exception as exc:
            activity_logger.fail(undo_log, str(exc))
            logger.error("undo_failed", original_log_id=log_id, error=str(exc))
            return UndoResult(
                success=False,
                original_log_id=log_id,
                undo_log_id=undo_log.id,
                message=f"Undo failed: {exc}",
            )
