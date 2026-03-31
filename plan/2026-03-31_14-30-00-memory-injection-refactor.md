# 记忆注入模块简化重构 — 实施计划

## 目标

将 AI 生成 Drawer 的"记忆注入"模块从当前复杂的多层嵌套设计简化为：

**新设计**：
- 记忆注入区域默认开启、默认收起（可展开）
- 展开后仅两项控制：
  1. **前文模式**：「前文全文」/「前文概要」双选一（radio），默认「前文全文」
  2. **RAG 检索**：开关（checkbox），默认开启

**删除的旧功能**：
- memory_query_text（记忆查询关键词输入框）
- memory_modules 三选：story_memory / semantic_history / vector_rag 独立 toggle
- 高级模块展开区域
- 上下文区域的 previous_chapter 四选一（none/summary/content/tail）→ 合并到记忆注入的前文模式

**保留不变**：
- 上下文区域的 6 个 context toggle（世界观/风格/约束/大纲/智能上下文/严格顺序）
- 角色选择（character_ids）
- 条目选择（entry_ids）
- 基础生成区域（指令/目标字数/风格）

## 新旧字段映射

| 旧字段 | 新行为 |
|--------|--------|
| `memory_injection_enabled` | 保留，默认 true |
| `memory_query_text` | 删除，后端始终自动生成 |
| `memory_modules.story_memory` | 删除，始终 true |
| `memory_modules.semantic_history` | 删除，始终 false |
| `memory_modules.vector_rag` | 映射到新字段 `rag_enabled`，默认 true |
| `context.previous_chapter` | 映射到新字段 `previous_mode`：「full」/「summary」，默认 full |
| 旧 "tail" / "content" 模式 | 合并为 "full"（注入所有前文章节全文） |
| 旧 "none" 模式 | 取消（简化后不提供"不注入前文"选项） |

## 新 GenerateForm 结构

```typescript
export type GenerateForm = {
  instruction: string;
  target_word_count: number | null;
  macro_seed?: string;
  prompt_override?: PromptOverride | null;
  stream: boolean;
  style_id: string | null;
  // ★ 简化后的记忆注入
  memory_injection_enabled: boolean;   // 保留，默认 true
  previous_mode: "full" | "summary";   // 新：前文全文 / 前文概要，默认 full
  rag_enabled: boolean;                // 新：RAG 检索开关，默认 true
  // ★ 删除：memory_query_text, memory_modules
  context: {
    include_world_setting: boolean;
    include_style_guide: boolean;
    include_constraints: boolean;
    include_outline: boolean;
    include_smart_context: boolean;
    require_sequential: boolean;
    character_ids: string[];
    entry_ids: string[];
    // ★ 删除：previous_chapter（合并到 previous_mode）
  };
};
```

## 后端兼容性策略

**ChapterGenerateRequest** 保持向后兼容：
- `memory_query_text` 改为可选、后端忽略（不删字段，避免旧客户端报错）
- `memory_modules` 改为可选、后端兜底默认值
- `context.previous_chapter` 保留但由前端根据 `previous_mode` 映射：
  - `"full"` → `previous_chapter: "content"`
  - `"summary"` → `previous_chapter: "summary"`

这样**后端 schema 和 service 不需要大改**，只需要前端重构 UI 和请求构造逻辑。

## 实施阶段

### M1: 前端 UI 重构 — 记忆注入面板
- 修改 `AiGenerateDefaultSection.tsx`：删除旧记忆注入嵌套面板，改为可折叠面板
- 修改 `types.ts`：更新 GenerateForm 类型
- 修改 `aiGenerateDrawerModels.ts`：删除旧模块常量
- 修改 `aiGenerateDrawerCopy.ts`：更新文案
- 修改 `useChapterGeneration.ts`：更新默认值和请求构造

### M2: 前端清理 — 删除 previous_chapter 下拉框
- 从上下文区域移除 previous_chapter 选择器
- 记忆注入展开区域内用 radio 替代

### M3: 请求发送层适配
- `useChapterGeneration.ts`：将 previous_mode/rag_enabled 映射到后端 API 格式
- `useBatchGeneration.ts`：同步更新
- `PromptInspectorDrawer.tsx`：同步更新

### M4: 后端清理（可选/最小化）
- 清理 `memory_service.py` 中废弃的 `tables` 字段
- 不破坏现有 API 契约

## 文件修改清单

| 文件 | 操作 |
|------|------|
| `frontend/src/components/writing/types.ts` | 修改 GenerateForm |
| `frontend/src/components/writing/aiGenerateDrawer/AiGenerateDefaultSection.tsx` | 大幅重写记忆注入 UI |
| `frontend/src/components/writing/aiGenerateDrawer/aiGenerateDrawerModels.ts` | 删除旧模块常量 |
| `frontend/src/components/writing/aiGenerateDrawer/aiGenerateDrawerCopy.ts` | 更新文案 |
| `frontend/src/pages/writing/useChapterGeneration.ts` | 更新默认值和 payload 构造 |
| `frontend/src/pages/writing/useBatchGeneration.ts` | 同步 payload 构造 |
| `frontend/src/components/writing/PromptInspectorDrawer.tsx` | 同步 payload 构造 |
| `frontend/src/components/writing/AiGenerateDrawer.tsx` | 可能需微调 props |
| `frontend/src/components/writing/BatchGenerationModal.tsx` | 同步 |

## 验收标准

1. 记忆注入区域默认收起，点击展开后仅显示两行控制
2. 前文模式 radio：「前文全文」（默认选中）/ 「前文概要」
3. RAG 检索 checkbox：默认勾选
4. 上下文区域不再有 previous_chapter 下拉框
5. 生成请求正确映射到后端 API
6. `npm run build` 通过
7. 后端 `python -m compileall` 通过
