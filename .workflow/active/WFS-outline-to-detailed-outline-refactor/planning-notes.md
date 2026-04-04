# Planning Notes

**Session**: WFS-outline-to-detailed-outline-refactor
**Created**: 2026-04-02T10:50:00Z

## User Intent (Phase 1)

- **GOAL**: 重构大纲→章节流程，增加细纲中间层（大纲→细纲→章节骨架→正文）
- **KEY_CONSTRAINTS**: 保留现有功能，人性化UI交互，最大化保留大纲信息到细纲，细纲提供前后文上下文给章节写作。涉及默认大纲生成流程和智能解析Agent流程两条路径。

---

## Context Findings (Phase 2)

- **CRITICAL_FILES**: backend/app/models/outline.py, backend/app/models/chapter.py, backend/app/services/outline_generation/app_service.py, frontend/src/pages/outline/OutlinePage.tsx, backend/app/services/outline_parsing_agent/coordinator.py
- **ARCHITECTURE**: FastAPI + SQLAlchemy + React 19 + Tailwind, Prompt Block preset system, Multi-agent parsing pipeline
- **CONFLICT_RISK**: low (现有plan字段和plan_first功能可复用)
- **KEY_FINDINGS**:
  - chapters表已有plan字段(细纲占位)但未充分利用
  - outline的structure_json只有chapters级别，无volume/卷概念
  - 智能解析Agent已有planner→extraction→repair→validation管线
  - MOSS参考实现有三层规划体系：战略(大纲)→战役(细纲)→战术(章节)
  - 需新增detailed_outlines表存储卷级细纲
  - 需在两条路径(默认生成+智能解析)中都增加细纲步骤

## Conflict Decisions (Phase 3)
(To be filled if conflicts detected)

## Consolidated Constraints (Phase 4 Input)
1. 保留现有功能，向后兼容
2. 学习已有UI设计风格
3. 参考：更相关的小说agent实现参考/ 文件夹
4. 两条路径：默认大纲生成流程 + 智能解析Agent流程

---

## Task Generation (Phase 4)
(To be filled by action-planning-agent)

## N+1 Context
### Decisions
| Decision | Rationale | Revisit? |
|----------|-----------|----------|

### Deferred
- [ ] (For N+1)
