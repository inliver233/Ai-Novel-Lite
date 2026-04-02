from __future__ import annotations

import base64
import binascii
import asyncio
import json as _json
from collections.abc import Iterator

from fastapi import APIRouter, Header, Request

from app.api.deps import UserIdDep
from app.core.errors import AppError, ok_payload
from app.schemas.outline_parse import OutlineParseRequest
from app.services.outline_parsing_agent import (
    parse_outline as parse_outline_service,
    parse_outline_stream_events as parse_outline_stream_events_service,
)
from app.utils.sse_response import create_sse_response, sse_done, sse_error, sse_progress, sse_result

router = APIRouter()


def _decode_outline_parse_content(body: OutlineParseRequest) -> str:
    file_content = (body.file_content or "").strip()
    if file_content:
        try:
            raw = base64.b64decode(file_content, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise AppError.validation("file_content base64 解码失败") from exc
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise AppError.validation("file_content 不是 UTF-8 文本") from exc
    return body.content or ""


def _sse_custom_event(event_name: str, data: dict) -> str:
    """Format a named SSE event for the agent dashboard."""

    payload = _json.dumps(data, ensure_ascii=False)
    return f"event: {event_name}\ndata: {payload}\n\n"


def _iter_outline_parse_stream_sse_events(
    *,
    project_id: str,
    user_id: str,
    content: str,
    request_id: str,
    x_llm_provider: str | None,
    x_llm_api_key: str | None,
    agent_config: dict[str, object] | None,
) -> Iterator[str]:
    # Keep progress monotonic even if agent completion events arrive out of order.
    progress = 0
    # Dynamic progress tracking: filled when task_plan arrives
    total_agents = 0
    completed_agents = 0

    yield sse_progress(message="准备解析...", progress=0)

    loop = asyncio.new_event_loop()
    agen = None
    try:
        agen = parse_outline_stream_events_service(
            project_id=project_id,
            user_id=user_id,
            content=content,
            request_id=request_id,
            x_llm_provider=x_llm_provider,
            x_llm_api_key=x_llm_api_key,
            agent_config=agent_config,
        )

        while True:
            try:
                event = loop.run_until_complete(agen.__anext__())
            except StopAsyncIteration:
                break

            if not isinstance(event, dict):
                continue

            event_type = str(event.get("type") or "")

            if event_type == "phase_start":
                phase = str(event.get("phase") or "")
                message = str(event.get("message") or "").strip() or f"{phase}..."
                phase_progress_map = {
                    "analysis": 5,
                    "extraction": 15,
                    "repair": 80,
                    "validation": 90,
                }
                phase_progress = phase_progress_map.get(phase, progress)
                progress = max(progress, phase_progress)
                yield sse_progress(message=message, progress=progress)
                continue

            if event_type == "task_plan":
                # Forward task_plan to frontend for dynamic card creation
                tasks = event.get("tasks", [])
                total_agents = len(tasks) + 2  # +2 for planner and validation
                yield _sse_custom_event("task_plan", {"tasks": tasks})
                progress = max(progress, 10)
                yield sse_progress(message=f"任务规划完成，分配 {len(tasks)} 个提取 Agent", progress=progress)
                continue

            if event_type == "agent_complete":
                agent = str(event.get("agent") or "")
                display_name = str(event.get("display_name") or agent)
                completed_agents += 1
                # Dynamic progress: distribute 15%-90% across agents
                if total_agents > 0:
                    agent_progress = 15 + int(75 * completed_agents / total_agents)
                else:
                    # Fallback to old fixed mapping
                    agent_progress = {"planner": 10, "validation": 95}.get(agent, progress + 5)
                progress = max(progress, min(agent_progress, 95))
                yield sse_progress(message=f"{display_name} 完成" if display_name else "完成", progress=progress)
                yield _sse_custom_event(
                    "agent_complete",
                    {
                        "agent": agent,
                        "display_name": display_name,
                        "status": str(event.get("status") or "success"),
                        "duration_ms": event.get("duration_ms", 0),
                        "tokens_used": event.get("tokens_used", 0),
                        "warnings": event.get("warnings", []),
                    },
                )
                continue

            if event_type == "agent_start":
                agent = str(event.get("agent") or "")
                display_name = str(event.get("display_name") or agent)
                yield sse_progress(message=f"{display_name} 启动中...", progress=progress)
                yield _sse_custom_event(
                    "agent_start",
                    {
                        "agent": agent,
                        "display_name": display_name,
                    },
                )
                continue

            if event_type == "agent_streaming":
                yield _sse_custom_event(
                    "agent_streaming",
                    {
                        "agent": str(event.get("agent") or ""),
                        "display_name": str(event.get("display_name") or ""),
                        "text": str(event.get("text") or ""),
                    },
                )
                continue

            if event_type == "parse_complete":
                yield sse_progress(message="完成", progress=100, status="success")
                yield sse_result(event.get("data"))
                yield sse_done()
                return

            if event_type == "error":
                message = str(event.get("message") or "服务器内部错误")
                raw_code = event.get("code")
                code = raw_code if isinstance(raw_code, int) else 500
                yield sse_error(error=message, code=code)
                yield sse_done()
                return

    except GeneratorExit:
        if agen is not None:
            try:
                loop.run_until_complete(agen.aclose())
            except Exception:
                pass
        raise
    finally:
        if agen is not None:
            try:
                loop.run_until_complete(agen.aclose())
            except Exception:
                pass
        try:
            loop.close()
        except Exception:
            pass

    yield sse_done()


@router.post("/projects/{project_id}/outline/parse")
def parse_outline(
    request: Request,
    project_id: str,
    body: OutlineParseRequest,
    user_id: UserIdDep,
    x_llm_provider: str | None = Header(default=None, alias="X-LLM-Provider", max_length=64),
    x_llm_api_key: str | None = Header(default=None, alias="X-LLM-API-Key", max_length=4096),
) -> dict:
    request_id = request.state.request_id

    content = _decode_outline_parse_content(body)
    agent_config = body.agent_config.model_dump()
    result = parse_outline_service(
        project_id=project_id,
        user_id=user_id,
        content=content,
        request_id=request_id,
        x_llm_provider=x_llm_provider,
        x_llm_api_key=x_llm_api_key,
        agent_config=agent_config,
    )
    return ok_payload(request_id=request_id, data=result.to_dict())


@router.post("/projects/{project_id}/outline/parse-stream")
def parse_outline_stream(
    request: Request,
    project_id: str,
    body: OutlineParseRequest,
    user_id: UserIdDep,
    x_llm_provider: str | None = Header(default=None, alias="X-LLM-Provider", max_length=64),
    x_llm_api_key: str | None = Header(default=None, alias="X-LLM-API-Key", max_length=4096),
):
    request_id = request.state.request_id

    content = _decode_outline_parse_content(body)
    agent_config = body.agent_config.model_dump()
    return create_sse_response(
        _iter_outline_parse_stream_sse_events(
            project_id=project_id,
            user_id=user_id,
            content=content,
            request_id=request_id,
            x_llm_provider=x_llm_provider,
            x_llm_api_key=x_llm_api_key,
            agent_config=agent_config,
        )
    )
