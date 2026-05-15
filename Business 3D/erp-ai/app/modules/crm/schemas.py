from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------

class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: str | None = None
    company: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    phone: str | None = None
    company: str | None = None
    notes: str | None = None


class CustomerOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    email: str
    phone: str | None
    company: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class CustomerDetail(CustomerOut):
    deals: list["DealOut"] = []


# ---------------------------------------------------------------------------
# Deal
# ---------------------------------------------------------------------------

DealStage = Literal["lead", "qualified", "proposal", "negotiation", "won", "lost"]


class DealCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    value: float | None = Field(default=None, ge=0)
    stage: DealStage = "lead"
    customer_id: int
    notes: str | None = None


class DealUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    value: float | None = Field(default=None, ge=0)
    stage: DealStage | None = None
    notes: str | None = None


class DealOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    value: float | None
    stage: str
    customer_id: int
    notes: str | None
    created_at: datetime
    updated_at: datetime


CustomerDetail.model_rebuild()
