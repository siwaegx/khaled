from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.modules.crm_designer.engine import generate_crm_schema
from app.modules.crm_designer.schemas import CRMSchema
from app.core.logging import get_logger

router = APIRouter(prefix="/crm-designer", tags=["crm-designer"])
logger = get_logger(__name__)


class DesignRequest(BaseModel):
    description: str = Field(
        ...,
        min_length=3,
        max_length=500,
        examples=[
            "Design CRM for water treatment company",
            "CRM for real estate agency in Cairo",
            "Generate CRM schema for manufacturing plant",
        ],
    )


@router.post("/generate", response_model=CRMSchema, summary="Generate CRM schema from description")
def design_crm(body: DesignRequest) -> CRMSchema:
    logger.info("crm_design_request", description=body.description[:100])
    schema = generate_crm_schema(body.description)
    logger.info("crm_design_complete", industry=schema.industry, tables=len(schema.tables))
    return schema
