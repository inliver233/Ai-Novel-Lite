你需要完成以下任务：为搜索引擎添加"条目(entry)"搜索支持。

Entry 模型已存在（backend/app/models/entry.py），字段：id, project_id, title, content, tags_json, created_at, updated_at。
搜索引擎已支持 chapter/outline/character/story_memory/source_document，但漏掉了 entry。

## 修改 1：backend/app/services/search_index_service.py

1a) 在现有 imports 末尾（从 app.models.story_memory 导入之后），添加：
```python
from app.models.entry import Entry
```

1b) 在 `query_project_search` 函数中，找到这一行：
```python
    all_types = ["chapter", "outline", "character", "story_memory", "source_document"]
```
改为：
```python
    all_types = ["chapter", "outline", "character", "story_memory", "source_document", "entry"]
```

1c) 在 `query_project_search` 函数中，找到 ranked.sort(...) 之前、source_document 块之后，添加 entry 搜索块：

```python
    if "entry" in search_types:
        entry_expr = (
            func.coalesce(Entry.title, "")
            + "\n\n"
            + func.coalesce(Entry.content, "")
        )
        entries = (
            db.execute(
                select(Entry)
                .where(Entry.project_id == pid, *_like_all_terms(entry_expr))
                .order_by(Entry.updated_at.desc(), Entry.id.desc())
            )
            .scalars()
            .all()
        )
        for e in entries:
            title = _trim(getattr(e, "title", None)) or "条目"
            content = _trim(getattr(e, "content", None))
            full_content = (title + "\n\n" + content).strip()
            if not full_content:
                continue
            updated_at = getattr(e, "updated_at", None)
            updated_ts = float(updated_at.timestamp()) if updated_at is not None else 0.0
            ranked.append(
                {
                    "title_hit": 0 if q_primary.lower() in title.lower() else 1,
                    "updated_ts": updated_ts,
                    "item": {
                        "source_type": "entry",
                        "source_id": str(getattr(e, "id", "") or ""),
                        "title": title,
                        "snippet": _like_snippet(content=full_content, q=q_primary),
                        "jump_url": f"/projects/{pid}/entries",
                        "locator_json": json.dumps({"entry_id": str(getattr(e, "id", "") or "")}, ensure_ascii=False),
                    },
                }
            )
```

## 修改 2：frontend/src/lib/uiCopy.ts

找到：
```typescript
    sourceLabels: {
      chapter: "章节",
      outline: "大纲",
      character: "角色",
      storyMemory: "剧情记忆",
      sourceDocument: "导入文档",
    },
```
改为：
```typescript
    sourceLabels: {
      chapter: "章节",
      outline: "大纲",
      character: "角色",
      storyMemory: "剧情记忆",
      sourceDocument: "导入文档",
      entry: "条目",
    },
```

## 修改 3：frontend/src/pages/SearchPage.tsx

3a) 找到：
```typescript
const ACTIVE_SOURCE_TYPES = new Set(["chapter", "outline", "character", "story_memory", "source_document"]);
```
改为：
```typescript
const ACTIVE_SOURCE_TYPES = new Set(["chapter", "outline", "character", "story_memory", "source_document", "entry"]);
```

3b) 找到 SOURCE_OPTIONS 数组，在最后一个 source_document 之后添加：
```typescript
  { key: "entry", label: UI_COPY.search.sourceLabels.entry },
```

3c) 找到 sourceLabel 函数的 switch，在 source_document case 之后、default 之前添加：
```typescript
      case "entry":
        return UI_COPY.search.sourceLabels.entry;
```

3d) 找到 canJump 函数，在 `it.source_type === "source_document"` 这一行后面添加：
```typescript
      it.source_type === "entry" ||
```
注意：确保最后一个条目末尾没有多余的 ||，检查整体逻辑保持正确。

3e) 找到 jump 函数，在 character 跳转块后、toast.toastWarning 之前添加：
```typescript
      if (it.source_type === "entry") {
        navigate(`/projects/${projectId}/entries`);
        return;
      }
```

## 初始化状态修复

检查 SearchPage.tsx 中 sourcesState 的初始化（通常是 useMemo 或 useState，基于 SOURCE_OPTIONS 构建对象），确认新增的 entry key 会被正确初始化为 true（默认选中）。如果初始化是基于 SOURCE_OPTIONS 动态生成，则无需额外修改；如果是硬编码对象，则手动添加 `entry: true`。

## 验证

修改完成后运行：
- `backend\.venv\Scripts\python.exe -m compileall -q app` (在 backend 目录)
- `frontend\npm.cmd run build` (在项目根目录)

如果 build 通过，任务完成。
