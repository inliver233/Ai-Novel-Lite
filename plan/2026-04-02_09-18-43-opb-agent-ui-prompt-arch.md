# Plan: OPB 多Agent解析系统 — UI重构 + Prompt重写 + 架构增强

## Goal
- UI 融入纸墨设计体系：Lucide 图标替代 emoji、语义色替代硬编码色、Badge 组件替代自定义标签
- 彻底解决 JSON 解析失败：重写 Prompt 添加完整示例+自检指令、增强解析器多级容错
- 架构从固定 Agent 升级为主 Agent 动态分配模式

## Root Cause Analysis

### UI 问题
- emoji 图标 (📊📋👤🌍✅) 与项目 Lucide 图标体系不一致
- `border-l-4 border-l-blue-400` 硬编码蓝色边框，纸墨主题无此设计语言
- 状态徽章使用硬编码 Tailwind 色 (bg-blue-100) 而非语义 token (bg-info/10)
- 未使用项目 Badge 组件

### JSON 解析失败根因
- Prompt 缺少完整 JSON 输出示例（含转义换行符）
- 无 "字符串内换行必须用 \\n" 的明确指令
- 无输出前自检清单
- LLM 对超长内容（万字大纲）容易产出截断/格式错误的 JSON
- `_parse_json_from_text` 仅尝试 code fence + raw JSON 两种策略，不处理字符串内的裸换行

### 架构僵化
- 固定 3 个提取 Agent（结构/角色/条目），每个处理所有 chunks
- 大纲涉及 20+ 角色时，单次 LLM 调用要输出所有角色的完整 JSON → 输出超长 → 截断
- 无法根据内容特点动态分配：如按阵营拆分角色、按类别拆分条目

## Scope
- In: OutlineParsingSection UI、Prompt 文件、base.py 解析器、coordinator 架构、models
- Out: 大纲生成模块、其他页面 UI、数据库 schema

## Phases
1. **OPB-001**: UI 重构 — Lucide 图标 + 语义色 + Badge
2. **OPB-002**: Prompt 重写 + JSON 解析增强
3. **OPB-003**: 主 Agent 动态分配架构
4. **OPB-004**: Review + commit

## Issue CSV
- Path: issues/2026-04-02_09-18-43-opb-agent-ui-prompt-arch.csv

## Acceptance Checklist
- [ ] Agent 面板无 emoji，全部使用 Lucide 图标
- [ ] 无硬编码蓝/绿/红色，全部使用语义 token
- [ ] 状态徽章使用 Badge 组件
- [ ] 运行中无粗蓝色左边框
- [ ] 万字大纲解析，角色和条目 Agent 不再频繁 JSON 失败
- [ ] Prompt 包含完整 JSON 示例和自检指令
- [ ] 后端 compileall 通过
- [ ] 前端 tsc --noEmit 通过

## References
- 设计体系: frontend/src/index.css (语义色), frontend/src/components/ui/Badge.tsx, Lucide React
- 参考: 更相关的小说agent实现参考/03-Agent配置/MOSS系统完整说明.md
- 当前 UI: frontend/src/pages/outline/OutlineParsingSection.tsx
- 当前 Prompts: backend/app/services/outline_parsing_agent/prompts/*.md
