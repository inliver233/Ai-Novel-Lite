# Model Config Page Full UI Redesign

## Status: IN PROGRESS
## Date: 2026-03-28
## Supersedes: Previous plan (2026-03-26) - card modularization already done

---

## 1. Problem Statement

The current model config page (`PromptsPage.tsx`) uses 6+ separate card components:
- ConnectionCard (profile management + API key)
- ModelSelectorCard (provider + model + base_url)
- ParameterTunerCard (temperature, top_p, max_tokens, penalties, timeout)
- ThinkingConfigCard (reasoning per provider)
- AdvancedConfigCard (extra JSON, stop tokens)
- TaskOverrideSection (per-task overrides)
- PromptsVectorRagSection (embedding + rerank, separate large section)

**Problems**: Too many cards, scattered controls, complex profile management, hard to quickly configure.

**Goal**: Redesign to match the simplicity of the Prompt Workshop page. 2 main blocks + task overrides.

## 2. Target Design

### Block 1: Main Model Configuration (single panel)

```
+------------------------------------------------------------+
| 主模型配置                                                   |
|                                                              |
| +----------------------------------+  [保存] [新建] [测试]   |
| | v 配置快速切换: 主网关·openai...  |                        |
| +----------------------------------+                         |
|                                                              |
| 服务商     | v openai_compatible（中转/本地）                 |
| -----------------------------------------------------------  |
| 接口地址   | https://api.openai.com/v1                        |
| -----------------------------------------------------------  |
| API Key    | ************************                         |
| -----------------------------------------------------------  |
| 模型名称   | gpt-4o-mini                     [拉取模型]      |
| -----------------------------------------------------------  |
|                                                              |
| > 参数调节 (默认折叠)                                        |
| +----------------------------------------------------------+ |
| | 温度  ───●─── 0.7    |  最大上下文  [128000]             | |
| | 超时时间  [600] s     |  推理强度  v [默认]               | |
| +----------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Block 2: RAG Configuration (single panel)

```
+------------------------------------------------------------+
| [Embedding] [Rerank]  (tab切换)          [保存]  [测试]      |
|                                                              |
| 接口地址   | https://api.openai.com/v1                        |
| -----------------------------------------------------------  |
| API Key    | ************************                         |
| -----------------------------------------------------------  |
| 模型名称   | text-embedding-3-small                            |
| -----------------------------------------------------------  |
|                                                              |
| > 参数设置 (默认折叠, embed/rerank内容不同)                  |
+------------------------------------------------------------+
```

### Block 3: Task-Specific Overrides (below RAG)

```
+------------------------------------------------------------+
| 功能专用模型配置                                             |
| 默认所有功能使用主模型配置                                    |
|                                                              |
| [+ 新建配置]  v 章节生成 / 大纲生成 / 章节分析 / 章节重写   |
|                                                              |
| (已创建的功能配置紧凑卡片列表)                               |
+------------------------------------------------------------+
```

## 3. Detailed UI Specification

### 3.1 Main Model Config Block

**Container**: `<section className="panel p-6">`

**Header Row** (flex, justify-between):
- Left: Title "主模型配置" (text-xl font-semibold) + subtitle
- Right: 3 buttons aligned with config selector

**Config Selector Row** (flex, items-center, gap-3):
- Left: `<select className="select flex-1">` - Profile quick switch
  - Options: "(未选择配置)" + all profiles with format "name · provider/model"
- Right: 3 buttons in a row:
  - "保存配置" (btn btn-primary) - saves current form to profile + preset
  - "新建配置" (btn btn-secondary) - creates new profile from current form
  - "测试连接" (btn btn-secondary) - tests current config

**Form Fields** (grid gap-3, each field is a label + input row):
1. **服务商** - `<select>` with PROVIDER_OPTIONS
2. **接口地址** - `<input className="input">` for base_url
3. **API Key** - `<input type="password" className="input">` for api_key
4. **模型名称** - Row with `<input>` + "拉取模型" button
   - Input has datalist for model suggestions
   - "拉取模型" button enabled when base_url AND api_key have values
   - Fetches using current form values (NOT saved profile)

**Collapsible Parameters** (HTML `<details>` element, default closed):
- Summary: "参数调节"
- Content: 2x2 grid
  - Temperature: SliderInput (min=0, max=2, step=0.05, default="0.7")
  - 最大上下文: Input (default="128000")
  - 超时时间: Input with "秒" suffix (default="600")
  - 推理强度: Smart control adapting to provider:
    - OpenAI/Compatible: `<select>` (默认/minimal/low/medium/high)
    - Anthropic: Toggle + budget slider
    - Gemini: Budget slider

**Dirty Status**: Small badge showing unsaved changes status

### 3.2 RAG Config Block

**Container**: `<section className="panel p-6">`

**Header Row** (flex, justify-between):
- Left: Tab buttons [Embedding] [Rerank] (toggle style)
  - Active tab: `bg-accent/10 text-accent border-accent`
  - Inactive: `text-subtext hover:text-ink`
- Right: [保存] (btn-primary) + [测试] (btn-secondary)

**Form Fields** (same layout for both tabs):
1. **接口地址** - `<input>` for base_url
2. **API Key** - `<input type="password">`
3. **模型名称** - `<input>`

**Collapsible Parameters** (`<details>`, different content per tab):

Embedding parameters:
- Provider select (openai_compatible, azure_openai, google, etc.)
- Azure-specific fields (deployment, api_version) - shown conditionally
- SentenceTransformers model - shown conditionally

Rerank parameters:
- Enabled toggle (checkbox)
- Method select (auto, rapidfuzz_token_set_ratio, token_overlap)
- Top-K input
- Timeout input
- Hybrid Alpha input

### 3.3 Task Override Block

**Container**: `<section className="panel p-6">`

**Header Row**:
- Title: "功能专用模型配置"
- Subtitle: "默认所有功能使用主模型配置。新建后该功能将使用独立配置。"

**Add Row**: Select (4 task types) + "新建配置" button

**Task Cards** (compact, for each created override):
- Each card: border rounded-atelier p-3
- Header: task label + [保存] [删除] buttons
- Fields: Provider / URL / Key / Model (compact grid)
- Collapsible: temperature, max_tokens, timeout, reasoning_effort

### 3.4 Default Value Changes

| Parameter | Old Default | New Default |
|-----------|-------------|-------------|
| max_tokens | 12000 | 128000 |
| timeout_seconds | 180 | 600 |
| temperature | 0.7 | 0.7 (unchanged) |
| provider | openai | openai (unchanged) |
| model | gpt-4o-mini | gpt-4o-mini (unchanged) |

## 4. Backend Changes

### 4.1 Inline Model Fetch (NEW endpoint)

Current: `GET /api/llm_models?provider=...&base_url=...` (uses profile API key)
New: `POST /api/llm_models/fetch` with body: `{ provider, base_url, api_key, model_prefix? }`

This allows fetching models using the currently-entered (unsaved) URL + Key.

## 5. File Changes Summary

### Frontend - REWRITE:
- `components/prompts/LlmPresetPanel.tsx` - Complete rewrite as unified main config block
- `pages/prompts/PromptsVectorRagSection.tsx` - Complete rewrite with tab toggle
- `components/prompts/cards/TaskOverrideSection.tsx` - Major simplification

### Frontend - REMOVE:
- `components/prompts/cards/ConnectionCard.tsx` - Merged into LlmPresetPanel
- `components/prompts/cards/ModelSelectorCard.tsx` - Merged into LlmPresetPanel
- `components/prompts/cards/ParameterTunerCard.tsx` - Inlined as collapsible
- `components/prompts/cards/ThinkingConfigCard.tsx` - Merged into reasoning control
- `components/prompts/cards/AdvancedConfigCard.tsx` - Moved to collapsible

### Frontend - MODIFY:
- `pages/prompts/models.ts` - Update DEFAULT_LLM_FORM defaults
- `pages/prompts/usePromptsPageState.ts` - Adjust props mapping, add inline fetch
- `pages/PromptsPage.tsx` - Update layout
- `components/prompts/cards/cardTypes.ts` - Update/simplify types
- `components/prompts/cards/index.ts` - Update exports

### Frontend - KEEP:
- `components/prompts/cards/SliderInput.tsx` - Reuse as-is
- `components/prompts/llmConnectionState.ts` - Keep for profile state logic
- `components/prompts/types.ts` - Keep LlmForm type

### Backend - ADD:
- `backend/app/api/routes/llm_models.py` - Add POST /fetch endpoint

## 6. Implementation Issues

See `issues.csv` for detailed breakdown.

| Issue | Title | Phase | Scope |
|-------|-------|-------|-------|
| MC-001 | Update defaults + types cleanup | 1 | models.ts, cardTypes.ts |
| MC-002 | Rewrite LlmPresetPanel (main config block) | 2 | LlmPresetPanel.tsx |
| MC-003 | Rewrite PromptsVectorRagSection (RAG block) | 2 | PromptsVectorRagSection.tsx |
| MC-004 | Simplify TaskOverrideSection | 2 | TaskOverrideSection.tsx |
| MC-005 | Backend: inline model fetch endpoint | 2 | llm_models.py |
| MC-006 | Integration: update PromptsPage + usePromptsPageState | 3 | PromptsPage.tsx, hooks |
| MC-007 | Cleanup: remove old cards + update exports | 3 | cards/ directory |
| MC-008 | Code review + build verification | 4 | all changes |

## 7. Risk Mitigation

- All API contracts preserved (only UI layer + 1 new endpoint)
- LlmForm type unchanged - backend compatibility guaranteed
- Incremental: each issue independently testable
- Build verification after each phase
