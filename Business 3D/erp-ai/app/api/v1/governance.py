import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.governance.approval import ApprovalGate
from app.governance.logger import ActivityLogger
from app.governance.undo import UndoEngine
from app.governance.versioning import VersionControl

router = APIRouter(prefix="/governance", tags=["governance"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ActivityLogOut(BaseModel):
    id: int
    session_id: str
    tool_name: str
    input_params: dict
    output_result: dict | None
    error_message: str | None
    status: str
    is_undoable: bool
    undo_data: dict | None
    undone_by_log_id: int | None
    approval_id: int | None
    duration_ms: float | None
    created_at: str
    completed_at: str | None


class ApprovalOut(BaseModel):
    id: int
    session_id: str
    tool_name: str
    tool_params: dict
    risk_level: str
    reason: str
    status: str
    review_note: str | None
    activity_log_id: int | None
    created_at: str
    expires_at: str | None
    decided_at: str | None


class ApproveRequest(BaseModel):
    note: str | None = Field(default=None, examples=["Verified with manager — OK to proceed."])


class RejectRequest(BaseModel):
    note: str | None = Field(default=None, examples=["Deal value needs renegotiation first."])


class UndoResponse(BaseModel):
    success: bool
    original_log_id: int
    undo_log_id: int | None
    message: str
    restored_data: dict | None


class SnapshotOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    version: int
    data: dict
    change_summary: str
    activity_log_id: int | None
    created_at: str


class RestoreResponse(BaseModel):
    success: bool
    entity_type: str
    entity_id: int
    restored_to_version: int
    restored_data: dict
    message: str


# ---------------------------------------------------------------------------
# Activity Logs  — GET /governance/logs
# ---------------------------------------------------------------------------

@router.get("/logs", response_model=list[ActivityLogOut], summary="List activity logs")
def list_logs(
    session_id: str | None = Query(default=None),
    tool_name: str | None = Query(default=None),
    status: str | None = Query(default=None, description="pending|executing|success|failed|undone"),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    logs = ActivityLogger(db).list(session_id=session_id, tool_name=tool_name,
                                   status=status, limit=limit)
    return [_log_out(l) for l in logs]


@router.get("/logs/{log_id}", response_model=ActivityLogOut, summary="Get a single activity log")
def get_log(log_id: int, db: Session = Depends(get_db)):
    log = ActivityLogger(db).get(log_id)
    if not log:
        raise HTTPException(404, f"Activity log {log_id} not found.")
    return _log_out(log)


@router.get("/logs/undoable", response_model=list[ActivityLogOut],
            summary="List actions that can be undone")
def undoable_logs(
    session_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    logs = ActivityLogger(db).get_undoable(session_id=session_id)
    return [_log_out(l) for l in logs]


# ---------------------------------------------------------------------------
# Undo  — POST /governance/undo/{log_id}
# ---------------------------------------------------------------------------

@router.post("/undo/{log_id}", response_model=UndoResponse, summary="Undo an action")
def undo_action(log_id: int, db: Session = Depends(get_db)):
    result = UndoEngine(db).undo(log_id)
    return UndoResponse(
        success=result.success,
        original_log_id=result.original_log_id,
        undo_log_id=result.undo_log_id,
        message=result.message,
        restored_data=result.restored_data,
    )


# ---------------------------------------------------------------------------
# Approvals  — GET/POST /governance/approvals
# ---------------------------------------------------------------------------

@router.get("/approvals", response_model=list[ApprovalOut], summary="List approvals")
def list_approvals(
    status: str | None = Query(default="pending",
                               description="pending|approved|rejected|expired"),
    session_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    approvals = ApprovalGate(db).list(status=status, session_id=session_id, limit=limit)
    return [_approval_out(a) for a in approvals]


@router.get("/approvals/{approval_id}", response_model=ApprovalOut, summary="Get approval detail")
def get_approval(approval_id: int, db: Session = Depends(get_db)):
    a = ApprovalGate(db).get(approval_id)
    if not a:
        raise HTTPException(404, f"Approval {approval_id} not found.")
    return _approval_out(a)


@router.post("/approvals/{approval_id}/approve", response_model=ApprovalOut,
             summary="Approve a pending action — executes the tool")
def approve_action(approval_id: int, body: ApproveRequest = ApproveRequest(),
                   db: Session = Depends(get_db)):
    try:
        approval, result = ApprovalGate(db).approve(approval_id, review_note=body.note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _approval_out(approval)


@router.post("/approvals/{approval_id}/reject", response_model=ApprovalOut,
             summary="Reject a pending action — discards it")
def reject_action(approval_id: int, body: RejectRequest = RejectRequest(),
                  db: Session = Depends(get_db)):
    try:
        approval = ApprovalGate(db).reject(approval_id, review_note=body.note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _approval_out(approval)


# ---------------------------------------------------------------------------
# Version Control  — GET /governance/versions/{type}/{id}
# ---------------------------------------------------------------------------

@router.get("/versions/{entity_type}/{entity_id}",
            response_model=list[SnapshotOut], summary="Version history of an entity")
def version_history(entity_type: str, entity_id: int,
                    db: Session = Depends(get_db)):
    snaps = VersionControl(db).history(entity_type, entity_id)
    if not snaps:
        raise HTTPException(404, f"No snapshots for {entity_type} {entity_id}.")
    return [_snap_out(s) for s in snaps]


@router.get("/versions/{entity_type}/{entity_id}/{version}",
            response_model=SnapshotOut, summary="Get a specific version")
def get_version(entity_type: str, entity_id: int, version: int,
                db: Session = Depends(get_db)):
    snap = VersionControl(db).get_version(entity_type, entity_id, version)
    if not snap:
        raise HTTPException(404, f"Version {version} of {entity_type} {entity_id} not found.")
    return _snap_out(snap)


@router.post("/versions/{entity_type}/{entity_id}/{version}/restore",
             response_model=RestoreResponse, summary="Restore entity to a previous version")
def restore_version(entity_type: str, entity_id: int, version: int,
                    db: Session = Depends(get_db)):
    vc = VersionControl(db)
    snap = vc.get_version(entity_type, entity_id, version)
    if not snap:
        raise HTTPException(404, f"Version {version} of {entity_type} {entity_id} not found.")
    try:
        restored = vc.restore(entity_type, entity_id, version)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return RestoreResponse(
        success=True,
        entity_type=entity_type,
        entity_id=entity_id,
        restored_to_version=version,
        restored_data=restored,
        message=f"{entity_type.capitalize()} {entity_id} restored to version {version}.",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _j(s: str | None) -> dict | None:
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:
        return None


def _ts(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _log_out(l) -> ActivityLogOut:
    return ActivityLogOut(
        id=l.id, session_id=l.session_id, tool_name=l.tool_name,
        input_params=_j(l.input_params) or {},
        output_result=_j(l.output_result),
        error_message=l.error_message, status=l.status,
        is_undoable=l.is_undoable,
        undo_data=_j(l.undo_data),
        undone_by_log_id=l.undone_by_log_id,
        approval_id=l.approval_id,
        duration_ms=l.duration_ms,
        created_at=_ts(l.created_at) or "",
        completed_at=_ts(l.completed_at),
    )


def _approval_out(a) -> ApprovalOut:
    return ApprovalOut(
        id=a.id, session_id=a.session_id, tool_name=a.tool_name,
        tool_params=a.tool_params if isinstance(a.tool_params, dict) else _j(a.tool_params) or {},
        risk_level=a.risk_level, reason=a.reason, status=a.status,
        review_note=a.review_note, activity_log_id=a.activity_log_id,
        created_at=_ts(a.created_at) or "",
        expires_at=_ts(a.expires_at),
        decided_at=_ts(a.decided_at),
    )


def _snap_out(s) -> SnapshotOut:
    return SnapshotOut(
        id=s.id, entity_type=s.entity_type, entity_id=s.entity_id,
        version=s.version,
        data=s.data if isinstance(s.data, dict) else _j(s.data) or {},
        change_summary=s.change_summary,
        activity_log_id=s.activity_log_id,
        created_at=_ts(s.created_at) or "",
    )
