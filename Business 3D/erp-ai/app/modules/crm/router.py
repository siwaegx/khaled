from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.modules.crm.repository import CustomerRepo, DealRepo
from app.modules.crm.schemas import (
    CustomerCreate, CustomerDetail, CustomerOut, CustomerUpdate,
    DealCreate, DealOut, DealUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

@router.post("/customers", response_model=CustomerOut, status_code=201, summary="Create customer")
def create_customer(body: CustomerCreate, db: Session = Depends(get_db)):
    repo = CustomerRepo(db)
    if repo.find_by_email(body.email):
        raise HTTPException(409, f"Customer with email '{body.email}' already exists.")
    return repo.create(body)


@router.get("/customers", response_model=list[CustomerOut], summary="List customers")
def list_customers(
    search: str | None = Query(default=None, description="Filter by name, email, or company"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return CustomerRepo(db).list(search=search, skip=skip, limit=limit)


@router.get("/customers/{customer_id}", response_model=CustomerDetail, summary="Get customer")
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    obj = CustomerRepo(db).get(customer_id)
    if not obj:
        raise HTTPException(404, "Customer not found.")
    return obj


@router.put("/customers/{customer_id}", response_model=CustomerOut, summary="Update customer")
def update_customer(customer_id: int, body: CustomerUpdate, db: Session = Depends(get_db)):
    obj = CustomerRepo(db).update(customer_id, body)
    if not obj:
        raise HTTPException(404, "Customer not found.")
    return obj


@router.delete("/customers/{customer_id}", status_code=204, summary="Delete customer")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    if not CustomerRepo(db).delete(customer_id):
        raise HTTPException(404, "Customer not found.")


# ---------------------------------------------------------------------------
# Deals
# ---------------------------------------------------------------------------

@router.post("/deals", response_model=DealOut, status_code=201, summary="Create deal")
def create_deal(body: DealCreate, db: Session = Depends(get_db)):
    if not CustomerRepo(db).get(body.customer_id):
        raise HTTPException(404, f"Customer {body.customer_id} not found.")
    return DealRepo(db).create(body)


@router.get("/deals", response_model=list[DealOut], summary="List deals")
def list_deals(
    customer_id: int | None = Query(default=None),
    stage: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return DealRepo(db).list(customer_id=customer_id, stage=stage, skip=skip, limit=limit)


@router.get("/deals/{deal_id}", response_model=DealOut, summary="Get deal")
def get_deal(deal_id: int, db: Session = Depends(get_db)):
    obj = DealRepo(db).get(deal_id)
    if not obj:
        raise HTTPException(404, "Deal not found.")
    return obj


@router.put("/deals/{deal_id}", response_model=DealOut, summary="Update deal")
def update_deal(deal_id: int, body: DealUpdate, db: Session = Depends(get_db)):
    obj = DealRepo(db).update(deal_id, body)
    if not obj:
        raise HTTPException(404, "Deal not found.")
    return obj


@router.delete("/deals/{deal_id}", status_code=204, summary="Delete deal")
def delete_deal(deal_id: int, db: Session = Depends(get_db)):
    if not DealRepo(db).delete(deal_id):
        raise HTTPException(404, "Deal not found.")
