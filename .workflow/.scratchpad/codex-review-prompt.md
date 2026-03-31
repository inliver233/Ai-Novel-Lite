你是一个代码审查员。请对以下新增的条目系统(Entry System)进行全面的代码审查。

## 审查范围

### 后端文件
1. backend/app/models/entry.py - Entry 数据模型
2. backend/app/schemas/entries.py - Pydantic schemas
3. backend/app/api/routes/entries.py - CRUD API routes
4. backend/app/api/router.py - 路由注册（只看 entries 相关部分）
5. backend/app/api/deps.py - 权限辅助函数（只看 entry 相关部分）
6. backend/app/schemas/chapter_generate.py - entry_ids 字段
7. backend/app/services/chapter_context_service.py - entries 注入逻辑
8. backend/app/resources/prompt_presets/chapter_generate_v4/templates/sys.project.characters.md
9. backend/app/resources/prompt_presets/chapter_generate_v3/templates/sys.project.characters.md

### 前端文件
1. frontend/src/types/content.ts - Entry 类型
2. frontend/src/services/entriesApi.ts - API 服务
3. frontend/src/pages/EntriesPage.tsx - 条目页面
4. frontend/src/components/layout/appShellNavConfig.tsx - 导航
5. frontend/src/App.tsx - 路由
6. frontend/src/lib/uiCopy.ts - UI 文案
7. frontend/src/components/writing/types.ts - GenerateForm context
8. frontend/src/components/writing/AiGenerateDrawer.tsx - Drawer props
9. frontend/src/components/writing/aiGenerateDrawer/AiGenerateDefaultSection.tsx - 条目选择 UI
10. frontend/src/components/writing/aiGenerateDrawer/aiGenerateDrawerModels.ts
11. frontend/src/components/writing/aiGenerateDrawer/aiGenerateDrawerCopy.ts

## 审查要点
1. **安全性**: SQL 注入、XSS、权限检查是否完整
2. **一致性**: 是否与项目现有模式（Character/StoryMemory）一致
3. **错误处理**: API 错误处理是否完整
4. **类型安全**: TypeScript 类型是否正确
5. **边界条件**: 空列表、长字符串、特殊字符处理
6. **性能**: 不必要的查询或渲染
7. **前后端契约**: API 请求/响应格式是否匹配

## 输出格式
对每个文件简要评价，如有问题指出具体行号和修复建议。如果没有问题，标记为 PASS。
最后给出总体评价：PASS / PASS WITH NOTES / NEEDS FIX。

如果发现需要修复的问题，请直接修复。
