# Plan: 提示词工作室完全重构 + 默认提示词优化

## Goal
- 完全重构提示词工作室前端和部分后端, 大幅简化操作界面
- 基于参考提示词学习优化当前默认提示词内容
- 成功标志: 新的提示词工作室只有5个左侧分类, 右侧只有下拉选择+名字+内容编辑, 功能不丢失

## Scope
- In:
  - 前端: PromptStudioPage 完全重写, StylesPage 合并进 PromptStudio
  - 后端: 新增简化 API facade, 优化默认提示词模板内容
  - 导航: 移除独立的 StylesPage 入口, 更新路由
- Out:
  - PromptsPage (LLM配置页) 不变
  - 后端 PromptPreset/PromptBlock 核心模型不变
  - 提示词渲染引擎 render_preset_for_task() 不变
  - 数据库迁移结构不变

## Assumptions / Dependencies
- 后端的 PromptPreset+PromptBlock 模型和渲染管道保持不变, 新 API 只是 facade
- 写作风格用已有的 WritingStyle 模型
- 前端使用 React+TypeScript+Tailwind 现有技术栈

## Phases

### Phase 1: 默认提示词内容优化 (Task 1)
基于参考提示词 (提示词学习参考/) 优化5个默认资源预设的 soft prompt 内容:
1. **outline_generate_v3** - 增强 sys.outline.role 的写作方法论
2. **chapter_generate_v4** - 增强 sys.chapter.core_role 和 sys.chapter.plot_tools
3. **plan_chapter_v1** - 增强 sys.plan_chapter.role 的章节规划指导
4. **post_edit_v1** - 增强 sys.post_edit.role 和 sys.post_edit.sanitize
5. **content_optimize_v1** - 增强 sys.content_optimize.role

优化方向 (从参考提示词提取):
- 反AI味: 避免重复句式/空泛词汇/机械逻辑, 加入口语化转折语
- 展示不讲述: 用动作+感官细节, 不用空泛抒情堆砌
- 五感代入: 视觉/听觉/嗅觉/触觉/味觉 画面感
- 冲突驱动: 每场景必须有冲突+代价+推进
- 人设防崩: 行为=过往经历+当前利益+性格底色
- 钩子设计: 章结尾留悬念
- 语言去油: 克制高疲劳词, 用具体场面替代口号

### Phase 2: 后端简化 API (Task 2 - Backend)
在不修改核心模型的前提下, 新增简化的 API facade:

**新增5个API端点:**
1. `GET /api/projects/{pid}/prompt_studio/categories` - 返回5个分类及其preset列表
2. `GET /api/projects/{pid}/prompt_studio/presets/{preset_id}` - 返回简化的preset (name + content)
3. `POST /api/projects/{pid}/prompt_studio/presets` - 创建新preset (category + name + content)
4. `PUT /api/projects/{pid}/prompt_studio/presets/{preset_id}` - 更新 name + content
5. `DELETE /api/projects/{pid}/prompt_studio/presets/{preset_id}` - 删除preset
6. `PUT /api/projects/{pid}/prompt_studio/presets/{preset_id}/activate` - 设为当前使用

**关键: "content" 映射逻辑:**
- 对于大纲生成/章节生成/章节分析/章节重写: content 映射到 preset 的指定 "guidance" block
- 对于写作风格: content 映射到 WritingStyle.prompt_content
- 所有 hard constraint blocks (output contract, material injection, etc.) 由后端自动管理

**新增后端服务:**
- `prompt_studio_service.py` - facade 服务, 封装 preset/block CRUD + WritingStyle CRUD

### Phase 3: 前端完全重写 (Task 2 - Frontend)
**删除/替换:**
- 旧的 `pages/promptStudio/` 目录下所有文件 (PresetListPanel, PresetEditorPanel, PreviewPanel, types, utils)
- 旧的 `pages/StylesPage.tsx` (功能合并到新 PromptStudio)

**新建:**
- `pages/promptStudio/PromptStudioPage.tsx` - 新的主页面 (左右布局)
- `pages/promptStudio/CategoryListPanel.tsx` - 左侧5个分类列表
- `pages/promptStudio/PresetEditorPanel.tsx` - 右侧: 下拉选择 + 名字 + 内容编辑
- `pages/promptStudio/types.ts` - 简化的类型定义
- `pages/promptStudio/usePromptStudio.ts` - 状态管理 hook

**UI设计:**
```
┌──────────────────────────────────────────────────────────┐
│ 提示词工作室                                              │
├─────────────┬────────────────────────────────────────────┤
│             │  下拉选择: [默认大纲生成 ▼]  [新建] [删除]  │
│  大纲生成   │  ──────────────────────────────────────     │
│  章节生成   │  名称: [________________]                   │
│  章节分析   │  ──────────────────────────────────────     │
│  章节重写   │  提示词内容:                                │
│  写作风格   │  ┌──────────────────────────────────────┐  │
│             │  │                                      │  │
│  ○ 选中高亮 │  │  (用户编辑的描述性软提示词)            │  │
│             │  │                                      │  │
│             │  │                                      │  │
│             │  └──────────────────────────────────────┘  │
│             │                              [使用此预设]   │
│             │                              [保存]        │
├─────────────┴────────────────────────────────────────────┤
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Phase 4: 路由与导航更新
- 移除 StylesPage 路由
- 更新 appShellNavConfig: 移除 styles 导航项
- 确保 PromptStudio 包含写作风格功能

### Phase 5: 集成测试与清理
- 验证5个分类的 CRUD 操作正常
- 验证提示词预设选择→生成→发送到LLM 流程正常
- 验证写作风格在 PromptStudio 中的管理正常
- 清理旧文件和未使用的代码

## Tests & Verification
- 后端API: 手动API测试 (curl/httpie), 验证每个新端点
- 前端UI: 手动浏览器测试, 验证5个分类的完整CRUD流程
- 集成: 在写作页面触发生成, 验证提示词正确注入LLM请求
- 回归: npm run build 无报错, npm run lint 通过

## Issue CSV
- Path: issues/2026-03-27_13-00-00-prompt-studio-refactor.csv
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- chrome-devtools: 前端UI测试
- manual: 后端API测试

## Acceptance Checklist
- [ ] 5个默认提示词模板已优化 (融入参考提示词精华)
- [ ] 后端简化 API 正常工作 (6个端点)
- [ ] 前端新 PromptStudio 页面正常渲染
- [ ] 左侧5个分类可选择, 右侧可下拉/编辑/保存
- [ ] 写作风格从独立页面合并到 PromptStudio
- [ ] 旧的复杂 PromptStudio UI 已替换
- [ ] StylesPage 路由已移除
- [ ] npm run build 通过
- [ ] 生成流程端到端正常 (提示词正确注入)

## Risks / Blockers
- 后端 facade API 需要正确映射 content 到底层 PromptBlock, 映射逻辑需仔细设计
- 写作风格合并到 PromptStudio 需要统一接口 (WritingStyle vs PromptPreset 是不同模型)
- 旧的 PromptStudio 页面可能有其他页面引用

## Rollback / Recovery
- git branch 隔离, 可随时回退
- 不改动核心渲染引擎, 降低风险
- 旧文件先不删除, 确认新功能完全正常后再清理

## Checkpoints
- Commit after: Phase 1 (提示词优化)
- Commit after: Phase 2 (后端 API)
- Commit after: Phase 3+4 (前端重写+路由)
- Commit after: Phase 5 (集成测试通过)

## References
- backend/app/resources/prompt_presets/ - 现有默认提示词资源
- frontend/src/pages/promptStudio/ - 现有前端组件
- frontend/src/pages/StylesPage.tsx - 写作风格页面
- backend/app/services/prompt_presets.py - 渲染管道
- backend/app/models/prompt_preset.py - 数据模型
- backend/app/models/writing_style.py - 写作风格模型
- 提示词学习参考/ - 参考提示词文件
