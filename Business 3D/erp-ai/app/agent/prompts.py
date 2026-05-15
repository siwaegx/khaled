"""
Builds the system prompt and OpenAI-style tool schemas sent to Ollama.
"""

from datetime import date

from app.agent.registry import ToolRegistry

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an intelligent assistant for an AI ERP/CRM system.
You help users manage customers, deals, water treatment systems, and CRM schemas.

Today's date: {today}

## Your capabilities
- Create, find, and list CRM customers
- Create and list sales deals
- Generate CRM schemas for any industry (water, real estate, manufacturing, etc.)

## Tool use rules
- When the user asks you to perform an action, call the appropriate tool.
- Extract ALL relevant parameters from the user's message before calling the tool.
- If a REQUIRED parameter is missing and cannot be inferred, ask the user for it instead of guessing.
- For generate_crm_schema, pass the user's full business description as the `description` param.
- When a user just greets you or asks a general question, respond conversationally — do NOT call a tool.

## Response format
- Keep replies concise and professional.
- After a successful tool call, briefly summarise the result in one or two sentences.
- If you cannot help with something, say so clearly.
"""


def build_system_prompt() -> str:
    return SYSTEM_PROMPT.format(today=date.today().isoformat())


# ---------------------------------------------------------------------------
# Tool schema builder (OpenAI / Ollama function-calling format)
# ---------------------------------------------------------------------------

# Type hints for each known parameter — improves LLM accuracy
_PARAM_TYPES: dict[str, dict] = {
    "name":        {"type": "string",  "description": "Full name of the customer or entity."},
    "email":       {"type": "string",  "description": "Valid email address."},
    "phone":       {"type": "string",  "description": "Phone number including country code."},
    "company":     {"type": "string",  "description": "Company or organisation name."},
    "notes":       {"type": "string",  "description": "Free-text notes or comments."},
    "query":       {"type": "string",  "description": "Search term — name, email, or company."},
    "limit":       {"type": "integer", "description": "Maximum number of results to return."},
    "title":       {"type": "string",  "description": "Title or name of the deal."},
    "customer_id": {"type": "integer", "description": "Numeric ID of the customer."},
    "value":       {"type": "number",  "description": "Monetary value of the deal in USD."},
    "stage":       {"type": "string",  "description": "Deal stage: lead | qualified | proposal | negotiation | won | lost"},
    "description": {"type": "string",  "description": "Plain-text description of the business or use case."},
}

_DEFAULT_PARAM = {"type": "string"}


def build_tool_schemas(registry: ToolRegistry) -> list[dict]:
    schemas = []
    for tool in registry.all():
        properties = {
            p: _PARAM_TYPES.get(p, {**_DEFAULT_PARAM, "description": f"Value for {p}."})
            for p in tool.params
        }
        schemas.append({
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": tool.required,
                },
            },
        })
    return schemas
