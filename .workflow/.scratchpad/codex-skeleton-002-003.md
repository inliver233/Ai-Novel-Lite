你是 AI 编码代理。执行以下两个任务。

## 任务 A: SKELETON-002 — 在 detailed_outlines.py 新增流式端点

### 修改文件: backend/app/api/routes/detailed_outlines.py

在文件末尾（现有的 create_chapters 端点之后）新增一个 SSE 流式端点。

#### 1. 新增 import（在文件顶部已有 import 区域添加）

在已有的 import 后添加:
```python
from app.services.chapter_skeleton_generation.stream_service import generate_chapter_skeleton_stream_events
```

#### 2. 新增 schema 类

在 backend/app/schemas/detailed_outline.py 文件中，在 DetailedOutlineBatchCreateRequest 类之后，添加:
```python
class ChapterSkeletonGenerateRequest(BaseModel):
    """Request to generate chapter skeleton for a detailed outline volume."""
    chapters_count: int | None = Field(default=None, ge=3, le=50)
    instruction: str | None = Field(default=None, max_length=4000)
    context: DetailedOutlineGenerateContext | None = None
    replace_chapters: bool = Field(default=True)
```

#### 3. 在 detailed_outlines.py 的 import 区域添加 ChapterSkeletonGenerateRequest 的导入

在已有的 from app.schemas.detailed_outline import (...) 行中添加 ChapterSkeletonGenerateRequest。

#### 4. 新增端点函数

在 create_chapters 端点之后，添加以下端点:

```python
# ---------------------------------------------------------------------------
# Chapter skeleton streaming generation (SSE)
# ---------------------------------------------------------------------------

def _generate_chapter_skeleton_sse_events(
    detailed_outline: DetailedOutline,
    outline: Outline,
    project: Project,
    user_id: str,
    request_id: str,
    db: DbDep,
    *,
    llm_call,
    api_key: str,
    neighbor_summaries: dict | None = None,
    chapters_count: int | None = None,
    instruction: str | None = None,
    context_flags: dict | None = None,
    replace_chapters: bool = True,
) -> Iterator[str]:
    """Wrap generate_chapter_skeleton_stream_events into SSE strings."""
    try:
        yield from generate_chapter_skeleton_stream_events(
            request_id=request_id,
            detailed_outline=detailed_outline,
            outline=outline,
            project=project,
            llm_call=llm_call,
            api_key=api_key,
            user_id=user_id,
            db=db,
            neighbor_summaries=neighbor_summaries,
            chapters_count=chapters_count,
            instruction=instruction,
            context_flags=context_flags,
            replace_chapters=replace_chapters,
        )
    except Exception as exc:
        logger.exception("chapter_skeleton_generate_sse_error")
        yield sse_error(error=str(exc) or "章节骨架生成失败")
        yield sse_done()


@router.post("/detailed_outlines/{detailed_outline_id}/generate_chapters_stream")
def generate_chapters_stream(
    request: Request,
    db: DbDep,
    user_id: UserIdDep,
    detailed_outline_id: str,
    body: ChapterSkeletonGenerateRequest,
    x_llm_api_key: str | None = Header(default=None, alias="X-LLM-API-Key", max_length=4096),
):
    """Generate chapter skeleton for a detailed outline volume via SSE streaming."""
    request_id = request.state.request_id
    detail = _require_detailed_outline_editor(db, detailed_outline_id=detailed_outline_id, user_id=user_id)

    outline = db.get(Outline, detail.outline_id)
    project = db.get(Project, detail.project_id)
    if outline is None or project is None:
        raise AppError.not_found("Outline or Project not found")

    # Resolve LLM config
    resolved = None
    for task_key in ("chapter_skeleton_generate", "detailed_outline_generate", "outline_generate"):
        try:
            resolved = resolve_task_llm_config(
                db,
                project=project,
                user_id=user_id,
                task_key=task_key,
                header_api_key=x_llm_api_key,
            )
        except AppError:
            resolved = None
        if resolved is not None:
            break
    if resolved is None:
        raise AppError(
            code="LLM_CONFIG_NOT_FOUND",
            message="LLM 配置未找到，请先在 Prompts 页保存 LLM 配置",
            status_code=400,
        )

    # Collect neighbor volume summaries for context
    neighbor_summaries = _collect_neighbor_summaries(db, detail)

    context_flags: dict | None = None
    if body.context is not None:
        context_flags = body.context.model_dump()

    return create_sse_response(
        _generate_chapter_skeleton_sse_events(
            detailed_outline=detail,
            outline=outline,
            project=project,
            user_id=user_id,
            request_id=request_id,
            db=db,
            llm_call=resolved.llm_call,
            api_key=str(resolved.api_key),
            neighbor_summaries=neighbor_summaries,
            chapters_count=body.chapters_count,
            instruction=body.instruction,
            context_flags=context_flags,
            replace_chapters=body.replace_chapters,
        )
    )


def _collect_neighbor_summaries(db: DbDep, detail: DetailedOutline) -> dict[str, str]:
    """Collect summaries from neighboring volumes for context continuity."""
    result: dict[str, str] = {}
    
    # Previous volume
    prev = db.execute(
        select(DetailedOutline).where(
            DetailedOutline.outline_id == detail.outline_id,
            DetailedOutline.volume_number == detail.volume_number - 1,
        )
    ).scalar_one_or_none()
    if prev is not None:
        result["previous"] = (prev.content_md or "")[:500]
    
    # Next volume
    nxt = db.execute(
        select(DetailedOutline).where(
            DetailedOutline.outline_id == detail.outline_id,
            DetailedOutline.volume_number == detail.volume_number + 1,
        )
    ).scalar_one_or_none()
    if nxt is not None:
        result["next"] = (nxt.content_md or "")[:500]
    
    return result
```

注意: 需要确保文件顶部有 Iterator 的 import:
```python
from typing import Iterator
```
（文件已有 `from typing import Iterator` — 检查是否存在，不存在则添加）

## 任务 B: SKELETON-003 — 在 LLM Task Catalog 注册

### 修改文件: backend/app/services/llm_task_catalog.py

在 LLM_TASK_CATALOG tuple 中，在现有的 "detailed_outline_generate" 条目后面，添加:

```python
    LLMTaskCatalogItem(
        key="chapter_skeleton_generate",
        label="章节骨架生成",
        group="planning",
        description="基于大纲和细纲流式生成卷级章节骨架",
    ),
```

### 严格要求
1. 只修改 3 个文件: detailed_outlines.py, detailed_outline.py(schema), llm_task_catalog.py
2. 不创建新文件
3. 不修改任何其他文件
4. 保持与现有代码风格一致
5. 新增的 import 要放在正确的位置（按现有 import 分组风格）
6. ChapterSkeletonGenerateRequest 放在 schemas/detailed_outline.py 文件的最后
