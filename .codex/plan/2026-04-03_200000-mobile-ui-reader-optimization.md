# Plan: 手机端UI适配 + 预览阅读页优化

## Goal
- 对 MOB-018~020 之后新增/修改的所有页面进行手机端 UI 全面适配
- 对预览页(PreviewPage)进行 PC 端和手机端的小说阅读体验优化,达到专业小说阅读器水准
- 成功标志：所有新页面在 640px 以下屏幕正常使用；预览页阅读体验舒适、排版专业

## Scope

### In Scope

**任务一：手机端 UI 适配 (MOB-R01~R04)**
- `DetailedOutlineSection.tsx` — 两栏布局手机适配、按钮组响应式、Modal 手机优化
- `OutlineParsingSection.tsx` — Agent 仪表板手机适配、解析结果 Tab 手机优化、应用按钮组响应式
- `EntriesPage.tsx` — 验证已有 mobile 处理、修复发现的问题
- `DashboardPage.tsx` — MODE-001 新增的模式选择 radio 按钮手机端样式

**任务二：预览/阅读页优化 (READER-01~04)**
- 中文段落首行缩进 2em (CSS `.atelier-content p`)
- 阅读区最优宽度 (600-760px 而非 max-w-4xl 嵌套)
- 行高、字号、段间距优化为舒适阅读参数
- 章节标题居中美化
- 手机端阅读体验：全宽、合理 padding、沉浸式
- 工具栏精简：手机端收纳到浮动底部栏
- 翻页导航优化：手机端固定底部、上下章快捷操作

### Out of Scope
- PC 端现有页面（非预览页）的 UI 修改
- 后端 API / 数据库变更
- 功能逻辑变更（仅 UI/样式修改）
- 新增阅读设置面板（字号/主题切换等高级功能，留待后续）

## Assumptions / Dependencies
- 使用项目已有的 `useIsMobile()` hook (640px breakpoint)
- 使用项目已有的 Tailwind 响应式类 (`sm:`, `lg:`)
- 使用项目已有的 Drawer 组件实现手机端面板
- `.atelier-content` 样式在 `index.css` 中定义,可安全扩展
- 预览页使用 `react-markdown` 渲染,CSS 作用于渲染后的 HTML 元素

## Phases

### Phase 1: 手机端 UI 适配 (MOB-R01~R04)

#### MOB-R01: DetailedOutlineSection 手机适配
修改文件: `frontend/src/pages/outline/DetailedOutlineSection.tsx`

1. VolumeDetail 按钮组响应式改造：
   - 手机端(<sm)按钮用 `grid grid-cols-2 gap-2` 排列,每个按钮全宽
   - PC 端保持现有 `flex items-center gap-2` 行内排列
   - 删除按钮在手机端放在最下方,明确分隔

2. 两栏布局手机优化：
   - 现有 `sm:grid-cols-[240px_1fr]` 已在<640px 折叠为单列 — 验证足够
   - 卷列表在手机端加 horizontal scroll 或限制高度

3. Modal 内容手机优化：
   - `DetailedOutlineGenerationModal`: `max-w-2xl` → 手机端 padding 减小 `p-4 sm:p-6`
   - `ChapterSkeletonGenerationModal`: 同上 + 流式输出区 `max-h-40 sm:max-h-60`
   - Modal 内表单 grid 在手机端单列

#### MOB-R02: OutlineParsingSection 手机适配
修改文件: `frontend/src/pages/outline/OutlineParsingSection.tsx`

1. AgentCard 布局：
   - streaming text 区域手机端限高 `max-h-[40px] sm:max-h-[60px]`
   - 统计信息 flex wrap 确保不溢出

2. 解析结果 Tab 按钮：
   - 手机端 Tab 按钮全宽 stack: `flex flex-col sm:flex-row sm:flex-wrap gap-2`
   - 或改为 horizontal scroll

3. Apply 按钮组：
   - 手机端 `grid grid-cols-2 gap-2` 排列
   - "全部应用" 按钮单独一行 full-width

4. Modal padding: `p-4 sm:p-6`

#### MOB-R03: EntriesPage 手机验证与修复
修改文件: `frontend/src/pages/EntriesPage.tsx`

1. 验证已有 useIsMobile 使用是否覆盖所有交互
2. 检查 tag filter chips 在手机端是否 overflow-x-auto
3. 检查 entry 编辑 Drawer 在手机端体验
4. 修复发现的任何问题

#### MOB-R04: DashboardPage 模式选择手机适配
修改文件: `frontend/src/pages/DashboardPage.tsx`

1. 创建模式 radio 选择区手机端样式：
   - radio 选项卡片在手机端全宽堆叠
   - 描述文字不被截断
   - 触摸目标足够大 (min-h-44px)

### Phase 2: 预览/阅读页优化 (READER-01~04)

#### READER-01: 阅读排版优化 — CSS 层
修改文件: `frontend/src/index.css`

1. `.atelier-content` 扩展阅读排版样式：
```css
.atelier-content p {
  text-indent: 2em;           /* 中文首行缩进 */
  margin-bottom: 0.8em;       /* 段间距 */
}

.atelier-content {
  font-size: 18px;            /* 舒适阅读字号 */
  line-height: 1.9;           /* 加宽行高 */
  letter-spacing: 0.02em;     /* 微增字间距 */
  word-break: break-all;      /* 中文换行 */
  text-align: justify;        /* 两端对齐 */
}

/* 标题样式 */
.atelier-content h1,
.atelier-content h2,
.atelier-content h3 {
  text-indent: 0;             /* 标题不缩进 */
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

/* 手机端微调 */
@media (max-width: 639px) {
  .atelier-content {
    font-size: 17px;
    line-height: 1.85;
  }
}
```

2. 注意：此修改影响所有使用 `.atelier-content` 的地方，需确认仅在预览页和编辑器预览中使用。如果其他地方也用到，考虑用 `.atelier-reader` 新类替代。

#### READER-02: 预览页布局优化 — 结构层
修改文件: `frontend/src/pages/PreviewPage.tsx`

1. 阅读区宽度优化：
   - 当前: `PaperContent(max-w-4xl=896px)` 内嵌 `max-w-4xl` → 实际被 panel padding 压缩
   - 优化: 阅读内容区用 `max-w-prose` (65ch ≈ 650px) 或 `max-w-[720px]` + 合理 padding
   - 无侧边栏时内容居中，有侧边栏时内容区自然扩展

2. 章节标题区域美化：
   - 章节号 + 标题居中显示
   - 使用 `font-content` 字体
   - 加上分隔线或装饰元素
   - 标题下方显示章节状态（如非定稿）

3. 内容区 padding 优化：
   - PC: `px-12 py-10` (更宽裕的阅读留白)
   - 手机: `px-5 py-6` (适度留白,不浪费屏幕)

#### READER-03: 手机端阅读体验优化
修改文件: `frontend/src/pages/PreviewPage.tsx`

1. 手机端阅读模式：
   - 内容区全宽,无 panel 边框 (手机上 panel border 浪费空间)
   - 或者 panel 改为 `border-0 shadow-none` 在手机端

2. 手机端章节导航：
   - 固定底部栏: `fixed bottom-0 left-0 right-0` 带上一章/下一章按钮
   - 替代当前顶部按钮组（手机端隐藏顶部翻页按钮）
   - 底部栏样式: 毛玻璃效果 `backdrop-blur bg-surface/80`

3. 手机端工具栏精简：
   - 顶部只保留: 返回按钮 + 章节列表按钮
   - "编辑"按钮移到底部栏或章节标题区域

#### READER-04: 工具栏与导航重构
修改文件: `frontend/src/pages/PreviewPage.tsx`

1. PC 端工具栏整理：
   - 左侧: 返回按钮 + 章节列表切换
   - 中间: 当前章节信息
   - 右侧: 上一章/下一章 + 编辑按钮
   - 移除快捷键提示文字（hover tooltip 代替）

2. 键盘快捷键保持不变（左右箭头翻页）

## Tests & Verification
- MOB-R01~R04: 浏览器开发者工具 375px/390px 宽度下各页面正常显示 → 手动验证
- READER-01: 预览页中文段落有 2em 首行缩进 → 视觉验证
- READER-02: 预览页阅读区宽度适中,非过窄长条 → 视觉验证
- READER-03: 手机端固定底部导航栏可正常翻页 → 手动验证
- READER-04: PC 端工具栏布局清晰 → 视觉验证
- 全局: `npm run build` 无错误 → 构建验证

## Issue CSV
- Path: `.codex/issues/2026-04-03_200000-mobile-ui-reader-optimization.csv`
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- Codex (gpt-5.4, full-access, xhigh thinking) — 所有代码修改
- Codex review — 代码审查
- Chrome DevTools MCP — 可选,用于截图验证

## Acceptance Checklist
- [ ] DetailedOutlineSection 手机端按钮不溢出,Modal 正常显示
- [ ] OutlineParsingSection Agent 仪表板手机端可读,按钮不挤压
- [ ] EntriesPage 手机端无明显 UI 问题
- [ ] DashboardPage 模式选择手机端正常显示
- [ ] 预览页中文段落有首行缩进
- [ ] 预览页阅读区宽度舒适 (650-750px)
- [ ] 预览页手机端有固定底部翻页栏
- [ ] 预览页手机端工具栏精简
- [ ] 预览页章节标题美观居中
- [ ] npm run build 无错误
- [ ] Codex review 通过
- [ ] Claude 手动验证符合需求

## Risks / Blockers
- `.atelier-content` 样式修改可能影响编辑器预览 — 需检查使用范围,必要时用新类名
- 手机端固定底部栏可能与 WizardNextBar 冲突 — 需测试共存
- Codex CLI 不可用时必须停止,不可自行修改

## Rollback / Recovery
- 所有修改都是纯前端 CSS/JSX,git revert 即可回退
- 按 issue 分 commit,可精确回退单个功能

## Checkpoints
- Commit after: MOB-R01~R04 (手机端适配批次)
- Commit after: READER-01~R04 (阅读页优化批次)
- Commit after: Review + Verification

## References
- 上次手机适配: commit `8fd98d8` [MOB-018~020]
- PreviewPage: `frontend/src/pages/PreviewPage.tsx`
- DetailedOutlineSection: `frontend/src/pages/outline/DetailedOutlineSection.tsx`
- OutlineParsingSection: `frontend/src/pages/outline/OutlineParsingSection.tsx`
- EntriesPage: `frontend/src/pages/EntriesPage.tsx`
- DashboardPage: `frontend/src/pages/DashboardPage.tsx`
- CSS styles: `frontend/src/index.css:408-418` (.atelier-content)
- useIsMobile hook: `frontend/src/hooks/useIsMobile.ts`
- Drawer component: `frontend/src/components/ui/Drawer.tsx`
- PaperContent layout: `frontend/src/components/layout/AppShell.tsx:184-198`
