"""
Rule-based command parser.

Accepts two input forms:

1. Key=value string (preferred, unambiguous):
       create_customer name="John Doe" email=john@acme.com company="Acme Corp"

2. Natural language (best-effort):
       create a customer named John Doe with email john@acme.com
       find customer john
       list customers
       create deal titled Big Project for customer 3 value 50000

Returns a ParsedCommand with the resolved tool name and extracted params dict.
"""

import re
import shlex
from dataclasses import dataclass, field


@dataclass
class ParsedCommand:
    tool: str | None
    params: dict[str, str]
    raw: str
    confidence: float           # 1.0 = exact match, 0.5 = heuristic
    error: str | None = None


# ---------------------------------------------------------------------------
# Intent table — ordered by specificity (most specific first)
# ---------------------------------------------------------------------------

_INTENT_PATTERNS: list[tuple[re.Pattern, str]] = [
    # explicit tool name at start
    (re.compile(r"^(create_customer|find_customer|list_customers|create_deal|list_deals|generate_crm_schema)\b", re.I), "__verbatim__"),

    # CRM designer — check before generic patterns
    (re.compile(r"\b(design|generate|build|create)\b.{0,25}\bcrm\b", re.I), "generate_crm_schema"),
    (re.compile(r"\bcrm\b.{0,25}\b(design|schema|structure|blueprint|template)\b", re.I), "generate_crm_schema"),

    # natural language — deals first (more specific than generic "list")
    (re.compile(r"\b(create|add|new)\b.{0,15}\bdeal\b", re.I),            "create_deal"),
    (re.compile(r"\b(list|show|all|display)\b.{0,15}\bdeal", re.I),       "list_deals"),

    # natural language — customers
    (re.compile(r"\b(create|add|new)\b.{0,15}\bcustomer\b", re.I),        "create_customer"),
    (re.compile(r"\b(find|search|look\s*up|get)\b.{0,15}\bcustomer\b", re.I), "find_customer"),
    (re.compile(r"\b(list|show|all|display)\b.{0,15}\bcustomer", re.I),   "list_customers"),
]

# ---------------------------------------------------------------------------
# Key=value extractor — handles: key=value  key="quoted value"  key='v'
# ---------------------------------------------------------------------------

_KV_RE = re.compile(r'(\w+)=(?:"([^"]*?)"|\'([^\']*?)\'|(\S+))')


def _extract_kv(text: str) -> dict[str, str]:
    return {
        m.group(1).lower(): m.group(2) or m.group(3) or m.group(4)
        for m in _KV_RE.finditer(text)
    }


# ---------------------------------------------------------------------------
# Natural-language param extractors per tool
# ---------------------------------------------------------------------------

_EMAIL_RE   = re.compile(r"\b[\w.+-]+@[\w.-]+\.\w+\b")
_FLOAT_RE   = re.compile(r"\b(\d[\d,]*(?:\.\d+)?)\b")
_INT_RE     = re.compile(r"\b(\d+)\b")


def _nl_create_customer(text: str) -> dict[str, str]:
    params: dict[str, str] = {}

    email_m = _EMAIL_RE.search(text)
    if email_m:
        params["email"] = email_m.group()
        text = text[:email_m.start()] + text[email_m.end():]

    for pat, key in [
        (re.compile(r"named?\s+([A-Za-z][\w .'-]{1,50}?)(?:\s+(?:with|from|at|email|phone|company|$))", re.I), "name"),
        (re.compile(r"company\s+(?:is\s+)?['\"]?([^'\"]+?)['\"]?(?:\s+(?:with|phone|email|notes|$))", re.I), "company"),
        (re.compile(r"phone\s+(?:is\s+)?([\d\s+\-().]{5,20})", re.I), "phone"),
    ]:
        m = pat.search(text)
        if m:
            params.setdefault(key, m.group(1).strip())

    return params


def _nl_find_customer(text: str) -> dict[str, str]:
    clean = re.sub(r"\b(find|search|look\s*up|get|customer|named?|for)\b", "", text, flags=re.I).strip()
    return {"query": clean} if clean else {}


def _nl_list_customers(text: str) -> dict[str, str]:
    m = re.search(r"\b(\d+)\b", text)
    return {"limit": m.group(1)} if m else {}


def _nl_create_deal(text: str) -> dict[str, str]:
    params: dict[str, str] = {}
    for pat, key in [
        (re.compile(r"titled?\s+['\"]?(.+?)['\"]?\s+(?:for|value|customer|stage|$)", re.I), "title"),
        (re.compile(r"customer\s+(?:id\s+)?#?(\d+)", re.I), "customer_id"),
        (re.compile(r"value\s+(?:of\s+)?([\d,]+(?:\.\d+)?)", re.I), "value"),
        (re.compile(r"stage\s+(?:is\s+)?(\w+)", re.I), "stage"),
    ]:
        m = pat.search(text)
        if m:
            params[key] = m.group(1).strip().replace(",", "")
    return params


def _nl_list_deals(text: str) -> dict[str, str]:
    params: dict[str, str] = {}
    m = re.search(r"customer\s+(?:id\s+)?#?(\d+)", text, re.I)
    if m:
        params["customer_id"] = m.group(1)
    m2 = re.search(r"stage\s+(?:is\s+)?(\w+)", text, re.I)
    if m2:
        params["stage"] = m2.group(1)
    return params


def _nl_generate_crm_schema(text: str) -> dict[str, str]:
    # Strip leading action words; keep the business description as-is
    clean = re.sub(
        r"^(generate_crm_schema|design|generate|build|create|make)\s*(a\s+)?(crm\s*)?(schema|blueprint|template|structure|for)?\s*",
        "", text, flags=re.I,
    ).strip()
    return {"description": clean or text}


_NL_EXTRACTORS = {
    "create_customer":     _nl_create_customer,
    "find_customer":       _nl_find_customer,
    "list_customers":      _nl_list_customers,
    "create_deal":         _nl_create_deal,
    "list_deals":          _nl_list_deals,
    "generate_crm_schema": _nl_generate_crm_schema,
}


# ---------------------------------------------------------------------------
# Public parse function
# ---------------------------------------------------------------------------

def parse_command(raw: str) -> ParsedCommand:
    text = raw.strip()
    if not text:
        return ParsedCommand(tool=None, params={}, raw=raw, confidence=0.0, error="Empty command.")

    # --- detect intent ---
    tool: str | None = None
    confidence = 0.0
    verbatim = False

    for pattern, intent in _INTENT_PATTERNS:
        m = pattern.search(text)
        if m:
            if intent == "__verbatim__":
                tool = m.group(1).lower()
                verbatim = True
                confidence = 1.0
            else:
                tool = intent
                confidence = 0.85
            break

    if tool is None:
        return ParsedCommand(tool=None, params={}, raw=raw, confidence=0.0,
                             error="Could not determine intent. "
                                   "Try: 'create customer name=X email=Y' or 'list customers'.")

    # --- extract params ---
    # Strip the matched tool keyword from the front when verbatim
    body = re.sub(rf"^{re.escape(tool)}\s*", "", text, flags=re.I).strip() if verbatim else text

    # Always prefer key=value pairs; fall back to NL extractor
    params = _extract_kv(body)
    if not params and tool in _NL_EXTRACTORS:
        params = _NL_EXTRACTORS[tool](body)
        confidence = min(confidence, 0.7)

    return ParsedCommand(tool=tool, params=params, raw=raw, confidence=confidence)
