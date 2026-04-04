## 任务: PERSIST-001 — 所有生成Modal状态持久化

### 目标
四个生成页面（大纲生成、智能解析、细纲生成、骨架生成）关闭后结果应保留，下次打开显示上次结果。新生成开始时才清除旧结果。

### 修改文件1: frontend/src/pages/outline/useOutlineGenerationState.ts

#### 问题
1. `closeModal`(line 60-63) 调用 `streamClientRef.current?.abort()` — 这应该保持不变因为还没实现minimize（那是MINIMIZE-001的任务）
2. `generate` 函数的 finally 块 (line 290-293) 设置 `streamClientRef.current = null` 和 `setGenerating(false)` — 没有清除 genPreview, streamRawText, streamPreviewJson。这已经是正确的！
3. 但 `generate` 函数开头 (line 110-116) 会清除所有stream状态 — 这是正确的（新生成时清除旧的）

**实际需要修改**: 
- `streamProgress` 在生成完成后保持不变（它已经在成功时被设置为 "完成" status），不需要修改
- 已经是正确行为 —— genPreview 在 finally 中不被清除，只在新 generate 开始时清除

**结论**: useOutlineGenerationState 不需要修改！已经是正确的持久化行为。

### 修改文件2: frontend/src/pages/outline/useOutlineParsingState.ts

#### 问题
`closeParseModal` (约 line 123-134) 显式清除所有状态：
```typescript
const closeParseModal = useCallback(() => {
    streamClientRef.current?.abort();
    streamClientRef.current = null;
    streamHasProgressRef.current = false;
    setOpen(false);
    setParsing(false);
    setParseForm(buildFreshParseForm());
    setParseProgress(null);
    setParseResult(null);  // 这里清除了结果！
    setAgentCards([]);
    setActiveTab("outline");
}, []);
```

#### 修改
将 `closeParseModal` 改为只关闭 modal，不清除结果状态。结果只在新 parse 开始时清除。

**新的 closeParseModal**:
```typescript
const closeParseModal = useCallback(() => {
    streamClientRef.current?.abort();
    streamClientRef.current = null;
    streamHasProgressRef.current = false;
    setOpen(false);
    setParsing(false);
    // 不清除 parseResult, agentCards, activeTab — 下次打开可以看到上次结果
    // parseForm 也不清除 — 保留用户上次的输入
    // 只在新的 startParse 开始时清除旧结果
}, []);
```

同时确认 `startParse` 函数开头已经有清除逻辑（设置 parsing=true, 重置 progress, result 等）。搜索 startParse 函数，确认它在开头做了:
- `setParsing(true)`
- `setParseProgress(...)` 
- `setParseResult(null)` — 如果没有这一行，需要添加
- `setAgentCards([])` — 如果没有这一行，需要添加

如果 startParse 开头没有清除 parseResult 和 agentCards，需要在 startParse 的开头添加这两行清除语句。

### 修改文件3: frontend/src/pages/outline/useDetailedOutlineState.ts

#### 问题1: 细纲生成
`generate` 函数的 finally 块 (约 line 242-246) 有:
```typescript
} finally {
    streamClientRef.current = null;
    setGenerating(false);
    setProgress(null);  // 清除了进度！
}
```

#### 修改1
删除 `setProgress(null);` — 保留最终进度消息。进度在新 generate 开始时被 `setProgress({ current: 0, total: 0, message: "..." });` 覆盖。

#### 问题2: 骨架生成
FIX-002 已经把 `setSkeletonProgress(null)` 从 finally 块中移除了。✓
skeletonStreamRawText 和 skeletonStreamResult 在 finally 中不被清除。✓
它们在 generateChapterSkeleton 开头被清除。✓

**结论**: 骨架生成已经是正确的了（FIX-002 已修复），只需要修改细纲生成的 finally 块。

### 总结需要修改的文件和位置

1. **frontend/src/pages/outline/useOutlineParsingState.ts**
   - `closeParseModal`: 移除 `setParseForm(buildFreshParseForm())`, `setParseProgress(null)`, `setParseResult(null)`, `setAgentCards([])`, `setActiveTab("outline")` 这五行
   - `startParse` 函数开头: 确保有 `setParseResult(null)` 和 `setAgentCards([])` 的清除逻辑（如果没有就添加）

2. **frontend/src/pages/outline/useDetailedOutlineState.ts**
   - `generate` 函数的 finally 块: 删除 `setProgress(null);`

### 约束
- 不改变函数签名
- 不修改 SSE 连接逻辑
- 不修改 useOutlineGenerationState.ts（已经是正确的）
- 确保新 parse/generate 开始时旧结果被清除
- 运行 npm run build (在 frontend 目录) 验证编译通过
