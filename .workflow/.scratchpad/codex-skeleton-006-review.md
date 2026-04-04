你是代码审查员。请对以下文件进行全面审查。

## 审查范围

### 新增文件（后端服务层）
1. backend/app/services/chapter_skeleton_generation/__init__.py
2. backend/app/services/chapter_skeleton_generation/models.py
3. backend/app/services/chapter_skeleton_generation/prepare_service.py
4. backend/app/services/chapter_skeleton_generation/parse_service.py
5. backend/app/services/chapter_skeleton_generation/stream_service.py

### 修改文件（后端）
6. backend/app/api/routes/detailed_outlines.py（新增端点）
7. backend/app/schemas/detailed_outline.py（新增 schema）
8. backend/app/services/llm_task_catalog.py（新增 task）

### 修改文件（前端）
9. frontend/src/services/detailedOutlinesApi.ts
10. frontend/src/pages/outline/outlineCopy.ts
11. frontend/src/pages/outline/useDetailedOutlineState.ts
12. frontend/src/pages/outline/DetailedOutlineSection.tsx
13. frontend/src/pages/outline/OutlinePageSections.tsx

## 审查维度

### 1. 类型安全
- Python 类型注解是否完整
- TypeScript 类型是否与后端 schema 对齐
- 是否有隐式 any 或类型断言

### 2. 错误处理
- SSE 流中的异常是否被正确捕获
- 前端 SSEError/ApiError 是否正确处理
- 数据库操作失败是否回滚

### 3. SSE 协议正确性
- 事件序列: start -> progress -> chunk -> result -> done
- heartbeat 是否定期发送
- 取消/中断是否正确处理

### 4. 向后兼容性
- 现有 create_chapters 端点是否不受影响
- 现有 DetailedOutline CRUD 是否不受影响
- 现有前端功能是否不受影响

### 5. 代码风格
- 是否与现有代码风格一致
- import 分组是否正确
- 命名是否一致

### 6. 安全性
- SQL 注入风险
- API 权限检查（require_project_editor 等）

## 输出格式

请按以下格式输出审查结果:

### Critical Issues（必须修复）
- [文件:行号] 描述

### High Issues（建议修复）
- [文件:行号] 描述

### Medium Issues（可选修复）
- [文件:行号] 描述

### Low Issues（建议改进）
- [文件:行号] 描述

### 通过项
- 列出审查通过的维度

如果没有 Critical/High 问题，直接输出 "No critical or high issues found." 并列出通过项。
