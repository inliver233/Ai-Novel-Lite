## 任务: FIX-002 — 骨架生成流式JSON显示

### 背景
当前章节骨架生成的前端实现中，SSE onChunk 是空处理器，Modal只显示进度条。需要像大纲生成一样显示流式文本和JSON预览。

### 修改文件1: frontend/src/pages/outline/useDetailedOutlineState.ts

#### 1. 新增状态变量 (在 line 78 之后，现有的 skeletonModalOpen 声明之后)

```typescript
const [skeletonStreamRawText, setSkeletonStreamRawText] = useState("");
const [skeletonStreamResult, setSkeletonStreamResult] = useState<Record<string, unknown> | null>(null);
```

#### 2. 修改 generateChapterSkeleton 函数

在 try 块开头(setSkeletonGenerating(true) 之后)，添加清除上次结果：
```typescript
setSkeletonStreamRawText("");
setSkeletonStreamResult(null);
```

修改 SSEPostClient 的回调配置（把空的 onChunk 改为有实际功能的版本）：

```typescript
const client = new SSEPostClient(url, request, {
  onProgress: ({ message, progress: pct }) => {
    setSkeletonProgress(() => ({
      current: Math.round(pct),
      total: 100,
      message: message || `${Math.round(pct)}%`,
    }));
  },
  onChunk: (content: string) => {
    setSkeletonStreamRawText((prev) => {
      const next = prev + content;
      if (next.length > 36000) {
        const dropped = next.length - 36000;
        return `[已截断前 ${dropped} 字符]\n` + next.slice(-36000);
      }
      return next;
    });
  },
  onResult: (data: unknown) => {
    if (data && typeof data === "object") {
      setSkeletonStreamResult(data as Record<string, unknown>);
    }
  },
  onDone: () => {
    setSkeletonProgress((prev) =>
      prev ? { ...prev, message: OUTLINE_COPY.detailedOutline.generateSkeletonDone } : prev,
    );
  },
});
```

#### 3. 修改 finally 块

当前 finally 中有 `setSkeletonProgress(null);` — 改为只清除 progress，不清除 streamRawText 和 streamResult：
```typescript
} finally {
  skeletonStreamRef.current = null;
  setSkeletonGenerating(false);
  // 保留 skeletonStreamRawText 和 skeletonStreamResult — 不清除
  // skeletonProgress 也保留最终状态，不设为null
}
```

把 finally 块中的 `setSkeletonProgress(null);` 删除。

#### 4. 更新 DetailedOutlineState type (line 27-58)

在 type 定义中添加新字段：
```typescript
skeletonStreamRawText: string;
skeletonStreamResult: Record<string, unknown> | null;
```

#### 5. 更新 return 对象 (末尾)

在 return 语句中添加：
```typescript
skeletonStreamRawText,
skeletonStreamResult,
```

### 修改文件2: frontend/src/pages/outline/DetailedOutlineSection.tsx

#### 1. 更新 ChapterSkeletonGenerationModalProps (约 line 480)

添加新 props:
```typescript
export type ChapterSkeletonGenerationModalProps = {
  open: boolean;
  generating: boolean;
  progress: DetailedOutlineState["skeletonProgress"];
  detailedOutlineId: string | undefined;
  streamRawText: string;     // 新增
  streamResult: Record<string, unknown> | null;  // 新增
  onClose: () => void;
  onGenerate: (detailedOutlineId: string, request: ChapterSkeletonGenerateRequest) => void;
  onCancelGenerate: () => void;
};
```

#### 2. 更新 ChapterSkeletonGenerationModal 组件

在进度条区域之后（约 line 605，`</div>` 和 `<div className="mt-5 flex justify-end gap-2">` 之间），添加流式内容展示：

```tsx
{/* 流式内容展示 */}
{(props.generating || props.streamRawText) ? (
  <div className="mt-4 grid gap-3">
    {/* Raw streaming text */}
    {props.streamRawText ? (
      <details open={props.generating} className="panel p-3">
        <summary className="cursor-pointer text-xs text-subtext ui-transition-fast hover:text-ink">
          {OUTLINE_COPY.detailedOutline.skeletonStreamRawTitle ?? "流式输出"}
        </summary>
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs text-ink">
          {props.streamRawText}
        </pre>
      </details>
    ) : null}

    {/* JSON preview */}
    {props.streamResult ? (
      <details open className="panel p-3">
        <summary className="cursor-pointer text-xs text-subtext ui-transition-fast hover:text-ink">
          {OUTLINE_COPY.detailedOutline.skeletonJsonPreviewTitle ?? "章节结构预览"}
        </summary>
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs text-ink">
          {JSON.stringify(props.streamResult, null, 2)}
        </pre>
      </details>
    ) : null}
  </div>
) : null}
```

#### 3. 更新 DetailedOutlineSection 中传递 props 的地方 (约 line 324-332)

```tsx
<ChapterSkeletonGenerationModal
  open={props.skeletonModalOpen}
  generating={props.skeletonGenerating}
  progress={props.skeletonProgress}
  detailedOutlineId={props.selected?.id}
  streamRawText={props.skeletonStreamRawText}
  streamResult={props.skeletonStreamResult}
  onClose={props.closeSkeletonModal}
  onGenerate={props.generateChapterSkeleton}
  onCancelGenerate={props.cancelSkeletonGenerate}
/>
```

### 修改文件3: frontend/src/pages/outline/outlineCopy.ts

在 detailedOutline 对象中添加两个新的 copy 字符串（如果不存在的话，在其他skeleton相关字符串附近）：
```typescript
skeletonStreamRawTitle: "流式输出",
skeletonJsonPreviewTitle: "章节结构预览",
```

如果文件已经有类似的字段就不要重复添加。如果 OUTLINE_COPY.detailedOutline 中找不到合适的位置，可以用内联字符串"流式输出"和"章节结构预览"代替。

### 约束
- 只修改上述3个文件
- 不改变任何已有的函数签名
- 不改变 SSE 连接逻辑
- onChunk 的类型参数 content 是 string
- onResult 的类型参数 data 是 unknown
- 保持现有的 progress 处理不变
- raw text 截断阈值 36000 字符
- 使用项目已有的 CSS class (panel, text-xs, text-subtext, text-ink 等)
- 使用 details/summary 折叠面板模式（与项目其他地方一致）
