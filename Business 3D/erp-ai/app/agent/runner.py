"""
Agent runner — ties parser → registry → tool execution together.

The runner:
1. Parses the raw command into (tool_name, params).
2. Validates required params against the tool spec.
3. Injects the DB session into the call context.
4. Executes the tool and returns a structured AgentResult.
"""

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.agent import tools as _tools_module  # noqa: F401 — side-effect: registers tools
from app.agent.parser import parse_command
from app.agent.registry import registry


@dataclass
class AgentResult:
    status: str                        # "success" | "error" | "clarification_needed"
    tool: str | None
    params: dict[str, Any]
    result: dict[str, Any] | None
    message: str
    confidence: float


def run(command: str, db: Session) -> AgentResult:
    parsed = parse_command(command)

    if parsed.error or parsed.tool is None:
        return AgentResult(
            status="error",
            tool=None,
            params={},
            result=None,
            message=parsed.error or "Could not parse command.",
            confidence=0.0,
        )

    spec = registry.get(parsed.tool)
    if spec is None:
        return AgentResult(
            status="error",
            tool=parsed.tool,
            params=parsed.params,
            result=None,
            message=f"Unknown tool '{parsed.tool}'. Available: {', '.join(registry.names())}",
            confidence=parsed.confidence,
        )

    missing = [r for r in spec.required if r not in parsed.params or not parsed.params[r]]
    if missing:
        return AgentResult(
            status="clarification_needed",
            tool=parsed.tool,
            params=parsed.params,
            result=None,
            message=f"Missing required params for '{parsed.tool}': {', '.join(missing)}.",
            confidence=parsed.confidence,
        )

    try:
        output = spec.fn(**parsed.params, _db=db)
    except Exception as exc:
        return AgentResult(
            status="error",
            tool=parsed.tool,
            params=parsed.params,
            result=None,
            message=f"Tool execution failed: {exc}",
            confidence=parsed.confidence,
        )

    has_error = isinstance(output, dict) and "error" in output
    return AgentResult(
        status="error" if has_error else "success",
        tool=parsed.tool,
        params=parsed.params,
        result=output,
        message=output.get("error", f"Tool '{parsed.tool}' executed successfully.") if isinstance(output, dict) else str(output),
        confidence=parsed.confidence,
    )
