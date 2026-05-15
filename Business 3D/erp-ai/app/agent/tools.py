"""
CRM tool implementations registered with the agent registry.

Every tool receives keyword arguments extracted by the parser plus
a special `_db` key injected by the runner at call time.
"""

from sqlalchemy.orm import Session

from app.agent.registry import registry
from app.modules.crm.repository import CustomerRepo, DealRepo
from app.modules.crm.schemas import CustomerCreate, DealCreate


# ---------------------------------------------------------------------------
# Customer tools
# ---------------------------------------------------------------------------

@registry.register(
    name="create_customer",
    description="Create a new CRM customer.",
    params=["name", "email", "phone", "company", "notes"],
    required=["name", "email"],
)
def create_customer(name: str, email: str,
                    phone: str | None = None,
                    company: str | None = None,
                    notes: str | None = None,
                    **ctx) -> dict:
    db: Session = ctx["_db"]
    repo = CustomerRepo(db)
    if repo.find_by_email(email):
        return {"error": f"Customer with email '{email}' already exists."}
    data = CustomerCreate(name=name, email=email, phone=phone, company=company, notes=notes)
    obj = repo.create(data)
    return {
        "id": obj.id,
        "name": obj.name,
        "email": obj.email,
        "company": obj.company,
        "created_at": obj.created_at.isoformat(),
    }


@registry.register(
    name="find_customer",
    description="Search customers by name, email, or company.",
    params=["query"],
    required=["query"],
)
def find_customer(query: str, **ctx) -> dict:
    db: Session = ctx["_db"]
    results = CustomerRepo(db).search(query)
    return {
        "count": len(results),
        "customers": [
            {"id": c.id, "name": c.name, "email": c.email, "company": c.company}
            for c in results
        ],
    }


@registry.register(
    name="list_customers",
    description="List all customers, optionally filtered.",
    params=["limit"],
    required=[],
)
def list_customers(limit: str | int = 20, **ctx) -> dict:
    db: Session = ctx["_db"]
    results = CustomerRepo(db).list(limit=int(limit))
    return {
        "count": len(results),
        "customers": [
            {"id": c.id, "name": c.name, "email": c.email, "company": c.company}
            for c in results
        ],
    }


# ---------------------------------------------------------------------------
# Deal tools
# ---------------------------------------------------------------------------

@registry.register(
    name="create_deal",
    description="Create a new deal for an existing customer.",
    params=["title", "customer_id", "value", "stage", "notes"],
    required=["title", "customer_id"],
)
def create_deal(title: str, customer_id: str | int,
                value: str | float | None = None,
                stage: str = "lead",
                notes: str | None = None,
                **ctx) -> dict:
    db: Session = ctx["_db"]
    cid = int(customer_id)
    if not CustomerRepo(db).get(cid):
        return {"error": f"Customer {cid} not found."}
    data = DealCreate(
        title=title,
        customer_id=cid,
        value=float(value) if value is not None else None,
        stage=stage,
        notes=notes,
    )
    obj = DealRepo(db).create(data)
    return {
        "id": obj.id,
        "title": obj.title,
        "stage": obj.stage,
        "value": obj.value,
        "customer_id": obj.customer_id,
        "created_at": obj.created_at.isoformat(),
    }


@registry.register(
    name="list_deals",
    description="List deals, optionally filtered by customer or stage.",
    params=["customer_id", "stage", "limit"],
    required=[],
)
def list_deals(customer_id: str | int | None = None,
               stage: str | None = None,
               limit: str | int = 20,
               **ctx) -> dict:
    db: Session = ctx["_db"]
    results = DealRepo(db).list(
        customer_id=int(customer_id) if customer_id else None,
        stage=stage,
        limit=int(limit),
    )
    return {
        "count": len(results),
        "deals": [
            {"id": d.id, "title": d.title, "stage": d.stage,
             "value": d.value, "customer_id": d.customer_id}
            for d in results
        ],
    }


# ---------------------------------------------------------------------------
# CRM Designer tool
# ---------------------------------------------------------------------------

@registry.register(
    name="generate_crm_schema",
    description="Generate a CRM schema (tables, fields, relationships, UI layout) for any business type.",
    params=["description"],
    required=["description"],
)
def generate_crm_schema(description: str, **ctx) -> dict:
    from app.modules.crm_designer.engine import generate_crm_schema as _engine
    schema = _engine(description)
    return schema.model_dump()
