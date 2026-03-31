你需要完成一个前端重构任务：简化 AI 生成 Drawer 的"记忆注入"模块。

## 总体目标

将复杂的记忆注入面板简化为：默认开启、默认收起的可折叠面板，展开后只有两行控制。

## 第一步：修改 frontend/src/components/writing/types.ts

将 GenerateForm 类型从：

```typescript
export type GenerateForm = {
  instruction: string;
  target_word_count: number | null;
  macro_seed?: string;
  prompt_override?: PromptOverride | null;
  stream: boolean;
  style_id: string | null;
  memory_injection_enabled: boolean;
  memory_query_text: string;
  memory_modules: {
    story_memory: boolean;
    semantic_history: boolean;
    vector_rag: boolean;
  };
  context: {
    include_world_setting: boolean;
    include_style_guide: boolean;
    include_constraints: boolean;
    include_outline: boolean;
    include_smart_context: boolean;
    require_sequential: boolean;
    character_ids: string[];
    entry_ids: string[];
    previous_chapter: "none" | "summary" | "content" | "tail";
  };
};
```

改为：

```typescript
export type GenerateForm = {
  instruction: string;
  target_word_count: number | null;
  macro_seed?: string;
  prompt_override?: PromptOverride | null;
  stream: boolean;
  style_id: string | null;
  memory_injection_enabled: boolean;
  previous_mode: "full" | "summary";
  rag_enabled: boolean;
  context: {
    include_world_setting: boolean;
    include_style_guide: boolean;
    include_constraints: boolean;
    include_outline: boolean;
    include_smart_context: boolean;
    require_sequential: boolean;
    character_ids: string[];
    entry_ids: string[];
  };
};
```

关键变化：
- 删除 `memory_query_text`
- 删除 `memory_modules`
- 新增 `previous_mode: "full" | "summary"`（默认 "full"）
- 新增 `rag_enabled: boolean`（默认 true）
- 从 context 中删除 `previous_chapter`

## 第二步：修改 frontend/src/components/writing/aiGenerateDrawer/aiGenerateDrawerModels.ts

1. 删除 `MemoryModuleKey` 类型
2. 删除 `AI_GENERATE_PRIMARY_MEMORY_MODULES` 常量
3. 删除 `AI_GENERATE_ADVANCED_MEMORY_MODULES` 常量
4. 从 imports 中移除对 `MemoryModuleKey` 的引用
5. `ContextToggleKey` 类型不再需要排除 `previous_chapter`（因为它已从 context 中删除），所以改为：

```typescript
export type ContextToggleKey = Exclude<
  keyof GenerateForm["context"],
  "character_ids" | "entry_ids"
>;
```

## 第三步：修改 frontend/src/components/writing/aiGenerateDrawer/aiGenerateDrawerCopy.ts

将 `memorySection` 改为：

```typescript
memorySection: {
  title: "记忆注入",
  previousModeLabel: "前文注入模式",
  previousModeFull: "前文全文",
  previousModeSummary: "前文概要",
  ragLabel: "RAG 检索",
},
```

从 `contextSection` 中删除：
- `previousChapterLabel`
- `previousChapterNone`
- `previousChapterTail`
- `previousChapterSummary`
- `previousChapterContent`
- `previousChapterHint`

## 第四步：修改 frontend/src/components/writing/aiGenerateDrawer/AiGenerateDefaultSection.tsx

### 关键设计说明

**修改前**（当前）：
- 第一个 panel: 基础生成（指令/字数/风格）
- 第二个 panel: 记忆注入（checkbox 开关 → 展开后有查询词输入、模块选择、高级折叠）
- 第三个 panel: 上下文（6个toggle、previous_chapter下拉框、角色选择、条目选择）

**修改后**：
- 第一个 panel: 基础生成（不变）
- 第二个 panel: 记忆注入（`<details>` 可折叠，默认收起，展开后只有两行）
- 第三个 panel: 上下文（删除 previous_chapter 下拉框，其余不变）

### 第二个 panel 的具体实现

```tsx
<div className="panel p-3">
  <details>
    <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-ink">
      <span>{AI_GENERATE_DRAWER_COPY.memorySection.title}</span>
      <span className="text-xs text-subtext">
        {props.genForm.memory_injection_enabled ? "已开启" : "已关闭"}
      </span>
    </summary>

    <div className="mt-3 grid gap-3">
      {/* 第一行：前文注入模式 — radio 双选一 */}
      <div className="grid gap-1">
        <div className="text-xs text-subtext">{AI_GENERATE_DRAWER_COPY.memorySection.previousModeLabel}</div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm text-ink">
            <input
              className="radio"
              type="radio"
              name="previous_mode"
              checked={props.genForm.previous_mode === "full"}
              disabled={props.generating}
              onChange={() => {
                props.setGenForm((current) => ({ ...current, previous_mode: "full" as const }));
              }}
            />
            {AI_GENERATE_DRAWER_COPY.memorySection.previousModeFull}
          </label>
          <label className="flex items-center gap-1.5 text-sm text-ink">
            <input
              className="radio"
              type="radio"
              name="previous_mode"
              checked={props.genForm.previous_mode === "summary"}
              disabled={props.generating}
              onChange={() => {
                props.setGenForm((current) => ({ ...current, previous_mode: "summary" as const }));
              }}
            />
            {AI_GENERATE_DRAWER_COPY.memorySection.previousModeSummary}
          </label>
        </div>
      </div>

      {/* 第二行：RAG 检索开关 */}
      <label className="flex items-center justify-between gap-3 text-sm text-ink">
        <span>{AI_GENERATE_DRAWER_COPY.memorySection.ragLabel}</span>
        <input
          className="checkbox"
          type="checkbox"
          checked={props.genForm.rag_enabled}
          disabled={props.generating}
          onChange={(event) => {
            const checked = event.target.checked;
            props.setGenForm((current) => ({ ...current, rag_enabled: checked }));
          }}
        />
      </label>
    </div>
  </details>
</div>
```

### 第三个 panel 的修改

删除 previous_chapter 下拉框及其 label 和 hint（第 219-240 行的整个 `<label className="grid gap-1">` 块），只保留：
- 6 个 context toggle
- 角色选择
- 条目选择

### imports 清理

从文件顶部删除不再需要的 imports：
- 删除 `AI_GENERATE_ADVANCED_MEMORY_MODULES`
- 删除 `AI_GENERATE_PRIMARY_MEMORY_MODULES`
- 删除 `MemoryModuleKey`
- 删除 `UI_COPY` import（如果这是唯一使用它的地方，检查一下）
- 保留 `ContextToggleKey` 和 `WritingStyle` 和 `AI_GENERATE_CONTEXT_TOGGLES`

删除 `updateMemoryModule` 函数（第 33-38 行），因为不再需要。

### Props 类型

不需要改 Props 类型。

## 第五步：修改 frontend/src/pages/writing/useChapterGeneration.ts

### 5a. 更新 DEFAULT_GEN_FORM

找到 `DEFAULT_GEN_FORM` 常量（大概在文件开头附近），改为：

```typescript
const DEFAULT_GEN_FORM: GenerateForm = {
  instruction: "",
  target_word_count: null,
  stream: true,
  style_id: null,
  memory_injection_enabled: true,
  previous_mode: "full",
  rag_enabled: true,
  context: {
    include_world_setting: true,
    include_style_guide: true,
    include_constraints: true,
    include_outline: true,
    include_smart_context: true,
    require_sequential: false,
    character_ids: [],
    entry_ids: [],
  },
};
```

注意：删除了 `memory_query_text`、`memory_modules`、`context.previous_chapter`。

### 5b. 更新 payload 构造

在 `generateChapter` 函数里构造 `payload` 的地方（大约第 179-201 行），改为：

```typescript
const payload = {
  mode,
  instruction: genForm.instruction,
  target_word_count: safeTargetWordCount,
  ...(typeof macroSeed === "string" && macroSeed.trim() ? { macro_seed: macroSeed.trim() } : {}),
  ...(promptOverride != null ? { prompt_override: promptOverride } : {}),
  style_id: genForm.style_id,
  memory_injection_enabled: genForm.memory_injection_enabled,
  memory_query_text: null,
  memory_modules: {
    story_memory: true,
    semantic_history: false,
    vector_rag: genForm.rag_enabled,
  },
  context: {
    include_world_setting: genForm.context.include_world_setting,
    include_style_guide: genForm.context.include_style_guide,
    include_constraints: genForm.context.include_constraints,
    include_outline: genForm.context.include_outline,
    include_smart_context: genForm.context.include_smart_context,
    require_sequential: genForm.context.require_sequential,
    character_ids: genForm.context.character_ids,
    entry_ids: genForm.context.entry_ids,
    previous_chapter: genForm.previous_mode === "full" ? "content" : "summary",
    current_draft_tail: currentDraftTail,
  },
};
```

关键映射：
- `previous_mode: "full"` → `previous_chapter: "content"`
- `previous_mode: "summary"` → `previous_chapter: "summary"`
- `rag_enabled` → `memory_modules.vector_rag`
- `story_memory` 始终 true
- `semantic_history` 始终 false
- `memory_query_text` 始终 null（后端自动生成）

### 5c. 清理 localStorage key

如果有保存 `memory_modules` 或 `memory_query_text` 到 localStorage 的逻辑，也需要清理。搜索 `writingMemoryInjectionEnabledStorageKey` 或类似函数。

## 第六步：同步修改其他发送请求的文件

### 6a. frontend/src/pages/writing/useBatchGeneration.ts

搜索该文件中构造 payload 的地方（包含 `memory_modules` 或 `previous_chapter`），按照和 useChapterGeneration.ts 相同的映射方式更新。

### 6b. frontend/src/components/writing/PromptInspectorDrawer.tsx

搜索该文件中构造 payload 的地方，同样更新映射。

### 6c. frontend/src/components/writing/BatchGenerationModal.tsx

检查是否引用了旧字段，如有也需要更新。

## 第七步：清理残留引用

全局搜索以下关键词，确保没有残留编译错误：
- `memory_query_text`
- `memory_modules`
- `previous_chapter`（在前端 context 类型中的引用）
- `MemoryModuleKey`
- `AI_GENERATE_PRIMARY_MEMORY_MODULES`
- `AI_GENERATE_ADVANCED_MEMORY_MODULES`
- `semantic_history`（前端 UI 中的引用）

## 第八步：后端小清理

在 `backend/app/services/chapter_generation/memory_service.py` 中，找到 `resolve_memory_modules` 函数里的 `"tables"` 键：

```python
"tables": bool(raw_modules.get("tables", True)),
```

将其改为：

```python
"tables": bool(raw_modules.get("tables", False)),
```

或者直接删掉（如果确认不影响其他逻辑）。先看一下上下文再决定。

## 验证

修改完成后运行：
1. `cd frontend && npm run build`（必须通过）
2. `cd backend && .venv\Scripts\python.exe -m compileall -q app`（必须通过）

如果 build 失败，修复编译错误直到通过。
