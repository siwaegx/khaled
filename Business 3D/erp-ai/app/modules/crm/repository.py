from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.db.models import Customer, Deal
from app.modules.crm.schemas import CustomerCreate, CustomerUpdate, DealCreate, DealUpdate


# ---------------------------------------------------------------------------
# Customer repository
# ---------------------------------------------------------------------------

class CustomerRepo:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: CustomerCreate) -> Customer:
        obj = Customer(**data.model_dump())
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def get(self, customer_id: int) -> Customer | None:
        return (
            self.db.query(Customer)
            .options(joinedload(Customer.deals))
            .filter(Customer.id == customer_id)
            .first()
        )

    def list(self, search: str | None = None, skip: int = 0, limit: int = 50) -> list[Customer]:
        q = self.db.query(Customer)
        if search:
            pattern = f"%{search}%"
            q = q.filter(
                or_(
                    Customer.name.ilike(pattern),
                    Customer.email.ilike(pattern),
                    Customer.company.ilike(pattern),
                )
            )
        return q.order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()

    def update(self, customer_id: int, data: CustomerUpdate) -> Customer | None:
        obj = self.db.query(Customer).filter(Customer.id == customer_id).first()
        if not obj:
            return None
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(obj, k, v)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, customer_id: int) -> bool:
        obj = self.db.query(Customer).filter(Customer.id == customer_id).first()
        if not obj:
            return False
        self.db.delete(obj)
        self.db.commit()
        return True

    def find_by_email(self, email: str) -> Customer | None:
        return self.db.query(Customer).filter(Customer.email == email).first()

    def search(self, query: str) -> list[Customer]:
        return self.list(search=query, limit=10)


# ---------------------------------------------------------------------------
# Deal repository
# ---------------------------------------------------------------------------

class DealRepo:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: DealCreate) -> Deal:
        obj = Deal(**data.model_dump())
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def get(self, deal_id: int) -> Deal | None:
        return self.db.query(Deal).filter(Deal.id == deal_id).first()

    def list(self, customer_id: int | None = None, stage: str | None = None,
             skip: int = 0, limit: int = 50) -> list[Deal]:
        q = self.db.query(Deal)
        if customer_id:
            q = q.filter(Deal.customer_id == customer_id)
        if stage:
            q = q.filter(Deal.stage == stage)
        return q.order_by(Deal.created_at.desc()).offset(skip).limit(limit).all()

    def update(self, deal_id: int, data: DealUpdate) -> Deal | None:
        obj = self.db.query(Deal).filter(Deal.id == deal_id).first()
        if not obj:
            return None
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(obj, k, v)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, deal_id: int) -> bool:
        obj = self.db.query(Deal).filter(Deal.id == deal_id).first()
        if not obj:
            return False
        self.db.delete(obj)
        self.db.commit()
        return True
