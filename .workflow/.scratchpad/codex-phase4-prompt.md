你需要完成以下任务 [E5] AI 生成条目注入集成:

## 任务概述
将条目系统集成到 AI 章节生成的提示词注入中，支持在 AI 生成 Drawer 中选择条目注入。

## 详细指令

### 1. 后端: 更新 backend/app/schemas/chapter_generate.py

在 ChapterGenerateContext class 中，在 character_ids 字段和它的 validator 之后，添加 entry_ids 字段和 validator:

```python
    entry_ids: list[str] = Field(default_factory=list, max_length=200)

    @field_validator("entry_ids")
    @classmethod
    def _validate_entry_ids(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for item in v or []:
            if not isinstance(item, str):
                raise ValueError("entry_ids must be strings")
            item = item.strip()
            if not item:
                raise ValueError("entry_ids cannot contain empty strings")
            if len(item) > 36:
                raise ValueError("entry_id too long")
            out.append(item)
        return out
```

### 2. 后端: 更新 backend/app/services/chapter_context_service.py

2a) 在文件顶部导入区域添加:
```python
import json as _json_stdlib
from app.models.entry import Entry
```

2b) 在 `_load_project_story_text_context` 函数之前添加两个辅助函数:
```python
def _parse_entry_tags(tags_json: str | None) -> list[str]:
    if not tags_json:
        return []
    try:
        value = _json_stdlib.loads(tags_json)
    except Exception:
        return []
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if isinstance(item, str) and item.strip()]


def _format_entries(entries: list) -> str:
    if not entries:
        return ""
    parts: list[str] = []
    for entry in entries:
        title = str(getattr(entry, "title", "") or "").strip() or "无标题"
        tags = _parse_entry_tags(getattr(entry, "tags_json", None))
        tag_str = "、".join(tags) if tags else ""
        content = str(getattr(entry, "content", "") or "").strip()
        header = f"### {title}"
        if tag_str:
            header = f"### [{tag_str}] {title}"
        parts.append(f"{header}\n{content}".rstrip())
    return "\n\n".join(parts)
```

2c) 在 `_load_project_story_text_context` 函数中，在 `characters_text = format_characters(chars)` 之后添加:
```python
    entries: list[Entry] = []
    if ctx.entry_ids:
        entries = (
            db.execute(
                select(Entry).where(
                    Entry.project_id == project_id,
                    Entry.id.in_(ctx.entry_ids),
                )
            )
            .scalars()
            .all()
        )
    entries_text = _format_entries(entries)
```

2d) 修改 `_load_project_story_text_context` 的 return 语句，添加 entries_text:
原来: `return world_setting, style_guide, constraints, outline_text, characters_text`
改为: `return world_setting, style_guide, constraints, outline_text, characters_text, entries_text`

2e) 在 `assemble_chapter_generate_render_values` 函数的参数列表中，在 `characters_text: str,` 之后添加:
```python
    entries_text: str,
```

2f) 在 `assemble_chapter_generate_render_values` 函数的 values dict 中，在 `"characters": characters_text,` 之后添加:
```python
        "entries": entries_text,
```

2g) 在 values["project"] dict 中，在 `"characters": characters_text,` 之后添加:
```python
        "entries": entries_text,
```

2h) 在 `build_chapter_generate_render_values` 函数中，更新解构:
原来: `world_setting, style_guide, constraints, outline_text, characters_text = _load_project_story_text_context(`
改为: `world_setting, style_guide, constraints, outline_text, characters_text, entries_text = _load_project_story_text_context(`

2i) 在 `build_chapter_generate_render_values` 对 `assemble_chapter_generate_render_values` 的调用中，在 `characters_text=characters_text,` 之后添加:
```python
        entries_text=entries_text,
```

### 3. 后端: 更新 prompt 模板文件

3a) 追加到 backend/app/resources/prompt_presets/chapter_generate_v4/templates/sys.project.characters.md 文件末尾:
```
{% if entries %}
<ENTRIES>
{{entries}}
</ENTRIES>
{% endif %}
```

3b) 追加到 backend/app/resources/prompt_presets/chapter_generate_v3/templates/sys.project.characters.md 文件末尾:
```
{% if entries %}
<ENTRIES>
{{entries}}
</ENTRIES>
{% endif %}
```

### 4. 前端: 更新 frontend/src/components/writing/types.ts

在 GenerateForm 的 context 对象中，在 `character_ids: string[];` 之后添加:
```typescript
    entry_ids: string[];
```

### 5. 前端: 更新 frontend/src/components/writing/aiGenerateDrawer/aiGenerateDrawerModels.ts

更新 ContextToggleKey 类型定义，添加 entry_ids 排除:
原来: `export type ContextToggleKey = Exclude<keyof GenerateForm["context"], "character_ids" | "previous_chapter">;`
改为: `export type ContextToggleKey = Exclude<keyof GenerateForm["context"], "character_ids" | "entry_ids" | "previous_chapter">;`

### 6. 前端: 更新 frontend/src/components/writing/aiGenerateDrawer/aiGenerateDrawerCopy.ts

在 contextSection 对象中，在 `charactersEmpty: "暂无角色",` 之后添加:
```typescript
    entriesLabel: "注入条目（可选）",
    entriesEmpty: "暂无条目",
```

### 7. 前端: 更新 frontend/src/components/writing/aiGenerateDrawer/AiGenerateDefaultSection.tsx

7a) 在 Props type 中添加 entries 属性:
```typescript
  entries: { id: string; title: string; tags: string[] }[];
```

7b) 在角色选择 div（包含 charactersLabel 和 character checkboxes 的 div）之后，添加条目选择区域。在 `</div>` 之后、关闭 `</>` 之前添加:

```tsx
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-subtext">{AI_GENERATE_DRAWER_COPY.contextSection.entriesLabel}</div>
              {props.entries.length > 0 ? (
                <button
                  className="btn btn-ghost px-2 py-1 text-xs"
                  disabled={props.generating}
                  onClick={() => {
                    const allSelected = props.entries.every((e) =>
                      props.genForm.context.entry_ids.includes(e.id),
                    );
                    props.setGenForm((current) => ({
                      ...current,
                      context: {
                        ...current.context,
                        entry_ids: allSelected ? [] : props.entries.map((e) => e.id),
                      },
                    }));
                  }}
                  type="button"
                >
                  {props.entries.every((e) => props.genForm.context.entry_ids.includes(e.id))
                    ? "取消全选"
                    : "全选"}
                </button>
              ) : null}
            </div>
            {props.entries.length === 0 ? (
              <div className="text-sm text-subtext">{AI_GENERATE_DRAWER_COPY.contextSection.entriesEmpty}</div>
            ) : null}
            <div className="max-h-40 overflow-auto rounded-atelier border border-border bg-surface p-2">
              {props.entries.map((entry) => (
                <label key={entry.id} className="flex items-center gap-2 px-2 py-1 text-sm text-ink">
                  <input
                    className="checkbox"
                    checked={props.genForm.context.entry_ids.includes(entry.id)}
                    disabled={props.generating}
                    name={`entry_${entry.id}`}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      props.setGenForm((current) => {
                        const next = new Set(current.context.entry_ids);
                        if (checked) next.add(entry.id);
                        else next.delete(entry.id);
                        return {
                          ...current,
                          context: { ...current.context, entry_ids: Array.from(next) },
                        };
                      });
                    }}
                    type="checkbox"
                  />
                  <span className="truncate">{entry.title}</span>
                  {entry.tags.length > 0 ? (
                    <span className="ml-auto shrink-0 text-[10px] text-subtext">
                      {entry.tags.join("·")}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
```

### 8. 前端: 更新 WritingPage 数据传递

8a) 检查 frontend/src/pages/writing/useWritingPageState.ts，找到 characters 的加载逻辑。
在顶部添加 import:
```typescript
import { listEntries, type EntryItem } from "../../services/entriesApi";
```

添加 entries 的加载（参考 characters 的加载模式）。在 characters 相关的 state 声明之后添加 entries state，并在数据加载函数中加载 entries。

将 entries 加入到 hook 返回值中。

8b) 检查 frontend/src/pages/WritingPage.tsx 和 frontend/src/pages/writing/WritingPageSections.tsx，找到 characters 如何传递给 AiGenerateDrawer。按同样模式传递 entries。

8c) 找到 genForm 初始值中 character_ids: [] 的位置，在旁边添加 entry_ids: []。
搜索 `character_ids` 找到初始化位置。

注意: AiGenerateDrawer 组件的 Props 也需要添加 entries prop，然后传递给 AiGenerateDefaultSection。

### 9. 前端: 更新 AiGenerateDrawer.tsx

在 Props 中添加:
```typescript
  entries: { id: string; title: string; tags: string[] }[];
```

在 AiGenerateDefaultSection 调用中传递 entries:
```tsx
  entries={props.entries}
```

## 约束
- 严格按照上面的设计实现
- 沿用项目已有的代码风格
- 确保 TypeScript 编译通过
- 确保 ESLint 通过
- 运行 prettier 格式化修改的文件
