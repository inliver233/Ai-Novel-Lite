# TODO List: 细纲系统实现

## Phase A: Foundation (并行)
- [ ] **IMPL-001** 数据库模型 — 新增 detailed_outlines 表 + Alembic 迁移
- [ ] **IMPL-002** 提示词系统 — 新增细纲生成提示词预设

## Phase B: Core Services (并行, depends: Phase A)
- [ ] **IMPL-003** 后端服务 — 细纲生成服务层实现
- [ ] **IMPL-005** 智能解析Agent — 新增细纲提取Agent

## Phase C: Integration (并行, depends: Phase B)
- [ ] **IMPL-004** 后端API — 细纲 CRUD + 生成端点
- [ ] **IMPL-006** 章节上下文增强 — 细纲注入章节生成流程

## Phase D: Frontend (depends: Phase C)
- [ ] **IMPL-007** 前端UI — 细纲管理界面 + 交互流程重构
