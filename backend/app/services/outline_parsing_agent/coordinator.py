"""Outline parsing orchestrator.

Implements a multi-agent pipeline to parse external outline text into a structured
project format.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import fields
from typing import Any

from app.api.deps import require_project_editor
from app.core.logging import redact_secrets_text
from app.core.errors import AppError
from app.db.session import SessionLocal
from app.llm.client import call_llm_messages, call_llm_stream_messages
from app.llm.messages import ChatMessage
from app.llm.strategy import DEFAULT_STRATEGY_REGISTRY, LLMStrategy
from app.services.llm_task_catalog import is_supported_llm_task
from app.services.llm_task_preset_resolver import resolve_task_llm_config
from app.services.outline_parsing_agent.agents.analysis_agent import AnalysisAgent
from app.services.outline_parsing_agent.agents.character_agent import CharacterExtractionAgent
from app.services.outline_parsing_agent.agents.entry_agent import EntryExtractionAgent
from app.services.outline_parsing_agent.agents.structure_agent import StructureExtractionAgent
from app.services.outline_parsing_agent.agents.validation_agent import ValidationAgent
from app.services.outline_parsing_agent.chunker import TextChunker
from app.services.outline_parsing_agent.config import AgentPipelineConfig
from app.services.outline_parsing_agent.models import AgentStepResult, ParseResult

logger = logging.getLogger("ainovel.parsing_agent")


class _ClientLLMStrategy:
    """LLMStrategy adapter backed by app.llm.client.*

    The StrategyRegistry foundation exists, but concrete implementations may not
    be registered in all runtimes yet. This adapter provides a default
    implementation so the outline parsing agent can rely on the strategy
    interface without additional bootstrap.
    """

    def __init__(self, provider: str) -> None:
        self._provider = str(provider or "").strip()

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
    ):
        return call_llm_messages(
            provider=self._provider,
            base_url=base_url,
            model=model,
            api_key=api_key,
            messages=messages,
            params=params,
            timeout_seconds=timeout_seconds,
            extra=extra,
        )

    async def stream_completion(
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
        iterator, _state = call_llm_stream_messages(
            provider=self._provider,
            base_url=base_url,
            model=model,
            api_key=api_key,
            messages=messages,
            params=params,
            timeout_seconds=timeout_seconds,
            extra=extra,
        )
        for delta in iterator:
            yield delta


def _get_llm_strategy(provider: str) -> LLMStrategy:
    try:
        return DEFAULT_STRATEGY_REGISTRY.get_llm(provider)
    except KeyError:
        strategy = _ClientLLMStrategy(provider)
        DEFAULT_STRATEGY_REGISTRY.register_llm(provider, strategy)
        return strategy


def _build_pipeline_config(
    agent_config: dict[str, Any] | None,
) -> AgentPipelineConfig:
    allowed = {f.name for f in fields(AgentPipelineConfig)}
    overrides: dict[str, Any] = {}

    if agent_config:
        for key, value in agent_config.items():
            if key in allowed and value is not None:
                overrides[key] = value

    if not overrides:
        return AgentPipelineConfig()

    try:
        return AgentPipelineConfig(**overrides)
    except TypeError:
        return AgentPipelineConfig()


def _build_analysis_context(analysis_step: AgentStepResult) -> str:
    if analysis_step.status == "error" or not analysis_step.data:
        return ""
    try:
        payload = json.dumps(analysis_step.data, ensure_ascii=False, indent=2)
    except Exception:
        payload = str(analysis_step.data)
    return f"Analysis context (JSON):\n{payload}"


def _error_step(agent_name: str, message: str) -> AgentStepResult:
    safe_message = redact_secrets_text(str(message or "")).replace("\n", " ").strip()[:500] or "unknown error"
    return AgentStepResult(
        agent_name=agent_name,
        status="error",
        duration_ms=0,
        tokens_used=0,
        error_message=safe_message,
    )


def _resolve_outline_llm_preset(
    *,
    project_id: str,
    user_id: str,
    x_llm_provider: str | None,
    x_llm_api_key: str | None,
) -> Any:
    with SessionLocal() as db:
        project = require_project_editor(db, project_id=project_id, user_id=user_id)

        task_key = "outline_parse" if is_supported_llm_task("outline_parse") else "outline_generate"
        resolved = resolve_task_llm_config(
            db,
            project=project,
            user_id=user_id,
            task_key=task_key,
            header_api_key=x_llm_api_key,
        )
        if resolved is None and task_key != "outline_generate":
            resolved = resolve_task_llm_config(
                db,
                project=project,
                user_id=user_id,
                task_key="outline_generate",
                header_api_key=x_llm_api_key,
            )

        if resolved is None:
            raise AppError(code="LLM_CONFIG_ERROR", message="请先在 Prompts 页保存 LLM 配置", status_code=400)

        if x_llm_api_key and x_llm_provider and resolved.llm_call.provider != x_llm_provider:
            raise AppError(code="LLM_CONFIG_ERROR", message="当前任务 provider 与请求头不一致，请先保存/切换", status_code=400)

        return resolved


class OutlineParsingOrchestrator:
    def parse_outline(
        self,
        *,
        project_id: str,
        user_id: str,
        content: str,
        request_id: str,
        x_llm_provider: str | None = None,
        x_llm_api_key: str | None = None,
        agent_config: dict[str, Any] | None = None,
    ) -> ParseResult:
        start_time = time.time()

        resolved = _resolve_outline_llm_preset(
            project_id=project_id,
            user_id=user_id,
            x_llm_provider=x_llm_provider,
            x_llm_api_key=x_llm_api_key,
        )

        llm_call = resolved.llm_call
        strategy = _get_llm_strategy(llm_call.provider)
        pipeline_config = _build_pipeline_config(agent_config)

        chunks = TextChunker(pipeline_config).chunk(content or "")
        if not chunks:
            return ParseResult(
                agent_log=[_error_step("chunker", "No chunks produced")],
                total_duration_ms=int((time.time() - start_time) * 1000),
                total_tokens_used=0,
                warnings=["chunker: failed to chunk content"],
            )

        analysis_agent = AnalysisAgent(
            strategy,
            base_url=llm_call.base_url,
            api_key=resolved.api_key,
            model=llm_call.model,
            config=pipeline_config,
            provider=llm_call.provider,
        )
        analysis_step = analysis_agent.run_on_chunks([chunks[0]])
        analysis_context = _build_analysis_context(analysis_step)

        structure_agent = StructureExtractionAgent(
            strategy,
            base_url=llm_call.base_url,
            api_key=resolved.api_key,
            model=llm_call.model,
            config=pipeline_config,
            provider=llm_call.provider,
        )
        character_agent = CharacterExtractionAgent(
            strategy,
            base_url=llm_call.base_url,
            api_key=resolved.api_key,
            model=llm_call.model,
            config=pipeline_config,
            provider=llm_call.provider,
        )
        entry_agent = EntryExtractionAgent(
            strategy,
            base_url=llm_call.base_url,
            api_key=resolved.api_key,
            model=llm_call.model,
            config=pipeline_config,
            provider=llm_call.provider,
        )

        if pipeline_config.parallel_extraction:
            from concurrent.futures import ThreadPoolExecutor, as_completed

            with ThreadPoolExecutor(max_workers=3) as executor:
                futures = {
                    executor.submit(structure_agent.run_on_chunks, chunks, analysis_context): "structure",
                    executor.submit(character_agent.run_on_chunks, chunks, analysis_context): "character",
                    executor.submit(entry_agent.run_on_chunks, chunks, analysis_context): "entry",
                }

                results: dict[str, AgentStepResult] = {}
                for future in as_completed(futures):
                    agent_name = futures[future]
                    try:
                        results[agent_name] = future.result()
                    except Exception as exc:
                        results[agent_name] = _error_step(agent_name, str(exc))
        else:
            results = {
                "structure": structure_agent.run_on_chunks(chunks, analysis_context),
                "character": character_agent.run_on_chunks(chunks, analysis_context),
                "entry": entry_agent.run_on_chunks(chunks, analysis_context),
            }

        validator = ValidationAgent()
        parse_result = validator.validate(
            results.get("structure") or _error_step("structure", "Missing structure result"),
            results.get("character") or _error_step("character", "Missing character result"),
            results.get("entry") or _error_step("entry", "Missing entry result"),
            analysis_step,
        )

        parse_result.total_duration_ms = int((time.time() - start_time) * 1000)
        parse_result.total_tokens_used = sum(
            step.tokens_used for step in parse_result.agent_log if isinstance(step.tokens_used, int)
        )

        logger.info(
            "outline_parse_complete",
            extra={
                "request_id": request_id,
                "project_id": project_id,
                "provider": llm_call.provider,
                "model": llm_call.model,
                "chunks": len(chunks),
                "duration_ms": parse_result.total_duration_ms,
                "tokens_used": parse_result.total_tokens_used,
                "warnings": len(parse_result.warnings),
            },
        )

        return parse_result

    async def parse_outline_stream_events(
        self,
        *,
        project_id: str,
        user_id: str,
        content: str,
        request_id: str,
        x_llm_provider: str | None = None,
        x_llm_api_key: str | None = None,
        agent_config: dict[str, Any] | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        start_time = time.time()
        try:
            yield {"type": "phase_start", "phase": "analysis", "message": "Running analysis agent"}

            resolved = await asyncio.to_thread(
                _resolve_outline_llm_preset,
                project_id=project_id,
                user_id=user_id,
                x_llm_provider=x_llm_provider,
                x_llm_api_key=x_llm_api_key,
            )

            llm_call = resolved.llm_call
            strategy = _get_llm_strategy(llm_call.provider)
            pipeline_config = _build_pipeline_config(agent_config)

            chunks = TextChunker(pipeline_config).chunk(content or "")
            if not chunks:
                raise AppError.validation(message="内容为空或无法分块")

            analysis_agent = AnalysisAgent(
                strategy,
                base_url=llm_call.base_url,
                api_key=resolved.api_key,
                model=llm_call.model,
                config=pipeline_config,
                provider=llm_call.provider,
            )
            analysis_step = await asyncio.to_thread(analysis_agent.run_on_chunks, [chunks[0]])
            yield {"type": "agent_complete", "agent": "analysis", "data": dict(analysis_step.data)}

            analysis_context = _build_analysis_context(analysis_step)

            yield {"type": "phase_start", "phase": "extraction", "message": "Running extraction agents"}
            structure_agent = StructureExtractionAgent(
                strategy,
                base_url=llm_call.base_url,
                api_key=resolved.api_key,
                model=llm_call.model,
                config=pipeline_config,
                provider=llm_call.provider,
            )
            character_agent = CharacterExtractionAgent(
                strategy,
                base_url=llm_call.base_url,
                api_key=resolved.api_key,
                model=llm_call.model,
                config=pipeline_config,
                provider=llm_call.provider,
            )
            entry_agent = EntryExtractionAgent(
                strategy,
                base_url=llm_call.base_url,
                api_key=resolved.api_key,
                model=llm_call.model,
                config=pipeline_config,
                provider=llm_call.provider,
            )

            results: dict[str, AgentStepResult] = {}
            if pipeline_config.parallel_extraction:
                from concurrent.futures import ThreadPoolExecutor

                loop = asyncio.get_running_loop()
                with ThreadPoolExecutor(max_workers=3) as executor:
                    futures = {
                        loop.run_in_executor(executor, structure_agent.run_on_chunks, chunks, analysis_context): "structure",
                        loop.run_in_executor(executor, character_agent.run_on_chunks, chunks, analysis_context): "character",
                        loop.run_in_executor(executor, entry_agent.run_on_chunks, chunks, analysis_context): "entry",
                    }

                    pending = set(futures.keys())
                    while pending:
                        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                        for fut in done:
                            agent_name = futures.get(fut, "unknown")
                            try:
                                step = fut.result()
                            except Exception as exc:
                                step = _error_step(agent_name, str(exc))
                            results[agent_name] = step
                            yield {"type": "agent_complete", "agent": agent_name, "data": dict(step.data)}
            else:
                structure_step = await asyncio.to_thread(structure_agent.run_on_chunks, chunks, analysis_context)
                results["structure"] = structure_step
                yield {"type": "agent_complete", "agent": "structure", "data": dict(structure_step.data)}

                character_step = await asyncio.to_thread(character_agent.run_on_chunks, chunks, analysis_context)
                results["character"] = character_step
                yield {"type": "agent_complete", "agent": "character", "data": dict(character_step.data)}

                entry_step = await asyncio.to_thread(entry_agent.run_on_chunks, chunks, analysis_context)
                results["entry"] = entry_step
                yield {"type": "agent_complete", "agent": "entry", "data": dict(entry_step.data)}
            validator = ValidationAgent()
            parse_result = await asyncio.to_thread(
                validator.validate,
                results.get("structure") or _error_step("structure", "Missing structure result"),
                results.get("character") or _error_step("character", "Missing character result"),
                results.get("entry") or _error_step("entry", "Missing entry result"),
                analysis_step,
            )

            parse_result.total_duration_ms = int((time.time() - start_time) * 1000)
            parse_result.total_tokens_used = sum(
                step.tokens_used for step in parse_result.agent_log if isinstance(step.tokens_used, int)
            )
            yield {"type": "parse_complete", "data": parse_result.to_dict()}
        except AppError as exc:
            yield {"type": "error", "message": exc.message, "code": exc.status_code}
        except Exception as exc:
            logger.exception(
                "outline_parse_stream_failed",
                extra={
                    "request_id": request_id,
                    "project_id": project_id,
                    "provider": x_llm_provider,
                    "exception": redact_secrets_text(str(exc)).replace("\n", " ").strip()[:500],
                },
            )
            yield {"type": "error", "message": "解析失败，请稍后重试", "code": 500}


def parse_outline(
    *,
    project_id: str,
    user_id: str,
    content: str,
    request_id: str,
    x_llm_provider: str | None = None,
    x_llm_api_key: str | None = None,
    agent_config: dict[str, Any] | None = None,
) -> ParseResult:
    """Parse external outline text into project format using multi-agent pipeline."""

    return OutlineParsingOrchestrator().parse_outline(
        project_id=project_id,
        user_id=user_id,
        content=content,
        request_id=request_id,
        x_llm_provider=x_llm_provider,
        x_llm_api_key=x_llm_api_key,
        agent_config=agent_config,
    )


async def parse_outline_stream_events(
    *,
    project_id: str,
    user_id: str,
    content: str,
    request_id: str,
    x_llm_provider: str | None = None,
    x_llm_api_key: str | None = None,
    agent_config: dict[str, Any] | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Stream parsing progress events."""

    async for event in OutlineParsingOrchestrator().parse_outline_stream_events(
        project_id=project_id,
        user_id=user_id,
        content=content,
        request_id=request_id,
        x_llm_provider=x_llm_provider,
        x_llm_api_key=x_llm_api_key,
        agent_config=agent_config,
    ):
        yield event
