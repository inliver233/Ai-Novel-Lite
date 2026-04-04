## 任务: CHAP-002 — ConfirmProvider 竞态修复 + createChapters 优化

### 背景
ConfirmProvider (frontend/src/components/ui/ConfirmProvider.tsx) 中，close() 函数用 setTimeout(setOptions(null), 400) 延迟清除 options。当两次 confirm 快速连续调用时（如 API 返回 409 后立即弹出第二个确认框），第一次的 setTimeout 会清除第二次的 options，导致弹窗闪现后消失。

### 修改文件1: frontend/src/components/ui/ConfirmProvider.tsx

**修改内容**:

1. 新增一个 ref 保存 setTimeout 的 timer ID:
```typescript
const clearOptionsTimerRef = useRef<number | null>(null);
```

2. 修改 `confirm` callback — 在开头清除之前的 timer:
```typescript
const confirm = useCallback(async (opts: ConfirmOptions) => {
    if (clearOptionsTimerRef.current !== null) {
        window.clearTimeout(clearOptionsTimerRef.current);
        clearOptionsTimerRef.current = null;
    }
    setVariant("confirm");
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve as (value: unknown) => void;
    });
}, []);
```

3. 修改 `choose` callback — 同样在开头清除之前的 timer:
```typescript
const choose = useCallback(async (opts: ChooseOptions) => {
    if (clearOptionsTimerRef.current !== null) {
        window.clearTimeout(clearOptionsTimerRef.current);
        clearOptionsTimerRef.current = null;
    }
    setVariant("choose");
    setOptions(opts);
    setOpen(true);
    return new Promise<ConfirmChoice>((resolve) => {
        resolverRef.current = resolve as (value: unknown) => void;
    });
}, []);
```

4. 修改 `close` callback — 保存 timer ID 到 ref:
```typescript
const close = useCallback((value: unknown) => {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(value);
    clearOptionsTimerRef.current = window.setTimeout(() => {
        setOptions(null);
        clearOptionsTimerRef.current = null;
    }, 400);
}, []);
```

### 修改文件2: frontend/src/pages/outline/useDetailedOutlineState.ts

**修改 createChapters 函数的 409 错误处理**（约 line 376-401）:

当前的替换确认提示文案是通用的。需要改为包含卷号信息，以便用户理解替换的是哪个卷的章节。

把 409 处理中的确认弹窗 description 改为包含后端返回的 message（后端现在返回的是"第X卷已有N个章节(编号M-N)"）:

在 catch 块中：
```typescript
if (err.code === "CONFLICT" && err.status === 409) {
    const replaceOk = await confirm.confirm({
        title: OUTLINE_COPY.detailedOutline.replaceChaptersTitle,
        description: err.message || OUTLINE_COPY.detailedOutline.replaceChaptersDescription,
        confirmText: OUTLINE_COPY.detailedOutline.replaceChaptersConfirmText,
        danger: true,
    });
```

注意：只改 description 行，把原来的固定文案 `OUTLINE_COPY.detailedOutline.replaceChaptersDescription` 改为优先使用 `err.message`（后端返回的卷级信息），fallback 到原来的固定文案。

### 约束
- ConfirmProvider 是全局组件，修改必须向后兼容
- 不改变 ConfirmApi 接口
- 不改变 confirm/choose 的返回值类型
- 运行 `cd frontend && npm run build` 验证
