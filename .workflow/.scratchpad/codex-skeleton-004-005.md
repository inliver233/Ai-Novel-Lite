你是 AI 编码代理。执行以下前端任务。

## 任务 A: SKELETON-004 — 前端 API 类型定义

### 修改文件: frontend/src/services/detailedOutlinesApi.ts

在文件末尾，现有的 createChaptersFromDetailedOutline 函数之后，添加新的类型定义:

```typescript
export type ChapterSkeletonGenerateRequest = {
  chapters_count?: number | null;
  instruction?: string | null;
  context?: {
    include_world_setting?: boolean;
    include_characters?: boolean;
    include_style_guide?: boolean;
  };
  replace_chapters?: boolean;
};
```

不需要新的 fetch 函数 — 前端将使用 SSEPostClient 直接调用 URL。

## 任务 B: SKELETON-005 — 细纲页面流式生成 UI

### 修改文件 1: frontend/src/pages/outline/outlineCopy.ts

在 detailedOutline 对象内添加以下中文文案 key（在现有 key 的末尾添加）:

```typescript
// 章节骨架生成
generateSkeletonButton: "生成章节骨架",
generatingSkeletonButton: "正在生成章节骨架...",
generateSkeletonTitle: "生成章节骨架",
generateSkeletonHint: "基于大纲和细纲内容，AI 将自动生成本卷的章节骨架，包括章节标题、摘要和关键节拍。",
skeletonChaptersCountLabel: "章节数（可选）",
skeletonChaptersCountPlaceholder: "留空则由 AI 自动决定",
skeletonInstructionLabel: "额外指令",
skeletonInstructionPlaceholder: "可选：对章节骨架的特殊要求或风格指示",
generateSkeletonDone: "章节骨架生成完成",
generateSkeletonFailed: "章节骨架生成失败",
generateSkeletonCanceled: "已取消章节骨架生成",
skeletonProgressLabel: "章节骨架生成进度",
skeletonReplaceLabel: "替换现有章节",
skeletonReplaceHint: "生成后将替换该大纲下所有现有章节",
```

### 修改文件 2: frontend/src/pages/outline/useDetailedOutlineState.ts

在已有的 state 和方法基础上，添加章节骨架流式生成支持:

#### 2.1 添加新 import

在已有 import 中，确保有:
```typescript
import type { ChapterSkeletonGenerateRequest } from "../../services/detailedOutlinesApi";
```

#### 2.2 新增状态

在现有 state 声明后添加:
```typescript
const [skeletonGenerating, setSkeletonGenerating] = useState(false);
const [skeletonProgress, setSkeletonProgress] = useState<DetailedOutlineProgress | null>(null);
const [skeletonModalOpen, setSkeletonModalOpen] = useState(false);
```

新增一个 ref:
```typescript
const skeletonStreamRef = useRef<SSEPostClient | null>(null);
```

在 useEffect cleanup 中添加:
```typescript
skeletonStreamRef.current?.abort();
```

#### 2.3 新增方法

```typescript
const openSkeletonModal = useCallback(() => {
  setSkeletonModalOpen(true);
}, []);

const closeSkeletonModal = useCallback(() => {
  skeletonStreamRef.current?.abort();
  setSkeletonModalOpen(false);
}, []);

const cancelSkeletonGenerate = useCallback(() => {
  skeletonStreamRef.current?.abort();
}, []);

const generateChapterSkeleton = useCallback(
  async (detailedOutlineId: string, request: ChapterSkeletonGenerateRequest) => {
    setSkeletonGenerating(true);
    setSkeletonProgress({ current: 0, total: 100, message: "..." });
    skeletonStreamRef.current = null;

    try {
      const url = `/api/detailed_outlines/${detailedOutlineId}/generate_chapters_stream`;
      const client = new SSEPostClient(url, request, {
        onProgress: ({ message, progress: pct }) => {
          setSkeletonProgress((prev) => ({
            current: Math.round(pct),
            total: 100,
            message: message || `${Math.round(pct)}%`,
          }));
        },
        onChunk: () => {
          // Token streaming — progress updates handled by onProgress
        },
        onDone: () => {
          setSkeletonProgress((prev) =>
            prev ? { ...prev, message: OUTLINE_COPY.detailedOutline.generateSkeletonDone } : prev,
          );
        },
      });
      skeletonStreamRef.current = client;

      await client.connect();
      await refresh();
      toast.toastSuccess(OUTLINE_COPY.detailedOutline.generateSkeletonDone);
    } catch (error) {
      if (error instanceof SSEError && error.code === "ABORTED") {
        toast.toastSuccess(OUTLINE_COPY.detailedOutline.generateSkeletonCanceled);
        await refresh();
        return;
      }
      if (error instanceof SSEError || error instanceof ApiError) {
        toast.toastError(`${error.message} (${(error as SSEError).code ?? (error as ApiError).code})`);
      } else {
        toast.toastError(OUTLINE_COPY.detailedOutline.generateSkeletonFailed);
      }
    } finally {
      skeletonStreamRef.current = null;
      setSkeletonGenerating(false);
      setSkeletonProgress(null);
    }
  },
  [refresh, toast],
);
```

#### 2.4 在 return 对象中添加新属性

在 return 语句中添加:
```typescript
skeletonGenerating,
skeletonProgress,
skeletonModalOpen,
openSkeletonModal,
closeSkeletonModal,
cancelSkeletonGenerate,
generateChapterSkeleton,
```

#### 2.5 更新 DetailedOutlineState type

在 DetailedOutlineState type 中添加这些新属性的类型声明。

### 修改文件 3: frontend/src/pages/outline/DetailedOutlineSection.tsx

#### 3.1 新增 import

确保导入 ChapterSkeletonGenerateRequest:
```typescript
import type { ChapterSkeletonGenerateRequest } from "../../services/detailedOutlinesApi";
```

#### 3.2 在 VolumeDetail 组件中添加「生成章节骨架」按钮

在现有的「创建章节骨架」(createChaptersFromDetailed) 按钮旁边，添加一个新按钮:
```tsx
<button
  className="btn btn-primary"
  type="button"
  disabled={props.skeletonGenerating}
  onClick={() => props.openSkeletonModal()}
>
  {props.skeletonGenerating
    ? OUTLINE_COPY.detailedOutline.generatingSkeletonButton
    : OUTLINE_COPY.detailedOutline.generateSkeletonButton}
</button>
```

#### 3.3 VolumeDetail 的 Props 需要扩展

在 VolumeDetailProps 的 Pick 中添加新的属性:
```
| "skeletonGenerating"
| "openSkeletonModal"
```

#### 3.4 在 DetailedOutlineSection 主组件中

在现有的进度条区域之后（generating && progress 的条件渲染之后），添加章节骨架进度显示:
```tsx
{props.skeletonGenerating && props.skeletonProgress ? (
  <div className="panel p-4">
    <div className="flex items-center justify-between gap-2 text-xs text-subtext">
      <span className="truncate">{props.skeletonProgress.message}</span>
      <span className="shrink-0">
        {props.skeletonProgress.current}%
      </span>
    </div>
    <ProgressBar
      ariaLabel={OUTLINE_COPY.detailedOutline.skeletonProgressLabel}
      value={props.skeletonProgress.current}
    />
    <div className="mt-2 flex justify-end">
      <button className="btn btn-secondary" type="button" onClick={props.cancelSkeletonGenerate}>
        {OUTLINE_COPY.cancel}
      </button>
    </div>
  </div>
) : null}
```

#### 3.5 新增 ChapterSkeletonGenerationModal 组件

在文件末尾（DetailedOutlineGenerationModal 之后），添加新的 Modal 组件:

```tsx
export type ChapterSkeletonGenerationModalProps = {
  open: boolean;
  generating: boolean;
  progress: DetailedOutlineState["skeletonProgress"];
  detailedOutlineId: string | undefined;
  onClose: () => void;
  onGenerate: (detailedOutlineId: string, request: ChapterSkeletonGenerateRequest) => void;
  onCancelGenerate: () => void;
};

export function ChapterSkeletonGenerationModal(props: ChapterSkeletonGenerationModalProps) {
  const copy = OUTLINE_COPY.detailedOutline;

  const [chaptersCount, setChaptersCount] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const [includeWorldSetting, setIncludeWorldSetting] = useState(true);
  const [includeCharacters, setIncludeCharacters] = useState(true);
  const [replaceChapters, setReplaceChapters] = useState(true);

  const handleGenerate = () => {
    if (!props.detailedOutlineId) return;
    const parsed = chaptersCount.trim() ? Number(chaptersCount) : null;
    props.onGenerate(props.detailedOutlineId, {
      chapters_count: parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      instruction: instruction.trim() || null,
      context: {
        include_world_setting: includeWorldSetting,
        include_characters: includeCharacters,
      },
      replace_chapters: replaceChapters,
    });
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      panelClassName="surface max-w-2xl p-6"
      ariaLabel={copy.generateSkeletonTitle}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-content text-2xl">{copy.generateSkeletonTitle}</div>
          <div className="mt-1 text-xs text-subtext">{copy.generateSkeletonHint}</div>
        </div>
        <button className="btn btn-secondary" onClick={props.onClose} type="button">
          {OUTLINE_COPY.close}
        </button>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="rounded-atelier border border-border bg-canvas p-4">
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs text-subtext">{copy.skeletonChaptersCountLabel}</span>
              <input
                className="input"
                type="number"
                min={3}
                max={50}
                name="chapters_count"
                value={chaptersCount}
                onChange={(e) => setChaptersCount(e.target.value)}
                placeholder={copy.skeletonChaptersCountPlaceholder}
              />
            </label>
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-subtext">{copy.skeletonInstructionLabel}</span>
              <textarea
                className="input resize-y"
                name="instruction"
                rows={3}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={copy.skeletonInstructionPlaceholder}
              />
            </label>
          </div>
        </div>

        <div className="rounded-atelier border border-border bg-canvas p-4">
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                className="checkbox"
                checked={includeWorldSetting}
                name="include_world_setting"
                onChange={(e) => setIncludeWorldSetting(e.target.checked)}
                type="checkbox"
              />
              {OUTLINE_COPY.includeWorldSetting}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                className="checkbox"
                checked={includeCharacters}
                name="include_characters"
                onChange={(e) => setIncludeCharacters(e.target.checked)}
                type="checkbox"
              />
              {OUTLINE_COPY.includeCharacters}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                className="checkbox"
                checked={replaceChapters}
                name="replace_chapters"
                onChange={(e) => setReplaceChapters(e.target.checked)}
                type="checkbox"
              />
              {copy.skeletonReplaceLabel}
            </label>
          </div>
          <div className="mt-1 text-[11px] text-subtext">{copy.skeletonReplaceHint}</div>
        </div>
      </div>

      {props.generating && props.progress ? (
        <div className="mt-4 panel p-3">
          <div className="flex items-center justify-between gap-2 text-xs text-subtext">
            <span className="truncate">{props.progress.message}</span>
            <span className="shrink-0">{props.progress.current}%</span>
          </div>
          <ProgressBar ariaLabel={copy.skeletonProgressLabel} value={props.progress.current} />
        </div>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={props.onClose} type="button">
          {OUTLINE_COPY.cancel}
        </button>
        {props.generating ? (
          <button className="btn btn-secondary" onClick={props.onCancelGenerate} type="button">
            {OUTLINE_COPY.cancel}
          </button>
        ) : null}
        <button
          className="btn btn-primary"
          disabled={props.generating || !props.detailedOutlineId}
          onClick={handleGenerate}
          type="button"
        >
          {props.generating ? copy.generatingSkeletonButton : copy.generateSkeletonButton}
        </button>
      </div>
    </Modal>
  );
}
```

### 修改文件 4: frontend/src/pages/outline/OutlinePageSections.tsx

在此文件中，找到渲染 DetailedOutlineSection 和 DetailedOutlineGenerationModal 的位置。
需要添加 ChapterSkeletonGenerationModal 的渲染。

在 DetailedOutlineGenerationModal 渲染之后，添加:
```tsx
<ChapterSkeletonGenerationModal
  open={detailedOutlineState.skeletonModalOpen}
  generating={detailedOutlineState.skeletonGenerating}
  progress={detailedOutlineState.skeletonProgress}
  detailedOutlineId={detailedOutlineState.selected?.id}
  onClose={detailedOutlineState.closeSkeletonModal}
  onGenerate={detailedOutlineState.generateChapterSkeleton}
  onCancelGenerate={detailedOutlineState.cancelSkeletonGenerate}
/>
```

需要导入 ChapterSkeletonGenerationModal:
```typescript
import { ChapterSkeletonGenerationModal } from "./DetailedOutlineSection";
```

### 严格要求
1. 修改的文件: detailedOutlinesApi.ts, outlineCopy.ts, useDetailedOutlineState.ts, DetailedOutlineSection.tsx, OutlinePageSections.tsx
2. 不创建新文件
3. 保持现有代码风格（TypeScript, React hooks pattern）
4. 确保所有 tsx/ts 类型正确
5. 使用已有的 SSEPostClient, Modal, ProgressBar 组件
6. 新增文案都在 outlineCopy.ts 的 detailedOutline 对象中
