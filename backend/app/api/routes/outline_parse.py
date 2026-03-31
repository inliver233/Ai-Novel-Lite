from __future__ import annotations

import base64
import binascii
import asyncio
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
                phase_progress = 10 if phase == "analysis" else 30 if phase == "extraction" else progress
                progress = max(progress, phase_progress)
                yield sse_progress(message=message, progress=progress)
                continue

            if event_type == "agent_complete":
                agent = str(event.get("agent") or "")
                agent_progress = {"analysis": 20, "structure": 50, "character": 70, "entry": 90}.get(agent, progress)
                progress = max(progress, agent_progress)
                yield sse_progress(message=f"{agent} 完成" if agent else "完成", progress=progress)
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
