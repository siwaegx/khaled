"""
ApprovalGate — policy engine + approval lifecycle.

Flow:
  1. GovernedExecutor calls requires_approval(tool, params)
  2. If True  → create Approval (pending) → return approval_id to caller
  3. User calls POST /approve/{id} → ApprovalGate executes the tool
  4. User calls POST /reject/{id}  → Approval marked rejected, no action

Policy rules are evaluated in order; first match wins.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.governance.models import Approval

logger = get_logger(__name__)

_APPROVAL_TTL_HOURS = 24  # pending approvals expire after this


# ------------------------------------------------------------------
# Policy rule definition
# ------------------------------------------------------------------

@dataclass
class _Rule:
    tool_name: str
    condition: Callable[[dict], bool]
    risk_level: str   # low | medium | high
    reason: str


_POLICY: list[_Rule] = [
    # High-value deals always need approval
    _Rule("create_deal",
          lambda p: float(p.get("value") or 0) >= 100_000,
          "high",
          "Deal value >= $100,000 — requires manager approval."),

    _Rule("create_deal",
          lambda p: float(p.get("value") or 0) >= 50_000,
          "medium",
          "Deal value >= $50,000 — requires review."),

    # Bulk / schema generation on prod data
    _Rule("generate_crm_schema",
          lambda p: "production" in str(p.get("description", "")).lower(),
          "high",
          "Production schema change requires approval."),
]


def _check_policy(tool_name: str, params: dict) -> _Rule | None:
    for rule in _POLICY:
        if rule.tool_name == tool_name:
            try:
                if rule.condition(params):
                    return rule
            except Exception:
                pass
    return None


# ------------------------------------------------------------------
# Approval dataclass (returned to API layer)
# ------------------------------------------------------------------

@dataclass
class ApprovalRecord:
    id: int
    session_id: str
    tool_name: str
    tool_params: dict
    risk_level: str
    reason: str
    status: str
    review_note: str | None
    activity_log_id: int | None
    created_at: datetime
    expires_at: datetime | None
    decided_at: datetime | None


def _from_orm(a: Approval) -> ApprovalRecord:
    return ApprovalRecord(
        id=a.id, session_id=a.session_id,
        tool_name=a.tool_name,
        tool_params=json.loads(a.tool_params or "{}"),
        risk_level=a.risk_level, reason=a.reason, status=a.status,
        review_note=a.review_note,
        activity_log_id=a.activity_log_id,
        created_at=a.created_at,
        expires_at=a.expires_at,
        decided_at=a.decided_at,
    )


# ------------------------------------------------------------------
# ApprovalGate
# ------------------------------------------------------------------

class ApprovalGate:
    def __init__(self, db: Session):
        self.db = db

    def requires_approval(self, tool_name: str, params: dict) -> bool:
        return _check_policy(tool_name, params) is not None

    def create_pending(self, tool_name: str, params: dict,
                       session_id: str) -> ApprovalRecord:
        rule = _check_policy(tool_name, params)
        if not rule:
            raise ValueError(f"No approval rule matched {tool_name}")

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        obj = Approval(
            session_id=session_id,
            tool_name=tool_name,
            tool_params=json.dumps(params, default=str),
            risk_level=rule.risk_level,
            reason=rule.reason,
            status="pending",
            expires_at=now + timedelta(hours=_APPROVAL_TTL_HOURS),
            created_at=now,
        )
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        logger.info("approval_created", id=obj.id, tool=tool_name,
                    risk=rule.risk_level, session=session_id)
        return _from_orm(obj)

    def get(self, approval_id: int) -> ApprovalRecord | None:
        obj = self.db.query(Approval).filter(Approval.id == approval_id).first()
        return _from_orm(obj) if obj else None

    def list(self, status: str | None = None,
             session_id: str | None = None,
             limit: int = 50) -> list[ApprovalRecord]:
        q = self.db.query(Approval)
        if status:
            q = q.filter(Approval.status == status)
        if session_id:
            q = q.filter(Approval.session_id == session_id)
        rows = q.order_by(desc(Approval.created_at)).limit(limit).all()
        return [_from_orm(r) for r in rows]

    def approve(self, approval_id: int,
                review_note: str | None = None) -> tuple[ApprovalRecord, dict]:
        """
        Approve a pending action and execute it.
        Returns (ApprovalRecord, tool_result).
        """
        obj = self.db.query(Approval).filter(Approval.id == approval_id).first()
        if not obj:
            raise ValueError(f"Approval {approval_id} not found.")
        if obj.status != "pending":
            raise ValueError(f"Approval {approval_id} is '{obj.status}', not pending.")

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if obj.expires_at and now > obj.expires_at:
            obj.status = "expired"
            self.db.commit()
            raise ValueError(f"Approval {approval_id} has expired.")

        params = json.loads(obj.tool_params)

        # Execute the tool
        result = self._execute_tool(obj.tool_name, params)

        # Create activity log entry for the approved execution
        from app.governance.logger import ActivityLogger
        al = ActivityLogger(self.db)
        log = al.start(obj.session_id, obj.tool_name, params, approval_id=obj.id)
        al.complete(log, result, undo_data=_build_undo_data(obj.tool_name, result))

        # Update approval record
        obj.status = "approved"
        obj.review_note = review_note
        obj.activity_log_id = log.id
        obj.decided_at = now
        self.db.commit()
        self.db.refresh(obj)

        # Snapshot the created/updated entity
        _post_snapshot(obj.tool_name, result, log.id, self.db)

        logger.info("approval_approved", id=approval_id, tool=obj.tool_name,
                    log_id=log.id)
        return _from_orm(obj), result

    def reject(self, approval_id: int,
               review_note: str | None = None) -> ApprovalRecord:
        obj = self.db.query(Approval).filter(Approval.id == approval_id).first()
        if not obj:
            raise ValueError(f"Approval {approval_id} not found.")
        if obj.status != "pending":
            raise ValueError(f"Approval {approval_id} is already '{obj.status}'.")

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        obj.status = "rejected"
        obj.review_note = review_note
        obj.decided_at = now
        self.db.commit()
        self.db.refresh(obj)
        logger.info("approval_rejected", id=approval_id, tool=obj.tool_name)
        return _from_orm(obj)

    # ------------------------------------------------------------------
    # Internal — execute the approved tool
    # ------------------------------------------------------------------

    def _execute_tool(self, tool_name: str, params: dict) -> dict:
        from app.agent.registry import registry
        spec = registry.get(tool_name)
        if not spec:
            raise ValueError(f"Unknown tool: {tool_name}")
        return spec.fn(**params, _db=self.db)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _build_undo_data(tool_name: str, result: dict) -> dict | None:
    if tool_name == "create_customer":
        return {"operation": "delete_customer", "entity_id": result.get("id")}
    if tool_name == "create_deal":
        return {"operation": "delete_deal", "entity_id": result.get("id")}
    return None


def _post_snapshot(tool_name: str, result: dict,
                   log_id: int, db: Session) -> None:
    from app.governance.versioning import (
        VersionControl, customer_to_dict, deal_to_dict,
    )
    from app.modules.crm.repository import CustomerRepo, DealRepo

    vc = VersionControl(db)

    if tool_name == "create_customer" and result.get("id"):
        obj = CustomerRepo(db).get(result["id"])
        if obj:
            vc.snapshot("customer", obj.id, customer_to_dict(obj),
                        change_summary="created via approved action",
                        activity_log_id=log_id)

    elif tool_name == "create_deal" and result.get("id"):
        obj = DealRepo(db).get(result["id"])
        if obj:
            vc.snapshot("deal", obj.id, deal_to_dict(obj),
                        change_summary="created via approved action",
                        activity_log_id=log_id)
