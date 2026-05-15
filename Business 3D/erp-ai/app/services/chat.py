"""
Rule-based chat handler.

Detects intent from the message text, extracts parameters,
and dispatches to the appropriate domain engine.
"""

import re
from dataclasses import dataclass
from typing import Any

from app.modules.ro.engine import design_ro_system


# ---------------------------------------------------------------------------
# Intent detection
# ---------------------------------------------------------------------------

_RO_KEYWORDS = re.compile(
    r"\b(ro|reverse osmosis|membrane|desalin|water treatment|tds|m3|m³|permeate)\b",
    re.IGNORECASE,
)

_GREETING_KEYWORDS = re.compile(r"^(hi|hello|hey|greetings|salut)\b", re.IGNORECASE)


def _detect_intent(message: str) -> str:
    if _GREETING_KEYWORDS.match(message.strip()):
        return "greeting"
    if _RO_KEYWORDS.search(message):
        return "ro_design"
    return "unknown"


# ---------------------------------------------------------------------------
# Parameter extraction from natural language
# ---------------------------------------------------------------------------

_FLOW_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:m3|m³|cubic\s*met(?:re|er)s?)(?:\s*/\s*(?:day|d))?",
    re.IGNORECASE,
)

_TDS_PATTERN = re.compile(
    r"(?:tds|salinity|total\s+dissolved\s+solids)[^\d]*(\d+(?:\.\d+)?)\s*(?:ppm|mg/l|mgl)?|"
    r"(\d+(?:\.\d+)?)\s*(?:ppm|mg/l)\b",
    re.IGNORECASE,
)


def _extract_ro_params(message: str, params: dict) -> tuple[float | None, int | None]:
    flow = params.get("flow_rate") or params.get("flow")
    tds = params.get("tds")

    if flow is None:
        m = _FLOW_PATTERN.search(message)
        if m:
            flow = float(m.group(1))

    if tds is None:
        m = _TDS_PATTERN.search(message)
        if m:
            raw = m.group(1) or m.group(2)
            tds = int(float(raw))

    return (float(flow) if flow is not None else None,
            int(tds) if tds is not None else None)


# ---------------------------------------------------------------------------
# Response dataclass
# ---------------------------------------------------------------------------

@dataclass
class ChatResponse:
    intent: str
    message: str
    data: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Handler entry point
# ---------------------------------------------------------------------------

def handle_message(message: str, params: dict | None = None) -> ChatResponse:
    params = params or {}
    intent = _detect_intent(message)

    if intent == "greeting":
        return ChatResponse(
            intent="greeting",
            message="Hello! I can design RO water treatment systems. "
                    "Tell me the required flow rate (m3/day) and feed TDS (ppm).",
        )

    if intent == "ro_design":
        flow, tds = _extract_ro_params(message, params)

        missing = []
        if flow is None:
            missing.append("flow_rate (m3/day)")
        if tds is None:
            missing.append("tds (ppm)")

        if missing:
            return ChatResponse(
                intent="ro_design",
                message=f"I need the following to design the system: {', '.join(missing)}. "
                        "Example: 'Design an RO system for 100 m3/day, TDS 3000 ppm'.",
            )

        result = design_ro_system(flow_rate=flow, tds=tds)
        d = result.as_dict()

        summary = (
            f"RO system for {flow} m3/day product water from {tds} ppm feed:\n"
            f"  • Water class:  {result.water_class}\n"
            f"  • Membranes:    {result.membrane_count} × {result.membrane_model} "
            f"in {result.vessels} pressure vessels\n"
            f"  • Recovery:     {result.recovery_pct}%\n"
            f"  • Pressure:     {result.operating_pressure_bar} bar\n"
            f"  • Pump duty:    {result.pump_kw} kW ({result.pump_hp} HP)"
        )
        if result.notes:
            summary += "\n  Notes:\n" + "".join(f"    - {n}\n" for n in result.notes)

        return ChatResponse(intent="ro_design", message=summary, data=d)

    return ChatResponse(
        intent="unknown",
        message="I didn't understand that. I can design RO water treatment systems. "
                "Try: 'Design an RO system for 50 m3/day with TDS 1500 ppm'.",
    )
