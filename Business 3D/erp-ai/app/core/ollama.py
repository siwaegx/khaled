"""
Ollama HTTP client — thin wrapper around the Ollama REST API.

Handles:
  - /api/tags       → list models / health check
  - /api/chat       → chat completions with optional native tool calling
  - Connection errors and timeouts → raises OllamaUnavailable
"""

import json
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class OllamaUnavailable(RuntimeError):
    """Raised when Ollama cannot be reached or times out."""


@dataclass
class ToolCall:
    name: str
    arguments: dict[str, Any]


@dataclass
class ChatResponse:
    content: str                        # text reply (may be empty if tool_calls present)
    tool_calls: list[ToolCall] = field(default_factory=list)
    model: str = ""
    raw: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class OllamaClient:
    def __init__(self):
        s = get_settings()
        self.base_url = s.OLLAMA_BASE_URL.rstrip("/")
        self.model = s.OLLAMA_MODEL
        self.timeout = s.OLLAMA_TIMEOUT

    def _post(self, path: str, body: dict) -> dict:
        url = f"{self.base_url}{path}"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, json=body)
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as e:
            raise OllamaUnavailable(f"Cannot connect to Ollama at {self.base_url}: {e}") from e
        except httpx.TimeoutException as e:
            raise OllamaUnavailable(f"Ollama request timed out after {self.timeout}s") from e
        except httpx.HTTPStatusError as e:
            raise OllamaUnavailable(f"Ollama HTTP error {e.response.status_code}: {e.response.text}") from e

    def _get(self, path: str) -> dict:
        url = f"{self.base_url}{path}"
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.get(url)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            raise OllamaUnavailable(str(e)) from e

    # ------------------------------------------------------------------

    def health(self) -> dict:
        """Returns {"status": "ok", "models": [...]} or raises OllamaUnavailable."""
        data = self._get("/api/tags")
        models = [m["name"] for m in data.get("models", [])]
        return {"status": "ok", "models": models}

    def chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
    ) -> ChatResponse:
        """
        Send a chat request to Ollama.

        Args:
            messages: List of {role, content} dicts.
            tools:    Optional OpenAI-style tool schemas for native tool calling.
            model:    Override model (defaults to config OLLAMA_MODEL).

        Returns:
            ChatResponse with .content and .tool_calls populated.
        """
        body: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "stream": False,
        }
        if tools:
            body["tools"] = tools

        logger.debug("ollama_request", model=body["model"], messages=len(messages), tools=len(tools or []))
        raw = self._post("/api/chat", body)
        logger.debug("ollama_response_raw", keys=list(raw.keys()))

        message = raw.get("message", {})
        content = message.get("content", "") or ""
        raw_tool_calls = message.get("tool_calls", []) or []

        tool_calls: list[ToolCall] = []
        for tc in raw_tool_calls:
            fn = tc.get("function", {})
            name = fn.get("name", "")
            args = fn.get("arguments", {})
            # Ollama may return args as a JSON string
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}
            if name:
                tool_calls.append(ToolCall(name=name, arguments=args))

        return ChatResponse(
            content=content.strip(),
            tool_calls=tool_calls,
            model=raw.get("model", body["model"]),
            raw=raw,
        )


_client: OllamaClient | None = None


def get_ollama() -> OllamaClient:
    global _client
    if _client is None:
        _client = OllamaClient()
    return _client
