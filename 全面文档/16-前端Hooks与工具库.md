# 16 - 前端 Hooks 与工具库

本文档详细记录 ainovel Atelier 前端的自定义 React Hooks（`frontend/src/hooks/`）与工具库（`frontend/src/lib/`）的完整设计与实现。

---

## 目录

**Hooks:**

1. [useAutoSave -- 自动保存](#1-useautosave----自动保存)
2. [useChapterDetail -- 章节详情](#2-usechapterdetail----章节详情)
3. [useChapterMetaList -- 章节元数据列表](#3-usechaptermetalist----章节元数据列表)
4. [useProjectData -- 项目数据加载](#4-useprojectdata----项目数据加载)
5. [useProjectTaskEvents -- 任务事件流](#5-useprojecttaskevents----任务事件流)
6. [useProjectTaskRuntimeResource -- 任务运行时资源](#6-useprojecttaskruntimeresource----任务运行时资源)
7. [useSaveHotkey -- 保存快捷键](#7-usesavehotkey----保存快捷键)
8. [UnsavedChangesGuard -- 未保存变更守卫](#8-unsavedchangesguard----未保存变更守卫)
9. [useWizardProgress -- 向导进度](#9-usewizardprogress----向导进度)
10. [PersistentOutlet 系列 -- 持久化 Outlet](#10-persistentoutlet-系列----持久化-outlet)

**工具库:**

11. [copyText -- 剪贴板操作](#11-copytext----剪贴板操作)
12. [humanize -- 人性化格式化](#12-humanize----人性化格式化)
13. [lazyImportRetry -- 懒加载重试](#13-lazyimportretry----懒加载重试)
14. [motion -- 动画工具](#14-motion----动画工具)
15. [pinyin -- 拼音搜索](#15-pinyin----拼音搜索)
16. [promptTaskCatalog -- 提示词任务目录](#16-prompttaskcatalog----提示词任务目录)
17. [requestSeqGuard -- 请求序列守卫](#17-requestseqguard----请求序列守卫)
18. [routes -- 路由路径工具](#18-routes----路由路径工具)
19. [uiCopy -- UI 文案管理](#19-uicopy----ui-文案管理)

---

## Hooks

### 1. useAutoSave -- 自动保存

**文件**: `frontend/src/hooks/useAutoSave.ts`

#### 1.1 参数（AutoSaveOptions\<T\>）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用自动保存 |
| `dirty` | `boolean` | -- | 是否有未保存的变更（脏标记） |
| `saveOnIdle` | `boolean` | `false` | 是否在空闲时触发保存 |
| `delayMs` | `number` | `1000` | 防抖延迟（毫秒） |
| `getSnapshot` | `() => T \| null` | -- | 获取当前数据快照的函数 |
| `onSave` | `(snapshot: T) => void \| Promise<void>` | -- | 执行保存的回调 |
| `deps` | `unknown[]` | `[]` | 额外依赖项，变更时重新调度 |
| `flushOnUnmount` | `boolean` | `true` | 组件卸载时是否立即执行保存 |

#### 1.2 返回值（AutoSaveController）

```
{ cancel: () => void; flush: () => void }
```

- `cancel()`: 清除待执行的定时器
- `flush()`: 立即执行一次保存（如果 enabled && dirty && snapshot 非空）

#### 1.3 内部逻辑

1. 使用 `useRef` 保存 `getSnapshot`、`onSave`、`dirty`、`enabled` 的最新引用（避免闭包过期）
2. 当 `saveOnIdle && enabled && dirty` 时：
   - 获取当前快照并缓存到 `lastSnapshotRef`
   - 设置 `window.setTimeout` 定时器
   - 定时器到期后从 `lastSnapshotRef` 读取快照并调用 `onSave`
3. 当 `!enabled || !dirty || !saveOnIdle` 时清除定时器
4. 组件卸载时（如果 `flushOnUnmount === true`），调用 `controller.flush()`

#### 1.4 使用场景

- 写作页的章节内容自动保存
- 用户停止输入 1 秒后自动触发保存
- 离开页面前确保最后的修改被保存

---

### 2. useChapterDetail -- 章节详情

**文件**: `frontend/src/hooks/useChapterDetail.ts`

#### 2.1 参数

```
chapterId: string | null | undefined
options?: { enabled?: boolean }    // 默认 true
```

#### 2.2 返回值

| 字段 | 类型 | 说明 |
|------|------|------|
| `chapter` | `ChapterDetail \| null` | 章节详情数据 |
| `error` | `ApiError \| null` | 加载错误 |
| `hasLoaded` | `boolean` | 是否曾加载成功 |
| `loading` | `boolean` | 是否正在加载 |
| `stale` | `boolean` | 数据是否已过期 |
| `refresh` | `() => Promise<ChapterDetail \| null>` | 强制刷新 |

#### 2.3 内部逻辑

1. 使用 `useSyncExternalStore` 订阅全局 `chapterStore` 的详情快照
2. `subscribe` 回调根据 `chapterId` 注册/取消订阅
3. `getSnapshot` 回调从 store 同步读取最新快照
4. `useEffect` 在 `chapterId` 或 `enabled` 变化时触发加载
5. 错误 toast 通知：使用 `lastErrorKeyRef` 去重（相同 code+requestId+message 只弹一次）
6. `refresh` 调用 store 的 `loadChapterDetail(id, { force: true })`

#### 2.4 使用场景

写作页加载当前章节的完整内容（plan、content_md、summary 等）。

---

### 3. useChapterMetaList -- 章节元数据列表

**文件**: `frontend/src/hooks/useChapterMetaList.ts`

#### 3.1 参数

```
projectId: string | undefined
```

#### 3.2 返回值

| 字段 | 类型 | 说明 |
|------|------|------|
| `chapters` | `readonly ChapterListItem[]` | 章节列表（按 number 排序） |
| `error` | `ApiError \| null` | 加载错误 |
| `hasLoaded` | `boolean` | 是否曾加载成功 |
| `loading` | `boolean` | 是否正在加载 |
| `stale` | `boolean` | 数据是否已过期 |
| `refresh` | `() => Promise<ChapterListItem[]>` | 强制刷新 |

#### 3.3 内部逻辑

与 `useChapterDetail` 相同的模式：
1. `useSyncExternalStore` 订阅 `chapterStore.subscribeMeta`
2. 获取快照通过 `chapterStore.getMetaSnapshot`
3. projectId 变化时触发 `chapterStore.loadProjectChapterMeta`
4. 错误去重 toast 通知

#### 3.4 使用场景

- 写作页的章节列表侧边栏
- 向导进度计算中统计章节完成率
- 大纲页展示章节骨架

---

### 4. useProjectData -- 项目数据加载

**文件**: `frontend/src/hooks/useProjectData.ts`

#### 4.1 参数

```
projectId: string | undefined
loader: (projectId: string) => Promise<T>    // 加载函数
```

#### 4.2 返回值（ProjectDataResult\<T\>）

| 字段 | 类型 | 说明 |
|------|------|------|
| `data` | `T \| null` | 加载到的数据 |
| `setData` | `Dispatch<SetStateAction<T \| null>>` | 直接修改数据 |
| `loading` | `boolean` | 加载状态 |
| `refresh` | `() => Promise<void>` | 重新加载 |

#### 4.3 内部逻辑

1. 使用 `requestSeqGuard` 防止竞态条件（后发先至）
2. `loader` 通过 `useRef` 保持最新引用
3. `refresh` 流程：
   - 获取新的序列号 `seq = guard.next()`
   - 发起请求
   - 请求完成后检查 `guard.isLatest(seq)` -- 如果已被新请求取代则忽略结果
   - 成功：更新 data；失败：toast 错误
4. `projectId` 变化时：
   - 为空：invalidate guard + 清空 data + 停止 loading
   - 非空：调用 refresh()
5. 组件卸载时：invalidate guard（防止已卸载组件更新状态）

#### 4.4 使用场景

通用的项目级数据加载模式，用于加载设置、角色、大纲、LLM 配置等。`useWizardProgress` 中的 `wizardQuery` 就使用此 Hook。

---

### 5. useProjectTaskEvents -- 任务事件流

**文件**: `frontend/src/hooks/useProjectTaskEvents.ts`

#### 5.1 参数

```
{
  projectId: string | undefined;
  enabled?: boolean;            // 默认 true
  onSnapshot?: (snapshot: ProjectTaskEventsSnapshot) => void;
  onEvent?: (event: ProjectTaskEventEnvelope) => void;
}
```

#### 5.2 返回值

```
{ status: "idle" | "connecting" | "open" | "error" }
```

#### 5.3 核心类型

**ProjectTaskEventsSnapshot**: SSE 快照消息
```
{
  type: "snapshot";
  project_id: string;
  cursor: number;
  snapshot_at?: string | null;
  active_tasks: ProjectTaskLiveTask[];
}
```

**ProjectTaskEventEnvelope**: SSE 事件消息
```
{
  type: "event";
  seq: number;
  project_id: string;
  task_id: string;
  kind: string;
  event_type: string;
  created_at?: string | null;
  payload?: Record<string, unknown>;
}
```

#### 5.4 内部逻辑

1. 使用浏览器原生 `EventSource` API 连接 SSE 端点
2. 端点地址: `GET /api/projects/{projectId}/task-events/stream`
3. 监听两种 SSE 事件名：
   - `"snapshot"`: 解析并调用 `onSnapshot` 回调
   - `"project_task"`: 解析并调用 `onEvent` 回调
4. 连接状态管理：
   - `onopen`: 设为 `"open"`
   - `onerror`: 已连接过则设为 `"connecting"`（自动重连），否则设为 `"error"`
5. 依赖变化或卸载时调用 `source.close()` 清理
6. 不支持 EventSource 的环境返回 `status: "error"`

#### 5.5 使用场景

实时监听后台任务状态变化（如批量生成、自动更新），驱动 UI 刷新。

---

### 6. useProjectTaskRuntimeResource -- 任务运行时资源

**文件**: `frontend/src/hooks/useProjectTaskRuntimeResource.ts`

此文件导出 4 个相关 Hook：

#### 6.1 useProjectTaskListResource

```
参数: { projectId?, status?, limit?, enabled? }
返回: ProjectTaskListSnapshot & { refresh }
```

- 通过 `useSyncExternalStore` 订阅 `projectTaskStore` 的列表快照
- 自动加载未加载或已过期的数据
- refresh 支持覆盖 projectId/status/limit/force/silent

#### 6.2 useProjectTaskDetailResource

```
参数: { taskId?, enabled? }
返回: ProjectTaskDetailSnapshot & { refresh }
```

- 订阅任务详情快照
- taskId 通过 `normalizeTaskId` 规范化（trim + 空转 null）

#### 6.3 useProjectTaskRuntimeResource

```
参数: { taskId?, enabled? }
返回: ProjectTaskRuntimeSnapshot & { refresh }
```

- 订阅任务运行时快照（timeline、checkpoints、steps、artifacts）

#### 6.4 useProjectTaskLiveSync

```
参数: {
  projectId?, enabled?, trackedTaskId?,
  pollWhen?, pollIntervalMs?, debounceMs?,
  refreshOnIdleSnapshot?, pickSnapshotTaskId?,
  shouldRefreshOnEvent?, onRefresh
}
```

协调 SSE 事件流与任务数据刷新的高级 Hook：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `trackedTaskId` | -- | 当前正在跟踪的任务 ID |
| `pollWhen` | `false` | 是否启用轮询（SSE 不可用时的回退） |
| `pollIntervalMs` | `8000` | 轮询间隔 |
| `debounceMs` | `120` | 刷新防抖（防止事件密集时频繁刷新） |
| `refreshOnIdleSnapshot` | `false` | 收到快照但无特定任务时是否刷新 |
| `pickSnapshotTaskId` | -- | 从快照中提取关注的任务 ID |
| `shouldRefreshOnEvent` | -- | 是否应对此事件触发刷新 |
| `onRefresh` | -- | 刷新回调 |

工作流程：
1. 内部使用 `useProjectTaskEvents` 监听 SSE
2. 收到 snapshot 时：尝试通过 `pickSnapshotTaskId` 提取任务 ID；提取到则调度刷新
3. 收到 event 时：通过 `shouldRefreshOnEvent` 过滤，通过后调度刷新
4. 刷新通过 `debounceMs` 防抖
5. SSE 不可用（status !== "open"）且 `pollWhen === true` 时，降级为定时轮询

---

### 7. useSaveHotkey -- 保存快捷键

**文件**: `frontend/src/hooks/useSaveHotkey.ts`

#### 7.1 参数

```
onSave: () => void     // 保存回调
enabled: boolean       // 是否启用
```

#### 7.2 内部逻辑

1. 监听全局 `keydown` 事件
2. 检测 `Ctrl+S` 或 `Cmd+S`（macOS）
3. 匹配时调用 `e.preventDefault()` 阻止浏览器默认保存行为
4. 调用 `onSave()` 回调
5. `enabled` 为 false 时不注册监听器

#### 7.3 使用场景

写作页、设置页等需要快捷键保存的表单页面。

---

### 8. UnsavedChangesGuard -- 未保存变更守卫

**文件**: `frontend/src/hooks/useUnsavedChangesGuard.tsx`

注意：这是一个**组件**而非纯 Hook。

#### 8.1 Props

```
{ when: boolean }    // 是否有未保存修改
```

#### 8.2 内部逻辑

双重保护机制：

**路由内导航保护**（React Router）:
1. 使用 `useBlocker(props.when)` 阻止路由切换
2. 当 `blocker.state === "blocked"` 时弹出确认对话框
3. 对话框文案："有未保存修改，确定离开？" / "离开后未保存内容会丢失。"
4. 确认则 `blocker.proceed()`，取消则 `blocker.reset()`

**浏览器关闭/刷新保护**:
1. 当 `props.when === true` 时注册 `beforeunload` 事件
2. 调用 `e.preventDefault(); e.returnValue = ""`
3. 浏览器会弹出原生确认对话框

#### 8.3 返回值

返回 `null`（不渲染任何 DOM 元素）。

#### 8.4 使用场景

在任何包含表单的页面中使用：`<UnsavedChangesGuard when={isDirty} />`

---

### 9. useWizardProgress -- 向导进度

**文件**: `frontend/src/hooks/useWizardProgress.ts`

#### 9.1 参数

```
projectId: string | undefined
```

#### 9.2 返回值

| 字段 | 类型 | 说明 |
|------|------|------|
| `loading` | `boolean` | 数据加载中 |
| `progress` | `WizardProgress` | 计算后的向导进度 |
| `refresh` | `() => Promise<void>` | 刷新所有数据 |
| `bumpLocal` | `() => void` | 触发本地重新计算（不刷新 API） |

#### 9.3 内部逻辑

1. 使用 `useChapterMetaList(projectId)` 加载章节列表
2. 使用 `useProjectData` 并行加载 6 项数据：
   - 项目信息 (`/api/projects/{id}`)
   - 项目设置 (`/api/projects/{id}/settings`)
   - 角色列表 (`/api/projects/{id}/characters`)
   - 大纲 (`/api/projects/{id}/outline`)
   - LLM 预设 (`/api/projects/{id}/llm_preset`)
   - LLM 配置文件列表 (`/api/llm_profiles`)
3. 监听 `WIZARD_PROGRESS_INVALIDATED_EVENT` 事件：
   - 收到事件时调用 `bumpLocal()` 触发重新计算
   - 如果事件 `refresh === true`，延迟 80ms 后调用 `refreshAll()`（防抖）
4. 从加载到的数据和章节列表中匹配 LLM profile（通过 `project.llm_profile_id`）
5. 调用 `computeWizardProgress()` 计算最终进度

#### 9.4 使用场景

项目主页和侧边栏的向导进度条。

---

### 10. PersistentOutlet 系列 -- 持久化 Outlet

#### 10.1 persistentOutletContext.ts -- Context 定义

```typescript
PersistentOutletContextValue = {
  outletKey: string;   // 当前 outlet 的标识键
  activeKey: string;   // 当前激活的键
}

PersistentOutletContext = createContext<PersistentOutletContextValue | null>(null);
```

#### 10.2 PersistentOutletProvider.tsx -- Provider 组件

```typescript
function PersistentOutletProvider(props: {
  outletKey: string;
  activeKey: string;
  children: ReactNode;
})
```

将 `outletKey` 和 `activeKey` 注入 Context。

#### 10.3 usePersistentOutlet.tsx -- 活跃状态 Hook

```typescript
function usePersistentOutletIsActive(): boolean
```

- 从 Context 读取 `outletKey` 和 `activeKey`
- 当两者相等时返回 `true`（当前 outlet 处于激活状态）
- 无 Context 时默认返回 `true`

#### 10.4 设计目的

实现类似浏览器标签页的**持久化子路由**机制：
- 多个子路由组件可同时挂载（保持状态和 DOM）
- 只有 `outletKey === activeKey` 的组件处于可见/激活状态
- 切换标签时非激活组件被隐藏但不卸载，保留用户输入和滚动位置

---

## 工具库

### 11. copyText -- 剪贴板操作

**文件**: `frontend/src/lib/copyText.ts`

#### 11.1 主函数

```typescript
async function copyText(text: string, opts?: CopyTextOptions): Promise<boolean>
```

| 参数 | 说明 |
|------|------|
| `text` | 要复制的文本 |
| `opts.title` | 回退弹窗标题（默认 "复制失败，请手动复制"） |
| `opts.description` | 回退弹窗描述 |

返回 `true` 表示成功复制，`false` 表示降级到手动复制弹窗。

#### 11.2 实现策略

1. 优先使用 `navigator.clipboard.writeText()`（现代 Clipboard API）
2. API 不可用或抛出异常时，动态创建 `CopyFallbackModal` 组件
3. 弹窗通过 `createRoot` 渲染到临时 DOM 容器中
4. 弹窗关闭时卸载组件并移除容器

#### 11.3 空文本处理

传入空字符串时直接返回 `true`（不执行任何操作）。

---

### 12. humanize -- 人性化格式化

**文件**: `frontend/src/lib/humanize.ts`

将枚举值/状态码转换为中文显示文本（附英文原值）。

| 函数 | 输入示例 | 输出示例 |
|------|----------|----------|
| `humanizeYesNo(true)` | `true` | `"是（yes）"` |
| `humanizeChapterStatus("planned")` | `"planned"` | `"计划中（planned）"` |
| `humanizeChapterStatus("drafting")` | `"drafting"` | `"草稿（drafting）"` |
| `humanizeChapterStatus("done")` | `"done"` | `"定稿（done）"` |
| `humanizeTaskStatus("queued")` | `"queued"` | `"排队中（queued）"` |
| `humanizeTaskStatus("running")` | `"running"` | `"运行中（running）"` |
| `humanizeTaskStatus("done"/"succeeded")` | -- | `"完成（...）"` |
| `humanizeTaskStatus("failed")` | `"failed"` | `"失败（failed）"` |
| `humanizeChangeSetStatus("proposed")` | -- | `"未应用（proposed）"` |
| `humanizeChangeSetStatus("applied")` | -- | `"已应用（applied）"` |
| `humanizeChangeSetStatus("rolled_back")` | -- | `"已回滚（rolled_back）"` |
| `humanizeMemberRole("viewer")` | -- | `"查看者（viewer）"` |
| `humanizeMemberRole("editor")` | -- | `"编辑者（editor）"` |
| `humanizeMemberRole("owner")` | -- | `"拥有者（owner）"` |

内部使用 `formatWithKey(label, key)` 统一格式化为 `"中文（english_key）"` 模式。未知值时原样返回或返回 `"未知"`。

---

### 13. lazyImportRetry -- 懒加载重试

**文件**: `frontend/src/lib/lazyImportRetry.ts`

#### 13.1 问题背景

SPA 部署新版本后，旧版本的 chunk 文件可能被清理。用户未刷新页面时，动态 import 会失败（`Failed to fetch dynamically imported module`）。

#### 13.2 核心函数

```typescript
async function importWithChunkRetry<TModule>(importer: () => Promise<TModule>): Promise<TModule>
```

#### 13.3 重试策略

1. 先尝试正常 import
2. 成功：清除重载标记并返回模块
3. 失败且是 chunk 加载错误（通过 `isChunkLoadError` 检测）：
   - 检查 `sessionStorage` 中的重载标记（`ainovel:chunk-reload-mark`）
   - 如果标记不存在、已过期（60 秒 TTL）、或页面不同：写入标记并触发 `location.replace` 刷新
   - 刷新后返回一个永远不 resolve 的 Promise（让 React.lazy 保持 pending 状态）
   - 如果标记存在且未过期（说明刷新后仍然失败）：清除标记并抛出原始错误

#### 13.4 Chunk 加载错误检测

`isChunkLoadError(error)` 检测以下错误特征（不区分大小写）：
- `"failed to fetch dynamically imported module"`
- `"importing a module script failed"`
- `"chunkloaderror"`
- `"loading chunk"` + `"failed"`

#### 13.5 防重复刷新

通过 `sessionStorage` 的时间戳标记防止无限刷新循环：
- 标记存储格式：`{ at: timestamp, href: currentUrl }`
- TTL 为 60 秒
- 不同页面允许再次重试

---

### 14. motion -- 动画工具

**文件**: `frontend/src/lib/motion.ts`

基于 framer-motion 的动画常量定义。

#### 14.1 缓动函数

```
easeStandard = [0.25, 0.1, 0.25, 1]   // CSS ease 标准曲线
```

#### 14.2 时长常量

| 名称 | 值（秒） | 用途 |
|------|---------|------|
| `duration.fast` | 0.15 | 快速过渡（按钮/图标） |
| `duration.base` | 0.25 | 标准过渡 |
| `duration.slow` | 0.35 | 慢速过渡 |
| `duration.stagger` | 0.03 | 列表项交错延迟 |
| `duration.page` | 0.3 | 页面切换 |

#### 14.3 过渡配置

| 名称 | 配置 |
|------|------|
| `transition.fast` | `{ duration: 0.15, ease: easeStandard }` |
| `transition.reduced` | `{ duration: 0.01 }` -- 无障碍减少动画模式 |
| `transition.base` | `{ duration: 0.25, ease: easeStandard }` |
| `transition.slow` | `{ duration: 0.35, ease: easeStandard }` |
| `transition.page` | `{ duration: 0.3, ease: easeStandard }` |

#### 14.4 预定义动画变体（Variants）

**fadeUpVariants**: 淡入上移动画
```
initial: { opacity: 0, y: 10 }
animate: { opacity: 1, y: 0 }
exit:    { opacity: 0, y: 10 }
```

**overlayFadeVariants**: 遮罩层淡入动画
```
initial: { opacity: 0 }
animate: { opacity: 1 }
exit:    { opacity: 0 }
```

---

### 15. pinyin -- 拼音搜索

**文件**: `frontend/src/lib/pinyin.ts`

基于 `pinyin-pro` 库实现中文拼音搜索支持。

#### 15.1 核心类型

```
PinyinMatchMode = "pinyin_full" | "pinyin_initials"
PinyinMatchResult = { matched: boolean; mode: PinyinMatchMode | null }
PinyinIndex = { full: string; initials: string }
```

#### 15.2 拼音索引生成（getPinyinIndex）

```typescript
function getPinyinIndex(text: string): PinyinIndex | null
```

- 不含中文字符时返回 `null`
- 使用 `pinyin-pro` 生成两种索引：
  - `full`: 完整拼音（无声调，连写，如 "张三" -> "zhangsan"）
  - `initials`: 首字母拼音（如 "张三" -> "zs"）
- 结果缓存到 `PINYIN_INDEX_CACHE`（Map）

#### 15.3 拼音匹配（containsPinyinMatch）

```typescript
function containsPinyinMatch(text: string, token: string): PinyinMatchResult
```

- 将 token 通过 `normalizeAsciiToken` 标准化（NFKD 分解 + 去变音符 + 小写 + 保留字母数字）
- 在目标文本的拼音索引中查找 token
- 先尝试全拼匹配，再尝试首字母匹配

#### 15.4 辅助函数

| 函数 | 说明 |
|------|------|
| `hasChinese(text)` | 检测是否包含 CJK 统一汉字（\u3400-\u9fff） |
| `normalizeAsciiToken(value)` | NFKD 标准化 + 去变音符 + 小写 + 保留 a-z0-9 |
| `tokenizeSearch(value)` | 将搜索输入按空格分词，小写化 |
| `looksLikePinyinToken(token)` | 判断 token 是否包含拉丁字母（是否可能是拼音） |

#### 15.5 使用场景

全项目搜索引擎中，支持用户用拼音或首字母搜索中文角色名/章节名/世界书条目。

---

### 16. promptTaskCatalog -- 提示词任务目录

**文件**: `frontend/src/lib/promptTaskCatalog.ts`

#### 16.1 任务目录

`PROMPT_TASK_CATALOG` 是一个只读数组，定义了所有提示词任务类型：

| key | 显示名称 |
|-----|---------|
| `outline_generate` | 大纲（outline_generate） |
| `chapter_generate` | 章节（chapter_generate） |
| `plan_chapter` | 规划（plan_chapter，M3） |
| `post_edit` | 润色（post_edit，M3） |
| `content_optimize` | 正文优化（content_optimize，P0） |
| `chapter_analyze` | 章节分析（chapter_analyze，P2） |
| `chapter_rewrite` | 章节重写（chapter_rewrite，P2） |

每个条目包含 `key`（后端接口标识）、`uiCopyKey`（UI 文案键）、`label`（显示文本）。

#### 16.2 派生常量

```
PROMPT_STUDIO_TASKS: PromptStudioTask[] = [{ key, label }, ...]
PROMPT_TASK_KEYS: string[] = ["outline_generate", "chapter_generate", ...]
```

---

### 17. requestSeqGuard -- 请求序列守卫

**文件**: `frontend/src/lib/requestSeqGuard.ts`

#### 17.1 问题背景

解决异步请求的**竞态条件**（后发先至）问题。例如：用户快速切换章节，先发出的 A 请求在后发的 B 请求之后返回，此时 A 的结果不应覆盖 B 的结果。

#### 17.2 API

```typescript
type RequestSeqGuard = {
  next: () => number;           // 获取新序列号（递增）
  isLatest: (seq: number) => boolean;  // 判断是否仍是最新序列
  invalidate: () => void;       // 使所有已发出的序列号失效
}
```

#### 17.3 实现

```typescript
function createRequestSeqGuard(): RequestSeqGuard {
  let current = 0;
  return {
    next: () => { current += 1; return current; },
    isLatest: (seq) => seq === current,
    invalidate: () => { current += 1; },
  };
}
```

极简实现：递增计数器。`next()` 和 `invalidate()` 都使计数器递增，只有最后一次 `next()` 返回的序列号等于当前值。

#### 17.4 测试覆盖（requestSeqGuard.test.ts）

验证：
- `next()` 后 `isLatest` 为 true
- 再次 `next()` 后旧序列号的 `isLatest` 为 false
- `invalidate()` 使所有序列号失效

#### 17.5 使用场景

`useProjectData` Hook 中使用，确保 projectId 快速切换时只处理最新请求的响应。

---

### 18. routes -- 路由路径工具

**文件**: `frontend/src/lib/routes.ts`

#### 18.1 路由元数据

每条路由定义包含：
```
RouteMeta = { suffix: string; title: string; layout: RouteLayout }
RouteLayout = "home" | "paper" | "tool"
```

- `"home"`: 首页布局
- `"paper"`: 纸面布局（settings、characters、outline、preview、export）
- `"tool"`: 工具布局（writing、tasks、worldbook、search、graph 等）

#### 18.2 路由表

共 24 条路由映射（通过 `pathname.endsWith(suffix)` 匹配）：

| 路径后缀 | 标题 | 布局 |
|----------|------|------|
| `/admin/users` | 用户管理 | tool |
| `/settings` | 项目设置 | paper |
| `/characters` | 角色卡 | paper |
| `/outline` | 大纲 | paper |
| `/wizard` | 开工向导 | tool |
| `/writing` | 写作 | tool |
| `/tasks` | 任务中心 | tool |
| `/structured-memory` | 图谱底座数据 | tool |
| `/numeric-tables` | 数值表格 | tool |
| `/foreshadows` | 伏笔 | tool |
| `/chapter-analysis` | 剧情记忆 | tool |
| `/preview` | 预览 | paper |
| `/reader` | 阅读 | tool |
| `/export` | 导出 | paper |
| `/worldbook` | 世界书 | tool |
| `/rag` | 知识库 | tool |
| `/search` | 搜索引擎 | tool |
| `/graph` | 图谱/关系 | tool |
| `/fractal` | 分形 | tool |
| `/styles` | 风格 | tool |
| `/prompts` | 模型配置 | tool |
| `/prompt-studio` | 提示词工作室 | tool |
| `/prompt-templates` | 提示词模板 | tool |
| `/import` | 导入 | tool |

#### 18.3 解析函数

```typescript
function resolveRouteMeta(pathname: string): { title: string; layout: RouteLayout }
```

- 首页 `/` 返回 `{ title: "首页", layout: "home" }`
- 匹配路由表中的后缀返回对应 title 和 layout
- 未匹配返回 `{ title: "ainovel Atelier", layout: "tool" }`

#### 18.4 测试覆盖（routes.test.ts）

验证 foreshadows/import/prompt-templates 路径能正确解析，未知路径回退到 app name。

---

### 19. uiCopy -- UI 文案管理

**文件**: `frontend/src/lib/uiCopy.ts`

#### 19.1 设计理念

所有 UI 可见文案集中管理在 `UI_COPY` 常量对象中，实现：
- 文案与组件解耦
- 便于国际化扩展
- 统一术语表

#### 19.2 结构概览

`UI_COPY` 是一个深度嵌套的只读对象（`as const`），按功能模块组织：

| 模块 | 说明 | 包含的文案数量 |
|------|------|---------------|
| `common` | 通用文案 | 4 条（加载中、参数降级前缀、复制、请求 ID 标签） |
| `brand` | 品牌 | 1 条（appName: "ainovel Atelier"） |
| `nav` | 导航 | 约 30 条（所有页面标题、导航菜单标签） |
| `notFound` | 404 页面 | 2 条 |
| `help` | 帮助/术语 | 术语列表 7 条 + 排障提示 2 条 |
| `search` | 搜索引擎 | 约 20 条（来源标签、按钮、提示） |
| `chapterAnalysis` | 剧情记忆 | 6 条 |
| `vectorRag` | 向量检索配置 | 约 15 条 |
| `structuredMemory` | 图谱底座数据 | 标签页标签 + 操作提示约 10 条 |
| `auth` | 认证 | 约 25 条（登录/注册/LinuxDo 相关） |
| `writing` | 写作 | 约 50 条（上下文预览、记忆更新抽屉、伏笔面板） |
| `worldbook` | 世界书 | 约 50 条（CRUD、批量操作、预览触发、编辑抽屉） |
| `rag` | RAG 管理 | 约 15 条 |
| `graph` | 图谱 | 约 15 条 |
| `promptStudio` | 提示词工作室 | 约 20 条 + 任务标签 7 条 |
| `fractal` | 分形记忆 | 5 条 |
| `taskCenter` | 任务中心 | 4 条 |
| `featureDefaults` | 默认行为配置 | 约 10 条 |

#### 19.3 典型用法

```typescript
import { UI_COPY } from "../lib/uiCopy";

// 在组件中使用
<h1>{UI_COPY.nav.writing}</h1>
<button>{UI_COPY.worldbook.save}</button>
```

#### 19.4 术语表（help.terms）

UI 中内置了 7 条常用术语的速查定义：
- 提示词（prompt）
- 向量化（embedding）
- 重排（rerank）
- 检索增强生成（RAG）
- 知识库（KB）
- 请求 ID（request_id）
- JSON
