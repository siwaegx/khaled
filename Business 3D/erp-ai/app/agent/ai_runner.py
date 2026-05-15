"""
AI-powered agent runner — Ollama + persistent memory + governance layer.

Flow per request:
  1. Record user message in memory
  2. Pull conversation history + relevant context from memory
  3. Inject memory context into system prompt
  4. Call Ollama with history + tool schemas
  5. If tool_call  → GovernedExecutor (logs, approval gate, snapshots)
  6. If text reply → record directly
  7. On OllamaUnavailable → rule-based fallback
"""

from sqlalchemy.orm import Session

from app.agent import tools as _tools_module  # noqa: F401 — registers all tools
from app.agent.prompts import build_system_prompt, build_tool_schemas
from app.agent.registry import registry
from app.agent.runner import AgentResult, run as rules_run
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.ollama import OllamaUnavailable, get_ollama
from app.governance.executor import GovernedExecutor
from app.memory.manager import MemoryManager

logger = get_logger(__name__)


def run_ai(command: str, db: Session, session_id: str = "default") -> AgentResult:
    settings = get_settings()
    memory = MemoryManager(db)
    executor = GovernedExecutor(db)

    # 1. Persist user message + auto-extract facts
    memory.record_user_message(session_id, command)

    # 2. Build system prompt with injected memory context
    context_block = memory.get_context_for_ai(query=command, session_id=session_id)
    system_content = build_system_prompt()
    if context_block.strip():
        system_content += f"\n\n## Memory Context\n{context_block}"

    # 3. Reconstruct conversation for Ollama
    history = memory.get_ollama_messages(session_id, limit=20)
    messages = [{"role": "system", "content": system_content}] + history
    tool_schemas = build_tool_schemas(registry)

    # 4. Call Ollama
    try:
        response = get_ollama().chat(messages=messages, tools=tool_schemas)
    except OllamaUnavailable as exc:
        logger.warning("ollama_unavailable", error=str(exc))
        if settings.OLLAMA_FALLBACK_TO_RULES:
            result = rules_run(command=command, db=db)
            result.message = f"[rule-based fallback] {result.message}"
            memory.record_assistant_message(session_id, result.message)
            return result
        return AgentResult(
            status="error", tool=None, params={}, result=None,
            message=f"AI engine unavailable: {exc}. Is Ollama running? Try: ollama serve",
            confidence=0.0,
        )

    # 5. Tool call path
    if response.tool_calls:
        tc = response.tool_calls[0]
        logger.info("ai_tool_call", tool=tc.name, params=list(tc.arguments.keys()),
                    session=session_id)

        spec = registry.get(tc.name)
        if spec is None:
            msg = f"LLM requested unknown tool '{tc.name}'."
            memory.record_assistant_message(session_id, msg)
            return AgentResult(status="error", tool=tc.name, params=tc.arguments,
                               result=None, message=msg, confidence=1.0)

        missing = [r for r in spec.required if r not in tc.arguments]
        if missing:
            msg = f"I need more information: {', '.join(missing)}."
            memory.record_assistant_message(session_id, msg)
            return AgentResult(status="clarification_needed", tool=tc.name,
                               params=tc.arguments, result=None, message=msg, confidence=0.9)

        # 6. Execute via governance layer
        exec_result = executor.execute(tc.name, tc.arguments, session_id)

        if exec_result.status == "pending_approval":
            memory.record_assistant_message(session_id, exec_result.message)
            return AgentResult(
                status="pending_approval",
                tool=tc.name,
                params=tc.arguments,
                result=exec_result.output,
                message=exec_result.message,
                confidence=1.0,
            )

        summary = (_summarise(tc.name, exec_result.output, tc.arguments)
                   if exec_result.status == "success" and exec_result.output
                   else exec_result.message)

        if exec_result.status == "success":
            memory.record_action(
                session_id=session_id,
                tool_name=tc.name,
                params=tc.arguments,
                result=exec_result.output or {},
                summary=summary,
            )
        memory.record_assistant_message(session_id, summary)

        return AgentResult(
            status=exec_result.status,
            tool=tc.name,
            params=tc.arguments,
            result=exec_result.output,
            message=summary,
            confidence=1.0,
        )

    # 7. Conversational reply
    reply = response.content or "I'm not sure how to help with that."
    memory.record_assistant_message(session_id, reply)
    return AgentResult(status="success", tool=None, params={}, result=None,
                       message=reply, confidence=1.0)


def clear_session(session_id: str, db: Session) -> int:
    return MemoryManager(db).clear_session(session_id)


# ---------------------------------------------------------------------------
# Human-readable summaries
# ---------------------------------------------------------------------------

def _summarise(tool: str, output: dict, params: dict) -> str:
    if tool == "create_customer":
        return f"Customer '{output.get('name')}' (ID: {output.get('id')}) created."
    if tool == "find_customer":
        n = output.get("count", 0)
        names = [c["name"] for c in output.get("customers", [])[:3]]
        return f"Found {n} customer(s): {', '.join(names)}." if names else "No customers found."
    if tool == "list_customers":
        n = output.get("count", 0)
        names = [c["name"] for c in output.get("customers", [])[:5]]
        return f"{n} customer(s): {', '.join(names)}." if names else "No customers found."
    if tool == "create_deal":
        return (f"Deal '{output.get('title')}' created for customer "
                f"{output.get('customer_id')} at stage '{output.get('stage')}'.")
    if tool == "list_deals":
        n = output.get("count", 0)
        titles = [d["title"] for d in output.get("deals", [])[:3]]
        return f"{n} deal(s): {', '.join(titles)}." if titles else "No deals found."
    if tool == "generate_crm_schema":
        tables = [t["name"] for t in output.get("tables", [])]
        return f"CRM schema: {len(tables)} tables — {', '.join(tables)}."
    return f"Tool '{tool}' completed."
