from __future__ import annotations

"""
Agent Abstractions (foundation).

This module defines the minimal *interface layer* for "agent-like" behaviors on top
of the existing LLM strategy pattern (`app.llm.strategy.LLMStrategy`).

It is intentionally **additive** and contains *no concrete implementations* yet.
The goal is to provide stable Protocols and configuration objects so future work
can introduce single-agent orchestration, tool-use, and eventually multi-agent
coordination without forcing downstream code to depend on provider-specific APIs.
"""

from dataclasses import dataclass
from typing import Any, Protocol

from app.llm.strategy import LLMStrategy


class AgentCapability(Protocol):
    """Agent-like building blocks.

    These capabilities are deliberately generic. Implementations may:
    - call an LLM strategy for reasoning / planning,
    - use tools for step execution,
    - maintain state and memory across iterations.

    The concrete wiring (tools, persistence, retries) will be added in later RFCs.
    """

    def think(self, context: str, task: str) -> str:
        """Perform a reasoning step given the current context and task."""

        ...

    def plan(self, goal: str, constraints: list[str]) -> list[str]:
        """Decompose a goal into a list of executable steps."""

        ...

    def execute_step(self, step: str, context: dict[str, Any]) -> dict[str, Any]:
        """Execute a single step and return a structured result."""

        ...


@dataclass(frozen=True, slots=True)
class AgentConfig:
    """Base configuration shared by all agents.

    Notes:
        - `strategy` is a reference to an `LLMStrategy` implementation and is the
          primary extension point for swapping providers/models.
        - `max_iterations` limits the number of reasoning/execution loops an agent
          may perform when implementing iterative behaviors.
        - `system_prompt` is an optional, higher-level instruction that can be
          applied to the underlying LLM calls by the agent implementation.
    """

    name: str
    strategy: LLMStrategy
    max_iterations: int = 10
    system_prompt: str = ""


class Agent(Protocol):
    """Foundation interface for an executable agent.

    This Protocol is designed as a future-proof contract for "agent runners" that
    may grow into multi-agent systems, shared memory, and tool orchestration. For
    now it formalizes:
    - a strongly-typed `config`,
    - a main `run()` entry point,
    - a lightweight conversation/event history accessor.
    """

    config: AgentConfig

    def run(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Run the agent for a single task and return a structured result."""

        ...

    def get_history(self) -> list[dict[str, Any]]:
        """Return the agent's conversation and/or event history."""

        ...

