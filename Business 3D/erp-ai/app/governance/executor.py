"""
GovernedExecutor — single entry point for all tool execution.

Replaces direct spec.fn() calls in ai_runner.py.

For every tool call it:
  1. Checks approval policy → defers if approval required
  2. Starts an ActivityLog entry
  3. Executes the tool
  4. Records result + undo data in the log
  5. Snapshots any mutated entity for version history
"""

import json
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.agent.registry import registry
from app.core.logging import get_logger
from app.governance.approval import ApprovalGate, ApprovalRecord, _build_undo_data, _post_snapshot
from app.governance.logger import ActivityLogger
from app.governance.models import ActivityLog

logger = get_logger(__name__)

# Tools whose results should NOT generate snapshots or undo entries
_READ_ONLY = {"find_customer", "list_customers", "list_deals", "generate_crm_schema"}


@dataclass
class ExecutionResult:
    status: str                     # success | failed | pending_approval
    output: dict | None
    log_id: int | None
    approval_id: int | None
    message: str


class GovernedExecutor:
    def __init__(self, db: Session):
        self.db = db
        self.approval_gate = ApprovalGate(db)
        self.activity_logger = ActivityLogger(db)

    def execute(self, tool_name: str, params: dict,
                session_id: str) -> ExecutionResult:
        spec = registry.get(tool_name)
        if not spec:
            return ExecutionResult(
                status="failed", output=None, log_id=None, approval_id=None,
                message=f"Unknown tool: {tool_name}",
            )

        # 1. Approval gate check
        if self.approval_gate.requires_approval(tool_name, params):
            pending = self.approval_gate.create_pending(tool_name, params, session_id)
            logger.info("execution_deferred_for_approval",
                        tool=tool_name, approval_id=pending.id, session=session_id)
            return ExecutionResult(
                status="pending_approval",
                output={"approval_id": pending.id, "risk_level": pending.risk_level},
                log_id=None,
                approval_id=pending.id,
                message=f"Action requires approval (risk: {pending.risk_level}). "
                        f"Approval ID: {pending.id}. Reason: {pending.reason}",
            )

        # 2. Start audit log
        log = self.activity_logger.start(session_id, tool_name, params)

        # 3. Execute
        try:
            output = spec.fn(**params, _db=self.db)
        except Exception as exc:
            self.activity_logger.fail(log, str(exc))
            logger.error("tool_execution_failed", tool=tool_name, error=str(exc))
            return ExecutionResult(
                status="failed", output=None, log_id=log.id, approval_id=None,
                message=f"Tool '{tool_name}' raised an error: {exc}",
            )

        has_error = isinstance(output, dict) and "error" in output
        if has_error:
            self.activity_logger.fail(log, output.get("error", "Unknown error"))
            return ExecutionResult(
                status="failed", output=output, log_id=log.id, approval_id=None,
                message=output.get("error", "Tool returned an error."),
            )

        # 4. Complete log with undo data
        undo_data = None
        if tool_name not in _READ_ONLY:
            undo_data = _build_undo_data(tool_name, output)
        self.activity_logger.complete(log, output, undo_data=undo_data)

        # 5. Snapshot mutated entities
        if tool_name not in _READ_ONLY:
            try:
                _post_snapshot(tool_name, output, log.id, self.db)
            except Exception as exc:
                logger.warning("snapshot_failed", tool=tool_name, error=str(exc))

        logger.info("tool_executed", tool=tool_name, log_id=log.id,
                    session=session_id, has_undo=undo_data is not None)
        return ExecutionResult(
            status="success", output=output, log_id=log.id,
            approval_id=None, message="",
        )
