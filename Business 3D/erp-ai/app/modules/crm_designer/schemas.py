from pydantic import BaseModel


class FieldDef(BaseModel):
    name: str
    label: str
    type: str           # text | number | email | phone | date | select | boolean | currency | textarea | url
    required: bool = False
    options: list[str] | None = None   # for select fields
    description: str = ""


class TableDef(BaseModel):
    name: str
    display_name: str
    icon: str
    description: str
    fields: list[FieldDef]
    primary_field: str  # field used as display label in relations


class Relationship(BaseModel):
    from_table: str
    to_table: str
    type: str           # one-to-many | many-to-many | one-to-one
    label: str
    foreign_key: str    # field on from_table that holds the relation


class DashboardWidget(BaseModel):
    title: str
    type: str           # kpi | chart_bar | chart_line | chart_pie | list | kanban
    source_table: str
    field: str | None = None
    description: str = ""


class UISuggestions(BaseModel):
    default_view: str           # list | kanban | calendar
    primary_table: str          # which table to show on landing
    color_scheme: str           # suggested accent (CSS color name or hex)
    dashboard_widgets: list[DashboardWidget]
    list_columns: dict[str, list[str]]    # table → columns to show in list view
    kanban_table: str | None = None
    kanban_stage_field: str | None = None
    form_sections: dict[str, list[list[str]]]  # table → [[row of field names]]


class CRMSchema(BaseModel):
    industry: str
    industry_label: str
    description: str
    tables: list[TableDef]
    relationships: list[Relationship]
    pipeline_stages: list[str]
    ui: UISuggestions
