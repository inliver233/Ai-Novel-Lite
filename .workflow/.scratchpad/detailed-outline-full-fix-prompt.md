# 细纲生成系统全面修复任务

## 你的角色
你是总指挥，所有代码修改必须调用 Codex 的 full access 模式执行：
```
codex exec -m gpt-5.4 --sandbox danger-full-access --json -C "E:/毕设小说简化工程/Ai-Novel-Demo" "prompt"
```
你自己不能直接修改代码，只能调用 Codex。如果 Codex 不可用，停下来询问我。

## 项目背景
这是一个 AI 小说写作项目（FastAPI 后端 + React/TypeScript 前端）。

## 当前问题
细纲（详细大纲）生成系统存在多个问题，导致用户无法正常使用。大纲生成和智能解析功能完全正常，但细纲相关功能全线报错。

### 核心症状
1. 智能解析完成 → 点击全部保存 → 自动触发细纲生成 → 报 SSE error
2. 切到细纲 tab → 点击生成 → 报 SSE error  
3. 后端日志显示：`LLM_UPSTREAM_ERROR`，`output_chars: 0`，说明 LLM 调用完全失败

### 已排查确认的事实
- **大纲生成**（outline_generate）完全正常，同一个 LLM 配置、同一个 API key
- **智能解析**（outline_parse）完全正常
- **细纲生成**（detailed_outline_generate）调用 LLM 失败
- 三者使用完全相同的项目级 LLM 配置（LLMPreset），区别只在 prompt 模板

### 已完成的修复（但不够）
1. `resolve_task_llm_config` 的 AppError 异常用 try/except 包裹 — ✅ 已修复
2. `get_active_preset_for_task` 添加了 `detailed_outline_generate` 的 autocreate — ✅ 已修复  
3. SSE 包装函数添加了顶层 try/except 兜底 — ✅ 已修复
4. 前端"生成细纲"按钮已移除 — ✅ 已修复

### 真正的根因（未修复）
LLM 调用本身返回 `LLM_UPSTREAM_ERROR`（output_chars=0）。最可能的原因：
- `detailed_outline_generate_v1` 的 prompt 模板和 `call_llm_and_record` 的调用方式可能与大纲生成（outline_generate_v3）存在不兼容
- 需要对比两者的调用链，找出差异

## 你需要做的事

### 第一步：全面对比调查
对比以下两条调用链，找出所有差异：

**大纲生成（正常工作）：**
```
backend/app/services/outline_generation/prepare_service.py → resolve + render
backend/app/services/outline_generation/app_service.py → call_llm_and_record
backend/app/resources/prompt_presets/outline_generate_v3/ → 模板文件
```

**细纲生成（失败）：**
```
backend/app/services/detailed_outline_generation/prepare_service.py → render values
backend/app/services/detailed_outline_generation/app_service.py → render_preset_for_task + call_llm_and_record
backend/app/resources/prompt_presets/detailed_outline_generate_v1/ → 模板文件
```

重点对比：
1. `render_preset_for_task` 的调用参数是否一致
2. `call_llm_and_record` 的调用参数是否一致  
3. prompt preset 的 `preset.json` 结构是否和 outline_generate_v3 一致（blocks 定义、role、identifier 格式等）
4. 模板里使用的变量名是否和 `prepare_service.py` 提供的 render_values 完全匹配
5. 生成的 prompt_system / prompt_user / prompt_messages 的格式是否和 outline_generate 一致

### 第二步：修复所有差异
确保 `detailed_outline_generate` 的调用链和 `outline_generate` 完全对齐：
- preset.json 的结构、字段名、block 定义方式必须和 outline_generate_v3 保持一致
- call_llm_and_record 的参数传递方式必须一致
- 任何能导致 LLM 拒绝响应或报错的模板问题都要修复

### 第三步：修复流程问题
确保以下用户流程完全正常：

**流程 A（AI生成大纲）：**
1. 用户点击"AI 生成大纲" → 生成大纲（已正常）
2. 用户点击"覆盖当前"或"另存为新大纲" → 保存大纲
3. 自动触发细纲生成（SSE 流式）→ 生成成功
4. 自动切换到"细纲"标签页 → 看到已生成的细纲内容
5. 用户在细纲页面选卷 → 点击"从细纲创建章节" → 进入写作

**流程 B（智能解析）：**
1. 用户点击"智能解析" → 解析完成，如果解析结果包含 detailed_outlines → 直接保存到数据库（无需 LLM 调用）
2. 用户点击"全部保存" → 保存大纲+角色+条目+细纲
3. 自动切换到"细纲"标签页 → 看到已保存的细纲内容
4. 如果解析结果不包含 detailed_outlines → 自动触发细纲 LLM 生成
5. 生成成功后自动切换到细纲标签页

**关键要求：**
- 不应该有独立的"生成细纲"按钮（已移除）
- 细纲应该是大纲生成/智能解析的自然产出，不需要用户额外操作
- SSE 流式生成时要有进度显示

### 第四步：验证
1. `cd frontend && npm run build` — 无 TypeScript 错误
2. `cd backend && python -m compileall -q app/` — 无 Python 语法错误
3. 检查所有 import 和类型定义是否正确

## 关键文件清单

### 后端
- `backend/app/services/detailed_outline_generation/app_service.py` — 核心生成逻辑
- `backend/app/services/detailed_outline_generation/prepare_service.py` — render values 构建
- `backend/app/services/detailed_outline_generation/models.py` — 数据模型
- `backend/app/api/routes/detailed_outlines.py` — SSE 端点
- `backend/app/resources/prompt_presets/detailed_outline_generate_v1/preset.json` — preset 配置
- `backend/app/resources/prompt_presets/detailed_outline_generate_v1/templates/` — 模板文件
- `backend/app/services/prompt_preset_defaults.py` — preset 自动创建（已修复）
- `backend/app/services/prompt_preset_render.py` — render_preset_for_task 实现
- `backend/app/services/generation_service.py` — call_llm_and_record 实现
- `backend/app/services/llm_task_preset_resolver.py` — LLM 配置解析

### 对照组（正常工作的大纲生成）
- `backend/app/services/outline_generation/prepare_service.py`
- `backend/app/services/outline_generation/app_service.py`
- `backend/app/resources/prompt_presets/outline_generate_v3/preset.json`
- `backend/app/resources/prompt_presets/outline_generate_v3/templates/`

### 前端
- `frontend/src/pages/outline/useOutlinePageState.ts` — 主状态管理
- `frontend/src/pages/outline/useDetailedOutlineState.ts` — 细纲状态
- `frontend/src/pages/outline/useOutlineParsingState.ts` — 解析状态
- `frontend/src/pages/OutlinePage.tsx` — 页面组件
- `frontend/src/pages/outline/OutlinePageSections.tsx` — UI 组件
- `frontend/src/pages/outline/DetailedOutlineSection.tsx` — 细纲 UI

## 约束
- 所有代码修改必须通过 Codex 执行
- 不要引入新功能，只修复现有问题
- 保持和大纲生成完全一致的调用模式
- 修改后必须验证 build
- 修改后 commit 并 push 到 test/issue-001-foundation 分支
