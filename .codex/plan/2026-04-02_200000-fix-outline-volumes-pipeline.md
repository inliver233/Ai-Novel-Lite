# Plan: Fix Outline Volumes Pipeline — 细纲输出格式修复

## Goal
修复大纲生成(AI生成/智能解析)的输出管道：确保 volumes 格式在整个链路中被正确传递、保存和使用，使 大纲→细纲→章节骨架 三级结构正常工作。

## Root Cause Analysis

### 问题现象
AI 生成大纲后，输出的 `chapters` 数组包含 9 个"章节"（每个带 beats），这实际上是旧的 大纲→章节骨架 直接格式。正确格式应该是 `volumes` 数组（每卷带 200-500 字 summary 细纲）。

### 数据流追踪

```
LLM (outline_generate_v3 prompt v4)
  ↓ 输出: {"outline_md": ..., "volumes": [{number, title, summary}]}
  ↓
parse_outline_output() — output_parsers.py
  ↓ 正确解析 volumes + 合成 compat chapters
  ↓ 返回: {"outline_md": ..., "volumes": [...], "chapters": [...]}
  ↓
Frontend normalizeOutlineGenResult() — outlineParsing.ts
  ↓ ★BUG: 只提取 chapters，丢弃 volumes
  ↓ 返回: {outline_md, chapters, raw_output}
  ↓
Frontend save (overwrite/saveAsNew) — useOutlineGenerationState.ts
  ↓ ★BUG: 只保存 {chapters: preview.chapters}，无 volumes
  ↓
Backend outline PUT/POST — structure_json = {"chapters": [...]}
  ↓ ★结果: structure_json 中无 volumes key
  ↓
extract_volumes_from_outline() — app_service.py
  ↓ Strategy 1: structure_json["volumes"] → NOT FOUND → skip
  ↓ Strategy 2: parse markdown headings → may find volumes
  ↓ Strategy 3: single-volume fallback → 9 chapters treated as 1 volume
  ↓
generate_all_detailed_outlines() — app_service.py
  ↓ outline_chapters path: treats all chapters as flat list → wrong structure
```

### Bug 清单

| # | 位置 | 严重度 | 描述 |
|---|------|--------|------|
| B1 | `app_service.py:131` | HIGH | `_volumes_from_structure()` 不读 `summary` 字段 |
| B2 | `outlineParsing.ts:1-6` | CRITICAL | `OutlineGenResult` 类型无 `volumes` 字段 |
| B3 | `outlineParsing.ts:25-45` | CRITICAL | `normalizeOutlineGenResult()` 丢弃 `volumes` |
| B4 | `outlineModels.ts:28-38` | HIGH | `toFinalPreviewJson()` 不含 `volumes` |
| B5 | `useOutlineGenerationState.ts:78,98` | CRITICAL | save 时只传 `{chapters}`, 不传 `{volumes, chapters}` |
| B6 | `structure_system.md` | HIGH | 智能解析 prompt 仍输出旧 chapters 格式 |
| B7 | `structure_agent.py:48-71` | HIGH | `parse_response()` 只提取 chapters |
| B8 | `models.py:44-49` | MEDIUM | `ParsedOutline` 无 volumes 字段 |

## Scope

### In Scope
- B1: Backend `_volumes_from_structure()` 添加 `summary` 字段读取
- B2-B5: Frontend 完整支持 volumes 数据传递和保存
- B6-B8: 智能解析 agent 输出 volumes 格式

### Out of Scope
- 提示词内容调整（prompt 已是 v4 正确格式）
- 数据库 schema 变更（schema 正确）
- 新功能开发
- UI 设计变更

## Phases

### ISSUE-011: Backend _volumes_from_structure() 修复 (1 file)
- `backend/app/services/detailed_outline_generation/app_service.py:131`
- 添加 `vol.get("summary")` 到 beats_raw 链

### ISSUE-012: 智能解析 agent volumes 格式支持 (3 files)
- `backend/app/services/outline_parsing_agent/prompts/structure_system.md` — 更新 prompt 输出 volumes
- `backend/app/services/outline_parsing_agent/agents/structure_agent.py` — 解析 volumes + 兼容 chapters
- `backend/app/services/outline_parsing_agent/models.py` — ParsedOutline 添加 volumes, to_dict() 输出 volumes

### ISSUE-013: Frontend volumes 传递修复 (3 files)
- `frontend/src/pages/outlineParsing.ts` — 类型 + 解析逻辑支持 volumes
- `frontend/src/pages/outline/outlineModels.ts` — toFinalPreviewJson 包含 volumes
- `frontend/src/pages/outline/useOutlineGenerationState.ts` — save 时保留 volumes

### ISSUE-014: Codex Code Review
- 全部变更的 review 和审查

### ISSUE-015: Verification & Commit
- 验证 + 按 issue 分别 commit

## Acceptance Criteria
- [ ] AI生成大纲 → 输出 volumes 格式 → 保存到 DB 含 volumes → 细纲正确生成
- [ ] 智能解析 → 输出 volumes 格式 → 保存到 DB 含 volumes → 细纲正确生成
- [ ] 向后兼容：旧 chapters 格式数据仍可正常处理
- [ ] `_volumes_from_structure()` 能读取 summary 字段填充 beats_text

## Risks
- Codex CLI 可用性（不可用则停下询问）
- 向后兼容：必须同时支持新 volumes 和旧 chapters 两种格式
