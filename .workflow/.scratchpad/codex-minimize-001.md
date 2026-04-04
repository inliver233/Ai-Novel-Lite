## 任务: MINIMIZE-001 — 后台运行浮动卡片系统

### 目标
参照写作页面的 WritingStreamFloatingCard 模式，实现所有生成页面的"关闭=最小化，不停止"功能。

### 参考实现
写作页面: `frontend/src/pages/writing/WritingPageSections.tsx` 中的 `WritingStreamFloatingCard` (约 line 262-301)

关键模式:
- 关闭 Drawer/Modal 只设置 open=false，不调用 abort()
- 只有"取消"按钮才调用 abort()
- 浮动卡片在 `generating && !modalOpen` 时显示
- 浮动卡片有"展开"和"取消"两个按钮

### 修改1: 创建通用浮动卡片组件

**新建文件**: `frontend/src/components/ui/GenerationFloatingCard.tsx`

```tsx
import { ProgressBar } from "./ProgressBar";

export type GenerationFloatingCardProps = {
  open: boolean;
  title: string;
  message?: string;
  progress: number;
  onExpand: () => void;
  onCancel: () => void;
};

export function GenerationFloatingCard(props: GenerationFloatingCardProps) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-40 flex justify-center sm:inset-auto sm:bottom-8 sm:right-8 sm:justify-end">
      <div className="w-full max-w-sm rounded-atelier border border-border bg-surface/90 p-3 shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-ink">{props.title}</div>
            <div className="mt-1 truncate text-xs text-subtext">
              {props.message ?? "处理中..."}
            </div>
          </div>
          <div className="shrink-0 text-xs text-subtext">{Math.max(0, Math.min(100, props.progress))}%</div>
        </div>
        <ProgressBar ariaLabel={props.title} className="mt-2" value={props.progress} />
        <div className="mt-3 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={props.onExpand} type="button">
            展开
          </button>
          <button className="btn btn-secondary" onClick={props.onCancel} type="button">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 修改2: useOutlineGenerationState.ts

**修改 closeModal** (约 line 60-63):

之前:
```typescript
const closeModal = useCallback(() => {
    streamClientRef.current?.abort();
    setOpen(false);
}, []);
```

之后（关闭不再abort，只关闭modal）:
```typescript
const closeModal = useCallback(() => {
    setOpen(false);
}, []);
```

cancelGenerate 保持不变（它是用来真正取消的）。

### 修改3: useOutlineParsingState.ts

**修改 closeParseModal** (约 line 123-129):

之前（PERSIST-001已修改为）:
```typescript
const closeParseModal = useCallback(() => {
    streamClientRef.current?.abort();
    streamClientRef.current = null;
    streamHasProgressRef.current = false;
    setOpen(false);
    setParsing(false);
}, []);
```

之后（关闭不再abort，不再重置parsing状态）:
```typescript
const closeParseModal = useCallback(() => {
    setOpen(false);
}, []);
```

cancelParse 保持不变（搜索现有的 cancelParse 函数，应该在某处定义了 abort 逻辑）。

### 修改4: useDetailedOutlineState.ts

**修改 closeGenerateModal** (约 line 136-139):

之前:
```typescript
const closeGenerateModal = useCallback(() => {
    streamClientRef.current?.abort();
    setGenerateModalOpen(false);
}, []);
```

之后:
```typescript
const closeGenerateModal = useCallback(() => {
    setGenerateModalOpen(false);
}, []);
```

**修改 closeSkeletonModal** (约 line 149-152):

之前:
```typescript
const closeSkeletonModal = useCallback(() => {
    skeletonStreamRef.current?.abort();
    setSkeletonModalOpen(false);
}, []);
```

之后:
```typescript
const closeSkeletonModal = useCallback(() => {
    setSkeletonModalOpen(false);
}, []);
```

cancelGenerate 和 cancelSkeletonGenerate 保持不变。

### 修改5: useOutlinePageState.ts

在 return 语句之前，添加浮动卡片 props 的计算。需要用到各个 hook 的状态：

```typescript
// Floating card props for background running
import type { GenerationFloatingCardProps } from "../../components/ui/GenerationFloatingCard";
```

在 return 之前添加:

```typescript
const outlineGenFloatingProps: GenerationFloatingCardProps = {
    open: generation.generating && !generation.open,
    title: "大纲生成中",
    message: generation.streamProgress?.message,
    progress: generation.streamProgress?.progress ?? 0,
    onExpand: () => generation.setOpen(true),
    onCancel: generation.cancelGenerate,
};

const parsingFloatingProps: GenerationFloatingCardProps = {
    open: parsing.parsing && !parsing.open,
    title: "智能解析中",
    message: parsing.parseProgress?.message,
    progress: parsing.parseProgress?.progress ?? 0,
    onExpand: parsing.openParseModal,
    onCancel: parsing.cancelParse,
};

const detailedGenFloatingProps: GenerationFloatingCardProps = {
    open: detailedOutline.generating && !detailedOutline.generateModalOpen,
    title: "细纲生成中",
    message: detailedOutline.progress?.message,
    progress: detailedOutline.progress
        ? (detailedOutline.progress.total > 0
            ? (detailedOutline.progress.current / detailedOutline.progress.total) * 100
            : 0)
        : 0,
    onExpand: detailedOutline.openGenerateModal,
    onCancel: detailedOutline.cancelGenerate,
};

const skeletonGenFloatingProps: GenerationFloatingCardProps = {
    open: detailedOutline.skeletonGenerating && !detailedOutline.skeletonModalOpen,
    title: "章节骨架生成中",
    message: detailedOutline.skeletonProgress?.message,
    progress: detailedOutline.skeletonProgress?.current ?? 0,
    onExpand: detailedOutline.openSkeletonModal,
    onCancel: detailedOutline.cancelSkeletonGenerate,
};
```

**更新 OutlinePageState type** (在 return type 定义处):

```typescript
outlineGenFloatingProps: GenerationFloatingCardProps;
parsingFloatingProps: GenerationFloatingCardProps;
detailedGenFloatingProps: GenerationFloatingCardProps;
skeletonGenFloatingProps: GenerationFloatingCardProps;
```

**在 return 对象中添加这4个 props**。

### 修改6: OutlinePage.tsx

**添加 import**:
```typescript
import { GenerationFloatingCard } from "../components/ui/GenerationFloatingCard";
```

**在 JSX 中添加4个浮动卡片**（在 `</div>` 关闭标签之前，WizardNextBar 之后）:

```tsx
<GenerationFloatingCard {...state.outlineGenFloatingProps} />
<GenerationFloatingCard {...state.parsingFloatingProps} />
<GenerationFloatingCard {...state.detailedGenFloatingProps} />
<GenerationFloatingCard {...state.skeletonGenFloatingProps} />
```

### 修改7: outlineCopy.ts (如果需要)

如果用到了 copy 字符串，可以添加。但由于浮动卡片的标题和按钮已经在 props 中硬编码了中文，不需要额外的 copy 修改。

### 约束
- 浮动卡片组件样式必须与 WritingStreamFloatingCard 完全一致（复用相同的 CSS classes）
- 不修改任何 cancelGenerate/cancelParse 函数（它们是正确的abort逻辑）
- 确保 useEffect cleanup（组件卸载时abort）不受影响
- 运行 `cd frontend && npm run build` 验证编译通过
- 只修改/创建上述文件，不触碰其他文件
