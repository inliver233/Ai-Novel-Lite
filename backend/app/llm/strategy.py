from __future__ import annotations

"""
LLM Strategy Pattern (foundation).

This module introduces a *formal* strategy interface for LLM providers. The current
provider dispatch in `app.llm.client` remains the source of truth today; this file
is intentionally additive so future refactors can migrate call sites to depend on
stable interfaces instead of provider-specific modules.

Key ideas:
- `LLMStrategy` defines a provider-agnostic chat/streaming interface.
- `EmbeddingStrategy` defines a provider-agnostic embedding interface.
- `StrategyRegistry` allows registering strategies by provider name.
- `get_strategy()` is the convenience accessor for the default registry.
"""

from typing import Any, AsyncIterator, Protocol

from app.llm.messages import ChatMessage
from app.llm.registry import normalize_provider
from app.llm.types import LLMCallResult


class LLMStrategy(Protocol):
    """Strategy interface for provider-specific chat completions.

    Implementations should encapsulate provider-specific HTTP endpoints, request
    shapes, and response parsing while presenting a consistent API to call sites.
    """

    def chat_completion(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        messages: list[ChatMessage],
        params: dict[str, Any],
        timeout_seconds: int,
        extra: dict[str, Any] | None = None,
    ) -> LLMCallResult:
        """Execute a chat completion and return a normalized result."""
        ...

    def stream_completion(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        messages: list[ChatMessage],
        params: dict[str, Any],
        timeout_seconds: int,
        extra: dict[str, Any] | None = None,
    ) -> AsyncIterator[str]:
        """Stream a completion as incremental text deltas (consume via `async for`)."""
        ...


class EmbeddingStrategy(Protocol):
    """Strategy interface for provider-specific embedding calls."""

    def embed(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        texts: list[str],
        timeout_seconds: int,
        extra: dict[str, Any] | None = None,
    ) -> list[list[float]]:
        """Embed one or more texts and return vectors in provider-agnostic format."""
        ...


class StrategyRegistry:
    """In-memory registry mapping provider names to strategy instances.

    Provider names are normalized via `app.llm.registry.normalize_provider`, which
    means aliases defined by the existing LLM contract registry are accepted.
    """

    def __init__(self) -> None:
        self._llm: dict[str, LLMStrategy] = {}
        self._embeddings: dict[str, EmbeddingStrategy] = {}

    def register_llm(self, provider: str, strategy: LLMStrategy) -> None:
        """Register (or replace) the LLM strategy for a provider."""

        self._llm[normalize_provider(provider)] = strategy

    def register_embeddings(self, provider: str, strategy: EmbeddingStrategy) -> None:
        """Register (or replace) the embedding strategy for a provider."""

        self._embeddings[normalize_provider(provider)] = strategy

    def get_llm(self, provider: str) -> LLMStrategy:
        """Return the registered LLM strategy for a provider.

        Raises:
            KeyError: If no strategy has been registered for the provider.
            app.llm.registry.LLMContractLookupError: If the provider is not supported
                by the current LLM contract registry.
        """

        provider_key = normalize_provider(provider)
        try:
            return self._llm[provider_key]
        except KeyError as exc:
            raise KeyError(f"LLM strategy not registered for provider: {provider_key}") from exc

    def get_embeddings(self, provider: str) -> EmbeddingStrategy:
        """Return the registered embedding strategy for a provider.

        Raises:
            KeyError: If no strategy has been registered for the provider.
            app.llm.registry.LLMContractLookupError: If the provider is not supported
                by the current LLM contract registry.
        """

        provider_key = normalize_provider(provider)
        try:
            return self._embeddings[provider_key]
        except KeyError as exc:
            raise KeyError(f"Embedding strategy not registered for provider: {provider_key}") from exc


DEFAULT_STRATEGY_REGISTRY = StrategyRegistry()


def get_strategy(provider: str) -> LLMStrategy:
    """Convenience accessor for the default LLM strategy registry."""

    return DEFAULT_STRATEGY_REGISTRY.get_llm(provider)
