你是 AI 编码代理。按照以下精确指令创建章节骨架流式生成的后端服务层。

## 任务: SKELETON-001 — 创建 chapter_skeleton_generation 服务目录

在 backend/app/services/ 下创建 chapter_skeleton_generation/ 目录，包含以下 5 个文件。

### 重要参考
- 参照现有 backend/app/services/detailed_outline_generation/ 目录结构
- 参照 backend/app/services/outline_generation/stream_service.py 的流式模式
- 参照 backend/app/services/chapter_generation/stream_service.py 的章节生成流式模式
- 使用 backend/app/utils/sse_response.py 中的 sse_chunk, sse_progress, sse_result, sse_done, sse_error, sse_heartbeat

### 文件 1: backend/app/services/chapter_skeleton_generation/__init__.py
空文件，仅含换行

### 文件 2: backend/app/services/chapter_skeleton_generation/models.py
数据类定义:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class ChapterSkeletonResult:
    """Result of generating chapter skeleton for one volume."""

    detailed_outline_id: str
    volume_number: int
    volume_title: str
    content_md: str
    chapters: list[dict[str, Any]]
    chapter_count: int
    run_id: str
    warnings: list[str] = field(default_factory=list)
    parse_error: dict[str, Any] | None = None
```

### 文件 3: backend/app/services/chapter_skeleton_generation/prepare_service.py
组装 render_values 字典供 prompt 模板渲染。

必须包含的 render_values keys:
- project_name, genre, logline (from project)
- world_setting, style_guide, constraints (from ProjectSettings, respect context_flags)
- characters (from Character table, respect context_flags)
- outline (outline.content_md)
- volume_number, volume_title (from detailed_outline)
- detailed_outline_content (detailed_outline.content_md)
- detailed_outline_structure (json.dumps of detailed_outline.structure_json parsed)
- previous_volume_summary, next_volume_summary (from neighbor_summaries dict)
- chapters_count (optional int)
- instruction (optional str)

参照 backend/app/services/detailed_outline_generation/prepare_service.py 的实现模式。

### 文件 4: backend/app/services/chapter_skeleton_generation/parse_service.py
解析 LLM 输出为 chapters 数组。

函数 parse_chapter_skeleton_output(text: str) -> tuple[str, list[dict], list[str], dict | None]
返回 (content_md, chapters, warnings, parse_error)

- 使用 app.services.output_parsers.extract_json_value 提取 JSON
- 使用 app.services.output_parsers.likely_truncated_json 检测截断
- 从 JSON 中提取 "chapters" 数组
- _normalize_skeleton_chapters: 标准化章节（number, title, summary, beats, 保留额外key如scenes/conflict/resolution/pov/word_count_target）
- _build_content_md_from_chapters: 将 chapters 转为 markdown 文本

参照 backend/app/services/detailed_outline_generation/app_service.py 中的 _parse_detailed_outline_output 和 _normalize_chapters

### 文件 5: backend/app/services/chapter_skeleton_generation/stream_service.py
核心流式生成服务。

函数 generate_chapter_skeleton_stream_events() 是一个 Python generator，yield SSE 字符串。

参数:
- request_id: str
- detailed_outline: DetailedOutline (已加载的模型对象)
- outline: Outline (已加载)
- project: Project (已加载)
- llm_call: PreparedLlmCall
- api_key: str
- user_id: str
- db: Session
- neighbor_summaries: dict[str, str] | None = None
- chapters_count: int | None = None
- instruction: str | None = None
- context_flags: dict | None = None
- replace_chapters: bool = True

流程:
1. yield sse_progress("准备生成章节骨架...", progress=0)
2. 调用 prepare_chapter_skeleton_render_values 组装 render_values
3. 尝试 render_preset_for_task(db, project_id, task="chapter_skeleton_generate", values, ...) 渲染 prompt
4. 如果 preset 不存在或 prompt 为空，使用内置默认 prompt（包含系统prompt和用户prompt模板）
5. 调整 max_tokens（参照 detailed_outline_generation/app_service.py:260-272）
6. yield sse_progress("调用模型...", progress=10)
7. call_llm_stream_messages() 进行流式调用
8. 循环读取 delta: yield sse_chunk(delta), 定期 yield sse_heartbeat() 和 sse_progress()
9. write_generation_run 记录
10. 调用 parse_chapter_skeleton_output 解析
11. 如果解析失败 yield sse_error + sse_done return
12. 更新 detailed_outline.structure_json = {"chapters": chapters}
13. 更新 detailed_outline.content_md 和 status="done"
14. 创建 Chapter 记录（使用内部 _create_chapter_records 函数）
15. yield sse_result(result_data) + sse_progress("完成", 100, "success") + sse_done()
16. 异常处理: AppError -> sse_error, Exception -> sse_error("章节骨架生成失败")

默认系统 prompt（当没有 preset 时使用）:
```
你是一位专业的小说章节规划师。根据提供的大纲和细纲内容，为当前卷生成详细的章节骨架。

要求：
1. 根据细纲内容合理划分章节
2. 每个章节包含：编号(number)、标题(title)、摘要(summary)、关键节拍(beats)
3. 章节之间要有合理的起承转合和情节推进
4. 注意与前后卷的内容衔接

输出格式（严格JSON）：
{"chapters": [{"number": 1, "title": "章节标题", "summary": "章节摘要（100-200字）", "beats": ["节拍1", "节拍2"]}]}
```

默认用户 prompt 模板用 render_values 中的变量填充（project_name, genre, logline, outline, volume_number, volume_title, detailed_outline_content, previous/next_volume_summary, chapters_count, instruction）

内部函数 _create_chapter_records(db, detailed_outline, chapters, replace=True):
- 如果 replace=True, 删除同一 outline_id + project_id 的所有现有 Chapter
- 遍历 chapters 创建新 Chapter 记录 (id=new_id(), project_id, outline_id, number, title, plan=summary+beats, status="planned")
- db.commit()
- 返回 created 列表

### 严格要求
1. 所有文件创建在 backend/app/services/chapter_skeleton_generation/ 目录下
2. import 路径必须正确
3. 不要修改任何现有文件
4. 确保所有 5 个文件都创建
5. 使用 from __future__ import annotations 开头
