"""
VersionControl — records and restores full entity snapshots.

Every write operation (create / update) should call snapshot_after()
so that history is preserved.  Restore replays the JSON back into the ORM model.
"""

import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.governance.models import EntitySnapshot


@dataclass
class SnapshotInfo:
    id: int
    entity_type: str
    entity_id: int
    version: int
    data: dict
    change_summary: str
    activity_log_id: int | None
    created_at: datetime


def _from_orm(s: EntitySnapshot) -> SnapshotInfo:
    return SnapshotInfo(
        id=s.id,
        entity_type=s.entity_type,
        entity_id=s.entity_id,
        version=s.version,
        data=json.loads(s.data),
        change_summary=s.change_summary,
        activity_log_id=s.activity_log_id,
        created_at=s.created_at,
    )


class VersionControl:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def snapshot(self, entity_type: str, entity_id: int,
                 data: dict, change_summary: str = "",
                 activity_log_id: int | None = None) -> SnapshotInfo:
        """
        Store a new snapshot for an entity.
        Version number is auto-incremented per (entity_type, entity_id).
        """
        latest_version: int = (
            self.db.query(func.max(EntitySnapshot.version))
            .filter(EntitySnapshot.entity_type == entity_type,
                    EntitySnapshot.entity_id == entity_id)
            .scalar() or 0
        )
        obj = EntitySnapshot(
            entity_type=entity_type,
            entity_id=entity_id,
            version=latest_version + 1,
            data=json.dumps(data, default=str),
            change_summary=change_summary,
            activity_log_id=activity_log_id,
        )
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return _from_orm(obj)

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def history(self, entity_type: str, entity_id: int) -> list[SnapshotInfo]:
        rows = (
            self.db.query(EntitySnapshot)
            .filter(EntitySnapshot.entity_type == entity_type,
                    EntitySnapshot.entity_id == entity_id)
            .order_by(desc(EntitySnapshot.version))
            .all()
        )
        return [_from_orm(r) for r in rows]

    def get_version(self, entity_type: str, entity_id: int,
                    version: int) -> SnapshotInfo | None:
        row = (
            self.db.query(EntitySnapshot)
            .filter(EntitySnapshot.entity_type == entity_type,
                    EntitySnapshot.entity_id == entity_id,
                    EntitySnapshot.version == version)
            .first()
        )
        return _from_orm(row) if row else None

    def latest(self, entity_type: str, entity_id: int) -> SnapshotInfo | None:
        row = (
            self.db.query(EntitySnapshot)
            .filter(EntitySnapshot.entity_type == entity_type,
                    EntitySnapshot.entity_id == entity_id)
            .order_by(desc(EntitySnapshot.version))
            .first()
        )
        return _from_orm(row) if row else None

    # ------------------------------------------------------------------
    # Restore
    # ------------------------------------------------------------------

    def restore(self, entity_type: str, entity_id: int,
                version: int, activity_log_id: int | None = None) -> dict:
        """
        Restore an entity to a previous snapshot version.

        Returns the restored data dict.  Caller must apply it to the ORM model.
        Also creates a new snapshot documenting the restoration.
        """
        snap = self.get_version(entity_type, entity_id, version)
        if not snap:
            raise ValueError(f"No snapshot for {entity_type} {entity_id} v{version}")

        restored = _apply_restore(entity_type, entity_id, snap.data, self.db)

        # Record the restoration as a new snapshot
        latest = self.latest(entity_type, entity_id)
        new_version = (latest.version + 1) if latest else 1
        obj = EntitySnapshot(
            entity_type=entity_type,
            entity_id=entity_id,
            version=new_version,
            data=json.dumps(snap.data, default=str),
            change_summary=f"Restored to version {version}",
            activity_log_id=activity_log_id,
        )
        self.db.add(obj)
        self.db.commit()
        return restored


# ------------------------------------------------------------------
# Entity-specific restore implementations
# ------------------------------------------------------------------

def _apply_restore(entity_type: str, entity_id: int, data: dict, db: Session) -> dict:
    from app.modules.crm.schemas import CustomerUpdate, DealUpdate
    from app.modules.crm.repository import CustomerRepo, DealRepo

    if entity_type == "customer":
        patch = CustomerUpdate(
            name=data.get("name"),
            email=data.get("email"),
            phone=data.get("phone"),
            company=data.get("company"),
            notes=data.get("notes"),
        )
        obj = CustomerRepo(db).update(entity_id, patch)
        if not obj:
            raise ValueError(f"Customer {entity_id} not found for restore")
        return {"id": obj.id, "name": obj.name, "email": obj.email}

    if entity_type == "deal":
        patch = DealUpdate(
            title=data.get("title"),
            value=data.get("value"),
            stage=data.get("stage"),
            notes=data.get("notes"),
        )
        obj = DealRepo(db).update(entity_id, patch)
        if not obj:
            raise ValueError(f"Deal {entity_id} not found for restore")
        return {"id": obj.id, "title": obj.title, "stage": obj.stage}

    raise ValueError(f"Unknown entity type '{entity_type}'")


# ------------------------------------------------------------------
# Helpers — called by GovernedExecutor to snapshot after mutations
# ------------------------------------------------------------------

def customer_to_dict(c) -> dict:
    return {
        "id": c.id, "name": c.name, "email": c.email,
        "phone": c.phone, "company": c.company, "notes": c.notes,
        "created_at": str(c.created_at),
    }


def deal_to_dict(d) -> dict:
    return {
        "id": d.id, "title": d.title, "value": d.value,
        "stage": d.stage, "customer_id": d.customer_id,
        "notes": d.notes, "created_at": str(d.created_at),
    }
