# Implementation Plan: 细纲系统 (Detailed Outline Layer)

**Session**: WFS-outline-to-detailed-outline-refactor
**Goal**: 重构大纲→章节流程，增加细纲中间层
**Flow**: 大纲(Outline) → 细纲(DetailedOutline) → 章节骨架(Chapter Skeleton) → 正文(Content)

## Architecture Overview

```
现有流程:  大纲 ──────────────────────→ 章节骨架 → 正文
目标流程:  大纲 → [细纲/卷] → 章节骨架(含详细plan) → 正文(含前后文上下文)

数据模型:
  outlines (大纲)
    └── detailed_outlines (细纲, 1:N per volume)
         └── chapters (章节, created from 细纲)
              └── content_md (正文, generated with 细纲 context)
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| 细纲为独立表而非嵌入outline | 细纲需独立编辑、版本控制、按卷管理 |
| 每卷一条细纲记录 | 对应MOSS战役规划层级，粒度合适 |
| 向后兼容：无细纲时保留原有流程 | 不破坏现有功能 |
| 复用chapter.plan字段 | 从细纲创建章节时自动填充plan，无需新字段 |
| SSE流式生成 | 细纲生成耗时较长，需要实时进度反馈 |

## Task Dependency Graph

```
IMPL-001 (DB Model)  ←──────────────────── Foundation
    │          │             │
    ↓          ↓             ↓
IMPL-002    IMPL-003      IMPL-005
(Prompts)   (Service)     (Agent)
    │          │
    ↓          ↓
         IMPL-004         IMPL-006
         (API)            (Context)
              │
              ↓
         IMPL-007
         (Frontend)
```

## Execution Phases

### Phase A: Foundation (IMPL-001, IMPL-002) — 并行
- **IMPL-001**: 数据库模型 + Alembic迁移
- **IMPL-002**: 细纲生成提示词预设

### Phase B: Core Services (IMPL-003, IMPL-005) — 并行
- **IMPL-003**: 细纲生成服务层 (depends: 001, 002)
- **IMPL-005**: 智能解析细纲Agent (depends: 001)

### Phase C: Integration (IMPL-004, IMPL-006) — 并行
- **IMPL-004**: REST API端点 (depends: 001, 003)
- **IMPL-006**: 章节上下文增强 (depends: 001, 003)

### Phase D: Frontend (IMPL-007)
- **IMPL-007**: 前端UI重构 (depends: 004)

## Key Technical Details

### 1. DetailedOutline 数据模型
```python
class DetailedOutline(Base):
    __tablename__ = "detailed_outlines"
    id: str           # UUID
    outline_id: str   # FK → outlines
    project_id: str   # FK → projects
    volume_number: int
    volume_title: str
    content_md: str   # 细纲markdown
    structure_json: str  # 解析后的结构化JSON
    status: str       # planned | generating | done
    created_at: datetime
    updated_at: datetime
```

### 2. structure_json 格式
```json
{
  "volume_number": 1,
  "volume_title": "卷一 起始之章",
  "volume_summary": "本卷讲述...",
  "chapters": [
    {
      "number": 1,
      "title": "第一章 标题",
      "summary": "详细200-500字概述",
      "beats": ["情节点1", "情节点2", "..."],
      "characters": ["角色A", "角色B"],
      "emotional_arc": "平静→紧张→高潮",
      "foreshadowing": ["伏笔线索1"]
    }
  ]
}
```

### 3. API端点
| Method | Path | Description |
|--------|------|-------------|
| GET | /projects/{pid}/outlines/{oid}/detailed_outlines | 列表 |
| POST | /projects/{pid}/outlines/{oid}/detailed_outlines/generate | 生成(SSE) |
| POST | /projects/{pid}/outlines/{oid}/detailed_outlines/{vn}/generate | 单卷生成 |
| GET | /detailed_outlines/{id} | 详情 |
| PUT | /detailed_outlines/{id} | 更新 |
| DELETE | /detailed_outlines/{id} | 删除 |
| POST | /detailed_outlines/{id}/create_chapters | 从细纲创建章节 |

### 4. 前端UI流程
```
OutlinePage
  ├── [大纲 Tab] — 现有大纲编辑/生成功能
  │     └── 新按钮: "生成细纲" (触发细纲生成)
  │
  ├── [细纲 Tab] — 新增
  │     ├── 左侧: 卷列表 (显示各卷状态)
  │     ├── 右侧: 选中卷的细纲编辑器
  │     └── 按钮: "从细纲创建章节"
  │
  └── [章节 Tab] — 现有(增强)
        └── 章节plan字段自动填充细纲信息
```

### 5. 智能解析增强
```
解析管线:
  PlannerAgent (增加detailed_outline任务类型)
  → DynamicExtractionAgent (structure + character + entry)
  → [NEW] DetailedOutlineExtractionAgent (细纲提取)
  → RepairAgent
  → ValidationAgent (合并细纲到ParseResult)
```

## Backward Compatibility

- 无细纲时所有现有功能不受影响
- "从大纲创建章节"按钮在无细纲时保留原有逻辑
- 章节生成提示词中细纲block为空时自动跳过
- 智能解析的细纲Agent是可选的(依赖PlannerAgent检测)

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| 细纲生成token消耗大 | 成本增加 | 逐卷生成，支持单卷重新生成 |
| 大纲无卷结构 | 无法提取卷信息 | 自动推断或提示用户手动分卷 |
| 前端状态复杂度增加 | 维护困难 | 独立hook管理，与现有状态解耦 |
