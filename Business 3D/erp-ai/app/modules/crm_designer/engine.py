"""
CRM Designer Engine — rule-based industry schema generator.

Given a plain-text description of a business, detects the industry
and returns a fully specified CRM schema: tables, fields, relationships,
pipeline stages, and UI layout recommendations.
"""

import re
from app.modules.crm_designer.schemas import (
    CRMSchema, TableDef, FieldDef, Relationship,
    UISuggestions, DashboardWidget,
)


# ---------------------------------------------------------------------------
# Shared field building helpers
# ---------------------------------------------------------------------------

def _f(name: str, label: str, ftype: str, required: bool = False,
        options: list[str] | None = None, desc: str = "") -> FieldDef:
    return FieldDef(name=name, label=label, type=ftype,
                    required=required, options=options, description=desc)


# Common fields reused across industries
_COMMON_NOTES   = _f("notes",      "Notes",        "textarea")
_COMMON_STATUS  = lambda opts: _f("status", "Status", "select", True, opts)
_COMMON_CREATED = _f("created_at", "Created Date",  "date")
_COMMON_OWNER   = _f("owner",      "Account Owner", "text")


# ---------------------------------------------------------------------------
# Industry templates
# ---------------------------------------------------------------------------

def _water_template() -> dict:
    customers = TableDef(
        name="customers", display_name="Customers", icon="fa-building",
        description="Municipal, industrial, and commercial water customers.",
        primary_field="name",
        fields=[
            _f("name",            "Company / Site Name",  "text",    True),
            _f("type",            "Customer Type",        "select",  True,
               ["Municipal", "Industrial", "Commercial", "Residential", "Government"]),
            _f("contact_person",  "Contact Person",       "text",    True),
            _f("email",           "Email",                "email",   True),
            _f("phone",           "Phone",                "phone"),
            _f("address",         "Site Address",         "textarea"),
            _f("city",            "City",                 "text"),
            _f("water_source",    "Water Source",         "select",  False,
               ["Groundwater", "Surface Water", "Municipal Supply", "Seawater", "Brackish"]),
            _f("daily_volume_m3", "Daily Volume (m³/day)","number",  False, None,
               "Average daily water consumption or treatment volume."),
            _f("tds_ppm",         "Feed TDS (ppm)",       "number",  False, None,
               "Total dissolved solids of source water."),
            _f("meter_number",    "Meter / Account No.",  "text"),
            _COMMON_STATUS(["Active", "Prospect", "Inactive", "Suspended"]),
            _COMMON_OWNER,
            _COMMON_NOTES,
        ],
    )

    sites = TableDef(
        name="sites", display_name="Sites & Installations", icon="fa-industry",
        description="Physical plant locations and installed systems.",
        primary_field="site_name",
        fields=[
            _f("site_name",       "Site Name",            "text",    True),
            _f("customer_id",     "Customer",             "text",    True),
            _f("system_type",     "System Type",          "select",  True,
               ["RO System", "UF System", "Softener", "Dosing Station",
                "Storage Tank", "Pumping Station", "Mixed"]),
            _f("capacity_m3d",    "Capacity (m³/day)",    "number"),
            _f("install_date",    "Installation Date",    "date"),
            _f("last_service",    "Last Service Date",    "date"),
            _f("next_service",    "Next Service Due",     "date"),
            _f("coordinates",     "GPS Coordinates",      "text"),
            _f("status",          "Site Status",          "select",  True,
               ["Operational", "Maintenance", "Offline", "Commissioned", "Decommissioned"]),
            _COMMON_NOTES,
        ],
    )

    equipment = TableDef(
        name="equipment", display_name="Equipment", icon="fa-cog",
        description="Pumps, membranes, filters, and instrumentation.",
        primary_field="tag",
        fields=[
            _f("tag",             "Equipment Tag",        "text",    True),
            _f("name",            "Equipment Name",       "text",    True),
            _f("category",        "Category",             "select",  True,
               ["High-Pressure Pump", "Booster Pump", "RO Membrane",
                "Cartridge Filter", "Dosing Pump", "Flow Meter",
                "Pressure Gauge", "Control Panel", "UV Unit"]),
            _f("model",           "Model / Part No.",     "text"),
            _f("manufacturer",    "Manufacturer",         "text"),
            _f("site_id",         "Site",                 "text"),
            _f("serial_number",   "Serial Number",        "text"),
            _f("install_date",    "Installed On",         "date"),
            _f("warranty_expiry", "Warranty Expiry",      "date"),
            _f("running_hours",   "Running Hours",        "number"),
            _f("status",          "Status",               "select",  True,
               ["OK", "Needs Inspection", "Failed", "Replaced", "Decommissioned"]),
            _COMMON_NOTES,
        ],
    )

    service_orders = TableDef(
        name="service_orders", display_name="Service Orders", icon="fa-wrench",
        description="Maintenance visits, breakdowns, and preventive service.",
        primary_field="order_number",
        fields=[
            _f("order_number",    "Order #",              "text",    True),
            _f("customer_id",     "Customer",             "text",    True),
            _f("site_id",         "Site",                 "text"),
            _f("type",            "Service Type",         "select",  True,
               ["Preventive Maintenance", "Corrective Repair", "Installation",
                "Commissioning", "Inspection", "Membrane Replacement",
                "Chemical Cleaning", "Remote Support"]),
            _f("priority",        "Priority",             "select",  True,
               ["Low", "Medium", "High", "Critical"]),
            _f("scheduled_date",  "Scheduled Date",       "date",    True),
            _f("completed_date",  "Completed Date",       "date"),
            _f("technician",      "Assigned Technician",  "text"),
            _f("status",          "Status",               "select",  True,
               ["Open", "Scheduled", "In Progress", "Completed", "Cancelled"]),
            _f("labor_hours",     "Labor Hours",          "number"),
            _f("parts_used",      "Parts / Materials Used", "textarea"),
            _f("findings",        "Findings & Actions",   "textarea"),
            _COMMON_NOTES,
        ],
    )

    deals = TableDef(
        name="deals", display_name="Deals & Proposals", icon="fa-handshake",
        description="Sales pipeline — quotes and project proposals.",
        primary_field="title",
        fields=[
            _f("title",           "Deal Title",           "text",    True),
            _f("customer_id",     "Customer",             "text",    True),
            _f("system_type",     "Proposed System",      "select",  True,
               ["RO System", "UF System", "Softener", "Full Plant", "Service Contract"]),
            _f("capacity_m3d",    "Required Capacity (m³/day)", "number"),
            _f("feed_tds",        "Feed TDS (ppm)",       "number"),
            _f("value",           "Deal Value (USD)",     "currency"),
            _f("stage",           "Stage",                "select",  True,
               ["Lead", "Site Survey", "Proposal Sent", "Negotiation", "Won", "Lost"]),
            _f("probability",     "Win Probability (%)",  "number"),
            _f("close_date",      "Expected Close Date",  "date"),
            _COMMON_OWNER,
            _COMMON_NOTES,
        ],
    )

    measurements = TableDef(
        name="measurements", display_name="Water Quality Log", icon="fa-flask",
        description="Periodic TDS, pH, flow, and pressure readings per site.",
        primary_field="site_id",
        fields=[
            _f("site_id",         "Site",                 "text",    True),
            _f("reading_date",    "Reading Date",         "date",    True),
            _f("tds_feed",        "TDS Feed (ppm)",       "number"),
            _f("tds_permeate",    "TDS Permeate (ppm)",   "number"),
            _f("ph_feed",         "pH Feed",              "number"),
            _f("ph_permeate",     "pH Permeate",          "number"),
            _f("flow_feed",       "Feed Flow (m³/h)",     "number"),
            _f("flow_product",    "Product Flow (m³/h)",  "number"),
            _f("pressure_feed",   "Feed Pressure (bar)",  "number"),
            _f("pressure_reject", "Reject Pressure (bar)","number"),
            _f("recovery_pct",    "Recovery (%)",         "number"),
            _f("recorded_by",     "Recorded By",          "text"),
            _COMMON_NOTES,
        ],
    )

    contracts = TableDef(
        name="contracts", display_name="Service Contracts", icon="fa-file-contract",
        description="AMC and service agreements.",
        primary_field="contract_number",
        fields=[
            _f("contract_number", "Contract #",           "text",    True),
            _f("customer_id",     "Customer",             "text",    True),
            _f("type",            "Contract Type",        "select",  True,
               ["Annual Maintenance (AMC)", "Quarterly Service", "On-Call", "Supply & Install"]),
            _f("start_date",      "Start Date",           "date",    True),
            _f("end_date",        "End Date",             "date",    True),
            _f("value",           "Contract Value",       "currency"),
            _f("visits_per_year", "Visits / Year",        "number"),
            _f("status",          "Status",               "select",  True,
               ["Active", "Expired", "Pending Renewal", "Cancelled"]),
            _f("renewal_reminder","Renewal Reminder Date","date"),
            _COMMON_NOTES,
        ],
    )

    return dict(
        industry="water_utilities",
        industry_label="Water Treatment & Utilities",
        description="CRM designed for water treatment companies — covers plant installations, "
                    "RO/UF systems, service contracts, field maintenance, water quality logging, "
                    "and the sales pipeline for new projects.",
        tables=[customers, sites, equipment, service_orders, deals, measurements, contracts],
        relationships=[
            Relationship(from_table="sites",          to_table="customers",
                         type="one-to-many", label="belongs to",   foreign_key="customer_id"),
            Relationship(from_table="equipment",      to_table="sites",
                         type="one-to-many", label="installed at", foreign_key="site_id"),
            Relationship(from_table="service_orders", to_table="customers",
                         type="one-to-many", label="for customer", foreign_key="customer_id"),
            Relationship(from_table="service_orders", to_table="sites",
                         type="one-to-many", label="at site",      foreign_key="site_id"),
            Relationship(from_table="measurements",   to_table="sites",
                         type="one-to-many", label="logged at",    foreign_key="site_id"),
            Relationship(from_table="contracts",      to_table="customers",
                         type="one-to-many", label="with customer",foreign_key="customer_id"),
            Relationship(from_table="deals",          to_table="customers",
                         type="one-to-many", label="for customer", foreign_key="customer_id"),
        ],
        pipeline_stages=["Lead", "Site Survey", "Proposal Sent", "Negotiation", "Won", "Lost"],
        ui=UISuggestions(
            default_view="list",
            primary_table="customers",
            color_scheme="#0ea5e9",
            kanban_table="deals",
            kanban_stage_field="stage",
            dashboard_widgets=[
                DashboardWidget(title="Active Customers",    type="kpi",        source_table="customers",     field="status"),
                DashboardWidget(title="Open Service Orders", type="kpi",        source_table="service_orders", field="status"),
                DashboardWidget(title="Deal Pipeline Value", type="kpi",        source_table="deals",          field="value"),
                DashboardWidget(title="Deals by Stage",      type="chart_bar",  source_table="deals",          field="stage"),
                DashboardWidget(title="Service Orders / Month", type="chart_line", source_table="service_orders", field="scheduled_date"),
                DashboardWidget(title="Overdue Service",     type="list",       source_table="service_orders", field="scheduled_date",
                                description="Orders past scheduled date not completed."),
                DashboardWidget(title="Contracts Expiring Soon", type="list",   source_table="contracts",      field="end_date"),
                DashboardWidget(title="Customer Types",      type="chart_pie",  source_table="customers",      field="type"),
            ],
            list_columns={
                "customers":      ["name", "type", "city", "contact_person", "status"],
                "sites":          ["site_name", "customer_id", "system_type", "capacity_m3d", "status"],
                "equipment":      ["tag", "name", "category", "site_id", "status"],
                "service_orders": ["order_number", "customer_id", "type", "scheduled_date", "priority", "status"],
                "deals":          ["title", "customer_id", "system_type", "value", "stage", "close_date"],
                "measurements":   ["site_id", "reading_date", "tds_feed", "tds_permeate", "recovery_pct"],
                "contracts":      ["contract_number", "customer_id", "type", "end_date", "value", "status"],
            },
            form_sections={
                "customers":      [["name", "type"], ["contact_person", "email", "phone"],
                                   ["address", "city"], ["water_source", "daily_volume_m3", "tds_ppm"],
                                   ["status", "owner"], ["notes"]],
                "deals":          [["title", "customer_id"], ["system_type", "capacity_m3d", "feed_tds"],
                                   ["value", "probability", "close_date"], ["stage", "owner"], ["notes"]],
                "service_orders": [["order_number", "type"], ["customer_id", "site_id"],
                                   ["priority", "scheduled_date", "technician"],
                                   ["status", "completed_date", "labor_hours"],
                                   ["parts_used"], ["findings"], ["notes"]],
            },
        ),
    )


def _real_estate_template() -> dict:
    customers = TableDef(
        name="clients", display_name="Clients", icon="fa-user-tie",
        description="Buyers, sellers, renters, and landlords.",
        primary_field="name",
        fields=[
            _f("name",         "Full Name",       "text",    True),
            _f("type",         "Client Type",     "select",  True,
               ["Buyer", "Seller", "Tenant", "Landlord", "Investor"]),
            _f("email",        "Email",           "email",   True),
            _f("phone",        "Phone",           "phone",   True),
            _f("budget",       "Budget",          "currency"),
            _f("preferred_area","Preferred Area", "text"),
            _f("status",       "Status",          "select",  True,
               ["Active", "Closed", "Inactive"]),
            _COMMON_NOTES,
        ],
    )
    properties = TableDef(
        name="properties", display_name="Properties", icon="fa-home",
        description="Listings — for sale or rent.",
        primary_field="title",
        fields=[
            _f("title",        "Property Title",  "text",    True),
            _f("type",         "Type",            "select",  True,
               ["Apartment", "Villa", "Office", "Land", "Warehouse", "Retail"]),
            _f("listing_type", "Listing",         "select",  True, ["For Sale", "For Rent"]),
            _f("price",        "Price",           "currency", True),
            _f("area_sqm",     "Area (sqm)",      "number"),
            _f("bedrooms",     "Bedrooms",        "number"),
            _f("bathrooms",    "Bathrooms",       "number"),
            _f("address",      "Address",         "textarea"),
            _f("city",         "City",            "text"),
            _f("status",       "Status",          "select",  True,
               ["Available", "Under Offer", "Sold", "Rented", "Off Market"]),
            _COMMON_NOTES,
        ],
    )
    deals = TableDef(
        name="deals", display_name="Deals", icon="fa-handshake",
        description="Active transactions.",
        primary_field="title",
        fields=[
            _f("title",        "Deal Title",      "text",    True),
            _f("client_id",    "Client",          "text",    True),
            _f("property_id",  "Property",        "text",    True),
            _f("deal_type",    "Type",            "select",  True, ["Purchase", "Rental"]),
            _f("value",        "Deal Value",      "currency"),
            _f("commission",   "Commission",      "currency"),
            _f("stage",        "Stage",           "select",  True,
               ["Inquiry", "Viewing", "Offer Made", "Contract", "Closed", "Lost"]),
            _f("close_date",   "Target Close",    "date"),
            _COMMON_OWNER,
            _COMMON_NOTES,
        ],
    )
    return dict(
        industry="real_estate", industry_label="Real Estate",
        description="CRM for real estate agencies — clients, property listings, and deal pipeline.",
        tables=[customers, properties, deals],
        relationships=[
            Relationship(from_table="deals", to_table="clients",    type="one-to-many", label="for client",    foreign_key="client_id"),
            Relationship(from_table="deals", to_table="properties", type="one-to-many", label="for property",  foreign_key="property_id"),
        ],
        pipeline_stages=["Inquiry", "Viewing", "Offer Made", "Contract", "Closed", "Lost"],
        ui=UISuggestions(
            default_view="kanban", primary_table="deals", color_scheme="#10b981",
            kanban_table="deals", kanban_stage_field="stage",
            dashboard_widgets=[
                DashboardWidget(title="Active Listings",    type="kpi",       source_table="properties", field="status"),
                DashboardWidget(title="Open Deals",         type="kpi",       source_table="deals",      field="stage"),
                DashboardWidget(title="Pipeline Value",     type="kpi",       source_table="deals",      field="value"),
                DashboardWidget(title="Deals by Stage",     type="chart_bar", source_table="deals",      field="stage"),
                DashboardWidget(title="Properties by Type", type="chart_pie", source_table="properties", field="type"),
            ],
            list_columns={
                "clients":     ["name", "type", "phone", "budget", "status"],
                "properties":  ["title", "type", "listing_type", "price", "area_sqm", "city", "status"],
                "deals":       ["title", "client_id", "property_id", "value", "stage", "close_date"],
            },
            form_sections={
                "clients":     [["name", "type"], ["email", "phone"], ["budget", "preferred_area"], ["status"], ["notes"]],
                "properties":  [["title", "type", "listing_type"], ["price", "area_sqm"], ["bedrooms", "bathrooms"], ["address", "city"], ["status"], ["notes"]],
                "deals":       [["title", "deal_type"], ["client_id", "property_id"], ["value", "commission"], ["stage", "close_date", "owner"], ["notes"]],
            },
        ),
    )


def _manufacturing_template() -> dict:
    customers = TableDef(
        name="customers", display_name="Customers", icon="fa-industry",
        description="B2B buyers and distributors.",
        primary_field="name",
        fields=[
            _f("name",           "Company Name",       "text",    True),
            _f("contact_person", "Contact Person",     "text",    True),
            _f("email",          "Email",              "email",   True),
            _f("phone",          "Phone",              "phone"),
            _f("industry",       "Industry",           "text"),
            _f("annual_volume",  "Annual Order Volume","currency"),
            _COMMON_STATUS(["Active", "Prospect", "Inactive"]),
            _COMMON_OWNER, _COMMON_NOTES,
        ],
    )
    products = TableDef(
        name="products", display_name="Products", icon="fa-boxes",
        description="Product catalog.",
        primary_field="name",
        fields=[
            _f("sku",       "SKU",          "text",    True),
            _f("name",      "Product Name", "text",    True),
            _f("category",  "Category",     "text"),
            _f("unit_price","Unit Price",   "currency",True),
            _f("unit",      "Unit",         "select",  False, ["Piece", "Kg", "Meter", "Liter", "Box"]),
            _f("lead_days", "Lead Time (days)", "number"),
            _COMMON_NOTES,
        ],
    )
    deals = TableDef(
        name="deals", display_name="Opportunities", icon="fa-briefcase",
        description="Sales opportunities.",
        primary_field="title",
        fields=[
            _f("title",       "Opportunity",  "text",    True),
            _f("customer_id", "Customer",     "text",    True),
            _f("value",       "Value",        "currency",True),
            _f("stage",       "Stage",        "select",  True,
               ["Lead", "Qualified", "RFQ Received", "Quoted", "Negotiation", "Won", "Lost"]),
            _f("close_date",  "Close Date",   "date"),
            _COMMON_OWNER, _COMMON_NOTES,
        ],
    )
    return dict(
        industry="manufacturing", industry_label="Manufacturing",
        description="CRM for manufacturers — customers, product catalog, and B2B sales pipeline.",
        tables=[customers, products, deals],
        relationships=[
            Relationship(from_table="deals", to_table="customers", type="one-to-many", label="for customer", foreign_key="customer_id"),
        ],
        pipeline_stages=["Lead", "Qualified", "RFQ Received", "Quoted", "Negotiation", "Won", "Lost"],
        ui=UISuggestions(
            default_view="list", primary_table="customers", color_scheme="#f59e0b",
            kanban_table="deals", kanban_stage_field="stage",
            dashboard_widgets=[
                DashboardWidget(title="Active Customers", type="kpi",       source_table="customers", field="status"),
                DashboardWidget(title="Pipeline Value",   type="kpi",       source_table="deals",     field="value"),
                DashboardWidget(title="Deals by Stage",   type="chart_bar", source_table="deals",     field="stage"),
                DashboardWidget(title="Win Rate",         type="chart_pie", source_table="deals",     field="stage"),
            ],
            list_columns={
                "customers": ["name", "contact_person", "industry", "annual_volume", "status"],
                "products":  ["sku", "name", "category", "unit_price", "unit"],
                "deals":     ["title", "customer_id", "value", "stage", "close_date"],
            },
            form_sections={
                "customers": [["name", "contact_person"], ["email", "phone"], ["industry", "annual_volume"], ["status", "owner"], ["notes"]],
                "deals":     [["title", "customer_id"], ["value", "close_date"], ["stage", "owner"], ["notes"]],
            },
        ),
    )


def _generic_template(industry_hint: str) -> dict:
    customers = TableDef(
        name="customers", display_name="Customers", icon="fa-users",
        description="Customer and prospect accounts.",
        primary_field="name",
        fields=[
            _f("name",           "Company / Name",   "text",    True),
            _f("contact_person", "Contact Person",   "text"),
            _f("email",          "Email",            "email",   True),
            _f("phone",          "Phone",            "phone"),
            _f("website",        "Website",          "url"),
            _f("industry",       "Industry",         "text"),
            _COMMON_STATUS(["Lead", "Active", "Inactive", "Churned"]),
            _COMMON_OWNER, _COMMON_NOTES,
        ],
    )
    deals = TableDef(
        name="deals", display_name="Deals", icon="fa-dollar-sign",
        description="Revenue opportunities.",
        primary_field="title",
        fields=[
            _f("title",       "Deal Title",  "text",    True),
            _f("customer_id", "Customer",    "text",    True),
            _f("value",       "Value",       "currency"),
            _f("stage",       "Stage",       "select",  True,
               ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]),
            _f("close_date",  "Close Date",  "date"),
            _COMMON_OWNER, _COMMON_NOTES,
        ],
    )
    activities = TableDef(
        name="activities", display_name="Activities", icon="fa-calendar-check",
        description="Calls, emails, meetings, and tasks.",
        primary_field="title",
        fields=[
            _f("title",       "Activity",    "text",    True),
            _f("type",        "Type",        "select",  True,
               ["Call", "Email", "Meeting", "Task", "Demo"]),
            _f("customer_id", "Customer",    "text"),
            _f("deal_id",     "Deal",        "text"),
            _f("due_date",    "Due Date",    "date",    True),
            _f("completed",   "Completed",   "boolean"),
            _COMMON_OWNER, _COMMON_NOTES,
        ],
    )
    return dict(
        industry="general", industry_label=f"General CRM ({industry_hint})",
        description=f"Standard CRM schema for a {industry_hint} business.",
        tables=[customers, deals, activities],
        relationships=[
            Relationship(from_table="deals",      to_table="customers", type="one-to-many", label="for customer",  foreign_key="customer_id"),
            Relationship(from_table="activities",  to_table="customers", type="one-to-many", label="for customer",  foreign_key="customer_id"),
            Relationship(from_table="activities",  to_table="deals",     type="one-to-many", label="linked to deal", foreign_key="deal_id"),
        ],
        pipeline_stages=["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"],
        ui=UISuggestions(
            default_view="kanban", primary_table="customers", color_scheme="#6366f1",
            kanban_table="deals", kanban_stage_field="stage",
            dashboard_widgets=[
                DashboardWidget(title="Total Customers",   type="kpi",        source_table="customers",  field="status"),
                DashboardWidget(title="Pipeline Value",    type="kpi",        source_table="deals",      field="value"),
                DashboardWidget(title="Deals by Stage",    type="chart_bar",  source_table="deals",      field="stage"),
                DashboardWidget(title="Upcoming Tasks",    type="list",       source_table="activities", field="due_date"),
            ],
            list_columns={
                "customers":  ["name", "contact_person", "email", "status"],
                "deals":      ["title", "customer_id", "value", "stage", "close_date"],
                "activities": ["title", "type", "customer_id", "due_date", "completed"],
            },
            form_sections={
                "customers": [["name", "contact_person"], ["email", "phone", "website"], ["industry", "status", "owner"], ["notes"]],
                "deals":     [["title", "customer_id"], ["value", "close_date"], ["stage", "owner"], ["notes"]],
                "activities":[["title", "type"], ["customer_id", "deal_id"], ["due_date", "completed", "owner"], ["notes"]],
            },
        ),
    )


# ---------------------------------------------------------------------------
# Industry detector
# ---------------------------------------------------------------------------

_INDUSTRY_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(water|desalin|ro\s*system|reverse\s*osmosis|treatment\s*plant|utilities|utility|membrane|tds|brine)\b", re.I), "water"),
    (re.compile(r"\b(real\s*estate|property|realt|housing|apartment|villa|rent|landlord|tenant)\b", re.I), "real_estate"),
    (re.compile(r"\b(manufactur|factory|production|assembly|industrial|fabricat)\b", re.I), "manufacturing"),
    (re.compile(r"\b(health|clinic|hospital|patient|medical|pharma|doctor|lab)\b", re.I), "generic"),
    (re.compile(r"\b(software|saas|tech|startup|app|subscription|cloud)\b", re.I), "generic"),
]


def _detect_industry(description: str) -> str:
    for pattern, industry in _INDUSTRY_MAP:
        if pattern.search(description):
            return industry
    return "generic"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_crm_schema(description: str) -> CRMSchema:
    """
    Generate a CRM schema from a plain-text business description.

    Args:
        description: e.g. "Design CRM for water treatment company in Egypt"

    Returns:
        CRMSchema — fully specified tables, fields, relationships, UI hints.
    """
    industry = _detect_industry(description)

    builders = {
        "water":         _water_template,
        "real_estate":   _real_estate_template,
        "manufacturing": _manufacturing_template,
    }

    data = builders.get(industry, lambda: _generic_template(description))()
    return CRMSchema(**data)
