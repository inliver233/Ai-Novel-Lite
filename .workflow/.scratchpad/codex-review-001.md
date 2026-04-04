## 任务: REVIEW-001 — 全面代码审查

### 审查范围
以下文件的所有未提交改动（相对于 git HEAD）：

**后端**:
- backend/app/services/detailed_outline_generation/app_service.py

**前端**:
- frontend/src/components/ui/GenerationFloatingCard.tsx (新文件)
- frontend/src/pages/outline/useOutlineGenerationState.ts
- frontend/src/pages/outline/useOutlineParsingState.ts
- frontend/src/pages/outline/useDetailedOutlineState.ts
- frontend/src/pages/outline/useOutlinePageState.ts
- frontend/src/pages/outline/DetailedOutlineSection.tsx
- frontend/src/pages/outline/outlineCopy.ts
- frontend/src/pages/OutlinePage.tsx

### 审查维度

1. **正确性**: 逻辑是否正确？是否有遗漏的边界情况？
2. **类型安全**: TypeScript 类型是否完整？有无 any 或 type assertion 可以避免？
3. **向后兼容**: 是否破坏了现有功能？是否所有现有 API 和 props 仍正常工作？
4. **性能**: 是否引入不必要的重渲染？useCallback 依赖数组是否正确？
5. **安全性**: 是否有 XSS 或注入风险？
6. **一致性**: 是否与项目现有代码风格一致？
7. **需求符合度**: 是否满足以下原始需求：
   - FIX-001: create_chapters 在已有章节时返回 409 CONFLICT
   - FIX-002: 骨架生成显示流式JSON和原始文本
   - PERSIST-001: 生成结果在Modal关闭后保留
   - MINIMIZE-001: 关闭Modal不中断生成，浮动卡片显示进度

### 请求
请运行 `git diff` 查看所有改动，逐文件审查。对每个文件给出:
- PASS / WARN / FAIL
- 具体问题描述（如有）
- 修复建议（如有）

如果发现需要修复的问题，直接修复后再次运行 `cd frontend && npm run build` 验证。

### 不要做
- 不要修改与审查无关的代码
- 不要添加新功能
- 不要重构已有代码
