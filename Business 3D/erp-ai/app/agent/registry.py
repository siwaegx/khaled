"""
Tool registry — the single source of truth for what the agent can do.

Usage:
    @registry.register(
        name="my_tool",
        description="Does something",
        params=["param_a", "param_b"],
        required=["param_a"],
    )
    def my_tool(param_a: str, param_b: str | None = None, **ctx):
        ...
"""

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class ToolSpec:
    name: str
    description: str
    params: list[str]           # all accepted param names
    required: list[str]         # params that must be present
    fn: Callable[..., Any]


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, ToolSpec] = {}

    def register(self, name: str, description: str,
                 params: list[str], required: list[str] | None = None):
        def decorator(fn: Callable) -> Callable:
            self._tools[name] = ToolSpec(
                name=name,
                description=description,
                params=params,
                required=required or [],
                fn=fn,
            )
            return fn
        return decorator

    def get(self, name: str) -> ToolSpec | None:
        return self._tools.get(name)

    def all(self) -> list[ToolSpec]:
        return list(self._tools.values())

    def names(self) -> list[str]:
        return list(self._tools.keys())


registry = ToolRegistry()
