# Plan: 新建项目模式选择 — 逐步生成 vs 解析模式

## Goal

在新建项目弹窗中增加"创建模式"选择：
1. **逐步生成模式**（默认）：与当前行为完全一致，按 settings → characters → llm → outline → ... 顺序推进
2. **解析模式**：创建后直接跳到「模型配置并测试连接」步骤，自动跳过「补齐设定」和「添加角色卡」两步（标记为已跳过），用户从模型配置开始 → 大纲智能解析 → 后续流程

成功标志：两种模式均可正常创建项目，向导步骤按模式正确展示，不影响已有项目。

## Scope

### In Scope
- Frontend: DashboardPage.tsx 创建项目弹窗增加模式选择 UI
- Frontend: 创建后根据模式跳步（调用已有 setWizardStepSkipped）
- Frontend: 创建后根据模式导航到不同页面

### Out of Scope
- 后端 API / 数据库变更（纯前端改动）
- wizard.ts 核心逻辑改动（使用已有 skip 机制）
- 大纲智能解析功能本身（已完善）
- ProjectWizardPage.tsx 向导页面布局（skip 机制自动处理显示）

## Assumptions / Dependencies
- `setWizardStepSkipped()` 已在 wizard.ts 中实现且稳定
- 向导步骤清单会自动根据 skip 状态显示"已跳过"
- 解析模式用户在模型配置完成后，自然进入大纲页使用智能解析

## Phases

### Phase 1: DashboardPage 创建项目弹窗改造 (MODE-001)

**修改 `frontend/src/pages/DashboardPage.tsx`**:

1. `CreateProjectForm` 类型增加 `mode` 字段：
```typescript
type CreateProjectForm = {
  name: string;
  genre: string;
  logline: string;
  mode: "generate" | "parse";
};
```

2. `form` 初始值增加 `mode: "generate"`

3. 创建项目弹窗中，在 logline textarea 下方、按钮区上方，添加"创建模式"选择区：
```
创建模式
  ○ 逐步生成（推荐）
    按步骤完成设定、角色、模型配置等，适合从零开始创作。
  ● 智能解析
    直接跳到模型配置，用智能解析导入已有大纲/角色/条目。
```

UI 要求：
- 使用 radio button 组（原生 input[type=radio]，class="radio"）
- 每个选项有标题 + 一行描述文字
- 逐步生成选项带"推荐"标签（与向导页风格一致）
- 整体布局与现有表单风格统一

4. 创建按钮 onClick 逻辑修改——创建成功后的导航：
```typescript
// 创建成功后
if (form.mode === "parse") {
  setWizardStepSkipped(res.data.project.id, "settings", true);
  setWizardStepSkipped(res.data.project.id, "characters", true);
  navigate(`/projects/${res.data.project.id}/prompts`);
} else {
  navigate(`/projects/${res.data.project.id}/settings`);
}
```

5. 需要新增 import：`import { setWizardStepSkipped } from "../services/wizard";`

6. 重置表单时也重置 mode：`setForm({ name: "", genre: "", logline: "", mode: "generate" })`

## Tests & Verification
- 逐步生成模式：创建项目 → 跳转到 settings 页 → 向导显示 settings 为"下一步" ✓
- 解析模式：创建项目 → 跳转到 prompts 页 → 向导显示 settings/characters 为"已跳过"，llm 为"下一步" ✓
- 已有项目不受影响 ✓
- npm run build 通过 ✓

## Issue CSV
- Path: `.codex/issues/2026-04-03_180000-project-creation-mode-selection.csv`

## Acceptance Checklist
- [ ] 创建项目弹窗显示模式选择（默认逐步生成）
- [ ] 逐步生成模式行为与改动前完全一致
- [ ] 解析模式创建后跳转到模型配置页
- [ ] 解析模式向导中"补齐设定"和"添加角色卡"显示为"已跳过"
- [ ] 解析模式向导"下一步"指向"配置模型并测试连接"
- [ ] 已有项目打开不受影响
- [ ] npm run build 无错误

## Risks / Blockers
- 风险极低，仅修改一个文件，使用已有机制

## Rollback / Recovery
- 回退 DashboardPage.tsx 单文件即可

## Checkpoints
- Commit after: MODE-001 实现 + Review

## References
- DashboardPage 创建弹窗: `frontend/src/pages/DashboardPage.tsx:415-487`
- wizard skip 机制: `frontend/src/services/wizard.ts:90-99`
- 向导步骤定义: `frontend/src/services/wizard.ts:169-238`
- 智能解析入口: `frontend/src/pages/outline/OutlinePageSections.tsx:93`
