# 10 - 后端 Schema 与数据流

> 源码位置: `backend/app/schemas/`
> 本文档基于逐行阅读所有 Schema 源码编写，覆盖全部 27 个文件、全部类与全部字段。

---

## 目录

1. [Schema 基类设计](#1-schema-基类设计)
2. [限制常量与验证工具](#2-限制常量与验证工具)
3. [通用 Schema (common.py)](#3-通用-schema)
4. [LLM 提供商类型 (llm.py)](#4-llm-提供商类型)
5. [项目 Schema (projects.py)](#5-项目-schema)
6. [项目设置 Schema (settings.py)](#6-项目设置-schema)
7. [大纲 Schema (outline.py / outline_generate.py)](#7-大纲-schema)
8. [章节 Schema (chapters.py)](#8-章节-schema)
9. [章节生成 Schema (chapter_generate.py)](#9-章节生成-schema)
10. [章节计划 Schema (chapter_plan.py)](#10-章节计划-schema)
11. [章节分析 Schema (chapter_analysis.py)](#11-章节分析-schema)
12. [角色 Schema (characters.py)](#12-角色-schema)
13. [角色自动更新 Schema (characters_auto_update.py)](#13-角色自动更新-schema)
14. [世界观百科 Schema (worldbook.py)](#14-世界观百科-schema)
15. [世界观百科自动更新 Schema (worldbook_auto_update.py)](#15-世界观百科自动更新-schema)
16. [写作风格 Schema (writing_styles.py)](#16-写作风格-schema)
17. [LLM 预设 Schema (llm_preset.py)](#17-llm-预设-schema)
18. [LLM 配置档 Schema (llm_profiles.py)](#18-llm-配置档-schema)
19. [LLM 任务预设 Schema (llm_task_presets.py)](#19-llm-任务预设-schema)
20. [LLM 测试 Schema (llm_test.py)](#20-llm-测试-schema)
21. [提示词预设 Schema (prompt_presets.py)](#21-提示词预设-schema)
22. [批量生成 Schema (batch_generation.py)](#22-批量生成-schema)
23. [生成记录 Schema (generation_runs.py)](#23-生成记录-schema)
24. [记忆打包 Schema (memory_pack.py)](#24-记忆打包-schema)
25. [记忆预览 Schema (memory_preview.py)](#25-记忆预览-schema)
26. [记忆更新 Schema (memory_update.py)](#26-记忆更新-schema)
27. [数据流向总图](#27-数据流向总图)

---

## 1. Schema 基类设计

**文件**: `backend/app/schemas/base.py`

系统定义了两个 Pydantic 基类，所有业务 Schema 均直接或间接继承自它们（或标准 `BaseModel`）。

### 1.1 ORMModel

```python
class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
```

| 特性 | 说明 |
|------|------|
| 继承自 | `pydantic.BaseModel` |
| `from_attributes=True` | 允许从 SQLAlchemy ORM 对象的属性直接构建 Pydantic 模型（替代旧版 `orm_mode`） |
| 用途 | 所有**响应 Schema** 和部分**请求 Schema**的基类，当需要从数据库 Model 实例直接映射时使用 |

### 1.2 RequestModel

```python
class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
```

| 特性 | 说明 |
|------|------|
| 继承自 | `pydantic.BaseModel` |
| `extra="forbid"` | 严格模式 -- 请求体中出现未声明的字段时直接报错 |
| 用途 | 面向客户端的**写入请求 Schema**的基类，防止传入多余字段 |

### 1.3 继承策略总结

```
BaseModel (pydantic)
 |
 |-- ORMModel          (from_attributes=True)   --> 用于 ORM 响应 / 可从 DB 对象创建
 |-- RequestModel      (extra="forbid")         --> 用于严格请求体
 |-- BaseModel (直接)                           --> 用于其他灵活场景
```

---

## 2. 限制常量与验证工具

**文件**: `backend/app/schemas/limits.py`

所有与字段长度限制相关的全局常量和工具函数集中在此文件中。

### 2.1 常量定义

| 常量名 | 值 | 用途 |
|--------|----|----- |
| `MAX_MD_CHARS` | 200,000 | 大段用户编辑的 Markdown/文本（大纲、章节、世界观百科、设置等） |
| `MAX_OUTLINE_MD_CHARS` | 2,000,000 | 大纲 Markdown 的特殊上限（大纲可以非常大） |
| `MAX_OUTLINE_STRUCTURE_JSON_CHARS` | 2,000,000 | 大纲 structure JSON 的上限 |
| `MAX_BULK_CREATE_CHAPTERS` | 2,000 | 批量创建章节的最大数量 |
| `MAX_TEXT_CHARS` | 40,000 | 中等长度自由文本（计划/摘要/角色设定/笔记等） |
| `MAX_TEMPLATE_CHARS` | 100,000 | 提示词模板的上限 |
| `MAX_JSON_CHARS_SMALL` | 20,000 | 小型开放结构 JSON blob 上限 |
| `MAX_JSON_CHARS_MEDIUM` | 100,000 | 中型开放结构 JSON blob 上限 |

### 2.2 工具函数

#### `compact_json_dumps(value: Any) -> str`
将任意值序列化为紧凑 JSON 字符串（`ensure_ascii=False`, 去除多余空格）。用于计算 JSON blob 的实际字符长度。

#### `validate_json_chars(value, *, max_chars, field_name) -> T | None`
通用 JSON 大小验证器。将值序列化为紧凑 JSON 后检查长度是否超限，超限则抛出 `ValueError`。在多个 Schema 的 `field_validator` 中被调用。

---

## 3. 通用 Schema

**文件**: `backend/app/schemas/common.py`

定义 API 统一响应信封和错误结构。

### 3.1 ErrorInfo

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `code` | `str` | 是 | - | 错误码（如 `"NOT_FOUND"`, `"VALIDATION_ERROR"` 等） |
| `message` | `str` | 是 | - | 人可读的错误消息 |
| `details` | `dict[str, Any]` | 否 | `{}` | 附加错误细节字典 |

### 3.2 OkResponse

成功响应信封。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `ok` | `Literal[True]` | 是 | `True` | 固定值，标记请求成功 |
| `data` | `Any` | 是 | - | 实际响应数据载体 |
| `request_id` | `str` | 是 | - | 请求追踪 ID |

### 3.3 ErrorResponse

失败响应信封。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `ok` | `Literal[False]` | 是 | `False` | 固定值，标记请求失败 |
| `error` | `ErrorInfo` | 是 | - | 错误详情对象 |
| `request_id` | `str` | 是 | - | 请求追踪 ID |

### 3.4 统一响应格式

所有 API 端点返回 `OkResponse` 或 `ErrorResponse`，保证前端可通过 `ok` 字段判断是否成功：

```
成功: { "ok": true,  "data": { ... }, "request_id": "..." }
失败: { "ok": false, "error": { "code": "...", "message": "...", "details": {} }, "request_id": "..." }
```

---

## 4. LLM 提供商类型

**文件**: `backend/app/schemas/llm.py`

定义系统支持的 LLM 提供商枚举类型（`Literal` 联合类型）。

### 4.1 LLMProvider

```python
LLMProvider = Literal[
    "openai",
    "openai_responses",
    "openai_compatible",
    "openai_responses_compatible",
    "anthropic",
    "gemini",
]
```

| 值 | 说明 |
|----|------|
| `"openai"` | OpenAI 官方 API（Chat Completions 格式） |
| `"openai_responses"` | OpenAI Responses API 格式 |
| `"openai_compatible"` | 兼容 OpenAI 接口的第三方服务（如 vLLM / DeepSeek 等） |
| `"openai_responses_compatible"` | 兼容 OpenAI Responses 接口的第三方服务 |
| `"anthropic"` | Anthropic Claude API |
| `"gemini"` | Google Gemini API |

此类型在 `llm_preset.py`, `llm_task_presets.py`, `llm_test.py` 等模块中被引用。

---

## 5. 项目 Schema

**文件**: `backend/app/schemas/projects.py`

### 5.1 ProjectCreate (请求 - 创建项目)

| 继承自 | `RequestModel`（`extra="forbid"`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `name` | `str` | 是 | - | `min_length=1, max_length=255` | 项目名称 |
| `genre` | `str \| None` | 否 | `None` | `max_length=255` | 小说类型/流派 |
| `logline` | `str \| None` | 否 | `None` | `max_length=1024` | 一句话梗概 |

### 5.2 ProjectUpdate (请求 - 更新项目)

| 继承自 | `RequestModel`（`extra="forbid"`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `name` | `str \| None` | 否 | `None` | `min_length=1, max_length=255` | 项目名称 |
| `genre` | `str \| None` | 否 | `None` | `max_length=255` | 小说类型 |
| `logline` | `str \| None` | 否 | `None` | `max_length=1024` | 一句话梗概 |
| `active_outline_id` | `str \| None` | 否 | `None` | `max_length=36` | 当前激活的大纲 ID |
| `llm_profile_id` | `str \| None` | 否 | `None` | `max_length=36` | 绑定的 LLM 配置档 ID |

### 5.3 ProjectOut (响应 - 项目详情)

| 继承自 | `ORMModel`（`from_attributes=True`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 项目 ID (UUID) |
| `owner_user_id` | `str` | 是 | - | 所有者用户 ID |
| `active_outline_id` | `str \| None` | 否 | `None` | 当前激活大纲 |
| `llm_profile_id` | `str \| None` | 否 | `None` | 绑定的 LLM 配置档 |
| `name` | `str` | 是 | - | 项目名称 |
| `genre` | `str \| None` | 否 | `None` | 小说类型 |
| `logline` | `str \| None` | 否 | `None` | 一句话梗概 |
| `created_at` | `datetime` | 是 | - | 创建时间 |
| `updated_at` | `datetime` | 是 | - | 更新时间 |

**对应数据库 Model**: `Project` 表，字段一一对应。

---

## 6. 项目设置 Schema

**文件**: `backend/app/schemas/settings.py`

### 6.1 QueryPreprocessingConfig (嵌套配置)

查询预处理配置，控制记忆检索前的查询增强。

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `enabled` | `bool` | 否 | `False` | - | 是否启用查询预处理 |
| `tags` | `list[str]` | 否 | `[]` | `max_length=50`; 每项 `strip()` 后非空, `max 64 chars` | 标签过滤列表 |
| `exclusion_rules` | `list[str]` | 否 | `[]` | `max_length=50`; 每项 `strip()` 后非空, `max 256 chars` | 排除规则列表 |
| `index_ref_enhance` | `bool` | 否 | `False` | - | 是否启用索引引用增强 |

自定义验证器: `_validate_tags` -- 逐项验证 tags 类型/空值/长度。`_validate_exclusion_rules` -- 逐项验证排除规则类型/空值/长度。

### 6.2 ProjectSettingsOut (响应 - 项目设置详情)

| 继承自 | `BaseModel` |
|--------|------|

此 Schema 字段极其丰富，分组说明如下：

#### 6.2.1 基础写作设置

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `project_id` | `str` | 是 | - | 所属项目 ID |
| `world_setting` | `str` | 是 | - | 世界观设定文本 |
| `style_guide` | `str` | 是 | - | 风格指南文本 |
| `constraints` | `str` | 是 | - | 写作约束文本 |
| `context_optimizer_enabled` | `bool` | 否 | `False` | 上下文优化器开关 |

#### 6.2.2 自动更新开关

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `auto_update_worldbook_enabled` | `bool` | 否 | `True` | 自动更新世界观百科 |
| `auto_update_characters_enabled` | `bool` | 否 | `True` | 自动更新角色 |
| `auto_update_story_memory_enabled` | `bool` | 否 | `True` | 自动更新故事记忆 |
| `auto_update_graph_enabled` | `bool` | 否 | `True` | 自动更新知识图谱 |
| `auto_update_vector_enabled` | `bool` | 否 | `True` | 自动更新向量索引 |
| `auto_update_search_enabled` | `bool` | 否 | `True` | 自动更新搜索索引 |
| `auto_update_fractal_enabled` | `bool` | 否 | `True` | 自动更新分形记忆 |
| `auto_update_tables_enabled` | `bool` | 否 | `True` | 自动更新结构化表 |

#### 6.2.3 查询预处理

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query_preprocessing` | `QueryPreprocessingConfig \| None` | 是 | 用户自定义配置（可为 null） |
| `query_preprocessing_default` | `QueryPreprocessingConfig` | 是 | 系统默认配置 |
| `query_preprocessing_effective` | `QueryPreprocessingConfig` | 是 | 实际生效的配置（合并后） |
| `query_preprocessing_effective_source` | `str` | 是 | 生效来源标识 |

#### 6.2.4 向量重排序 (Rerank) 配置

分为用户设置层和生效层两组：

**用户设置层**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `vector_rerank_enabled` | `bool \| None` | 是否启用重排序 |
| `vector_rerank_method` | `str \| None` | 重排序方法 |
| `vector_rerank_top_k` | `int \| None` | 重排序取 top-k |
| `vector_rerank_provider` | `str` | 重排序提供商 |
| `vector_rerank_base_url` | `str` | 重排序 API 地址 |
| `vector_rerank_model` | `str` | 重排序模型名 |
| `vector_rerank_timeout_seconds` | `int \| None` | 超时秒数 |
| `vector_rerank_hybrid_alpha` | `float \| None` | 混合搜索 alpha 参数 |
| `vector_rerank_has_api_key` | `bool` | 是否已配置 API Key |
| `vector_rerank_masked_api_key` | `str` | 脱敏后的 API Key |

**生效层** (`effective` 前缀):

| 字段 | 类型 | 说明 |
|------|------|------|
| `vector_rerank_effective_enabled` | `bool` | 实际是否启用 |
| `vector_rerank_effective_method` | `str` | 实际使用的方法 |
| `vector_rerank_effective_top_k` | `int` | 实际 top-k |
| `vector_rerank_effective_source` | `str` | 配置来源 |
| `vector_rerank_effective_provider` | `str` | 实际提供商 |
| `vector_rerank_effective_base_url` | `str` | 实际 API 地址 |
| `vector_rerank_effective_model` | `str` | 实际模型名 |
| `vector_rerank_effective_timeout_seconds` | `int` | 实际超时 |
| `vector_rerank_effective_hybrid_alpha` | `float` | 实际 alpha |
| `vector_rerank_effective_has_api_key` | `bool` | 是否有可用 Key |
| `vector_rerank_effective_masked_api_key` | `str` | 脱敏 Key |
| `vector_rerank_effective_config_source` | `str` | 总配置来源 |

#### 6.2.5 向量嵌入 (Embedding) 配置

同样分为用户设置层和生效层：

**用户设置层**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `vector_embedding_provider` | `str` | 嵌入提供商 |
| `vector_embedding_base_url` | `str` | API 地址 |
| `vector_embedding_model` | `str` | 嵌入模型名 |
| `vector_embedding_azure_deployment` | `str` | Azure 部署名 |
| `vector_embedding_azure_api_version` | `str` | Azure API 版本 |
| `vector_embedding_sentence_transformers_model` | `str` | SentenceTransformers 本地模型 |
| `vector_embedding_has_api_key` | `bool` | 是否已配置 API Key |
| `vector_embedding_masked_api_key` | `str` | 脱敏后的 API Key |

**生效层** (`effective` 前缀):

| 字段 | 类型 | 说明 |
|------|------|------|
| `vector_embedding_effective_provider` | `str` | 实际提供商 |
| `vector_embedding_effective_base_url` | `str` | 实际 API 地址 |
| `vector_embedding_effective_model` | `str` | 实际模型名 |
| `vector_embedding_effective_azure_deployment` | `str` | 实际 Azure 部署 |
| `vector_embedding_effective_azure_api_version` | `str` | 实际 Azure 版本 |
| `vector_embedding_effective_sentence_transformers_model` | `str` | 实际本地模型 |
| `vector_embedding_effective_has_api_key` | `bool` | 是否有可用 Key |
| `vector_embedding_effective_masked_api_key` | `str` | 脱敏 Key |
| `vector_embedding_effective_disabled_reason` | `str \| None` | 不可用原因（默认 `None`） |
| `vector_embedding_effective_source` | `str` | 配置来源 |

### 6.3 ProjectSettingsUpdate (请求 - 更新项目设置)

| 继承自 | `BaseModel` |
|--------|------|

所有字段均为可选（`None` 默认值表示不更新该字段）。

#### 6.3.1 基础写作设置

| 字段 | 类型 | 默认值 | 验证规则 | 说明 |
|------|------|--------|----------|------|
| `world_setting` | `str \| None` | `None` | `max_length=MAX_TEXT_CHARS (40000)` | 世界观设定 |
| `style_guide` | `str \| None` | `None` | `max_length=MAX_TEXT_CHARS` | 风格指南 |
| `constraints` | `str \| None` | `None` | `max_length=MAX_TEXT_CHARS` | 写作约束 |
| `context_optimizer_enabled` | `bool \| None` | `None` | - | 上下文优化器 |

#### 6.3.2 自动更新开关

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `auto_update_worldbook_enabled` | `bool \| None` | `None` | 世界观百科自动更新 |
| `auto_update_characters_enabled` | `bool \| None` | `None` | 角色自动更新 |
| `auto_update_story_memory_enabled` | `bool \| None` | `None` | 故事记忆自动更新 |
| `auto_update_graph_enabled` | `bool \| None` | `None` | 知识图谱自动更新 |
| `auto_update_vector_enabled` | `bool \| None` | `None` | 向量索引自动更新 |
| `auto_update_search_enabled` | `bool \| None` | `None` | 搜索索引自动更新 |
| `auto_update_fractal_enabled` | `bool \| None` | `None` | 分形记忆自动更新 |
| `auto_update_tables_enabled` | `bool \| None` | `None` | 结构化表自动更新 |

#### 6.3.3 查询预处理

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query_preprocessing` | `QueryPreprocessingConfig \| None` | `None` | 查询预处理配置 |

#### 6.3.4 向量重排序设置

| 字段 | 类型 | 默认值 | 验证规则 | 说明 |
|------|------|--------|----------|------|
| `vector_rerank_enabled` | `bool \| None` | `None` | - | 启用重排序 |
| `vector_rerank_method` | `str \| None` | `None` | `max_length=64` | 重排序方法 |
| `vector_rerank_top_k` | `int \| None` | `None` | `ge=1, le=1000` | top-k |
| `vector_rerank_provider` | `str \| None` | `None` | `max_length=64` | 提供商 |
| `vector_rerank_base_url` | `str \| None` | `None` | `max_length=2048` | API 地址 |
| `vector_rerank_model` | `str \| None` | `None` | `max_length=255` | 模型名 |
| `vector_rerank_timeout_seconds` | `int \| None` | `None` | `ge=1, le=120` | 超时 |
| `vector_rerank_hybrid_alpha` | `float \| None` | `None` | `ge=0.0, le=1.0` | 混合 alpha |
| `vector_rerank_api_key` | `str \| None` | `None` | `max_length=2048` | API 密钥（明文写入） |

#### 6.3.5 向量嵌入设置

| 字段 | 类型 | 默认值 | 验证规则 | 说明 |
|------|------|--------|----------|------|
| `vector_embedding_provider` | `str \| None` | `None` | `max_length=64` | 提供商 |
| `vector_embedding_base_url` | `str \| None` | `None` | `max_length=2048` | API 地址 |
| `vector_embedding_model` | `str \| None` | `None` | `max_length=255` | 模型名 |
| `vector_embedding_azure_deployment` | `str \| None` | `None` | `max_length=255` | Azure 部署名 |
| `vector_embedding_azure_api_version` | `str \| None` | `None` | `max_length=64` | Azure 版本 |
| `vector_embedding_sentence_transformers_model` | `str \| None` | `None` | `max_length=255` | 本地模型 |
| `vector_embedding_api_key` | `str \| None` | `None` | `max_length=2048` | API 密钥 |

**对应数据库 Model**: `ProjectSettings` 表。响应中的 `effective_*` 字段由服务层根据项目设置 + 系统默认值合并计算，不直接存储在数据库中。

---

## 7. 大纲 Schema

**文件**: `backend/app/schemas/outline.py`, `backend/app/schemas/outline_generate.py`

### 7.1 OutlineCreate (请求 - 创建大纲)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `title` | `str` | 是 | - | `min_length=1, max_length=255` | 大纲标题 |
| `content_md` | `str \| None` | 否 | `None` | `max_length=MAX_OUTLINE_MD_CHARS (2000000)` | Markdown 正文 |
| `structure` | `Any \| None` | 否 | `None` | `validate_json_chars(max_chars=2000000)` | 结构化 JSON（如章节层级树） |

### 7.2 OutlineUpdate (请求 - 更新大纲)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `title` | `str \| None` | 否 | `None` | `min_length=1, max_length=255` | 大纲标题 |
| `content_md` | `str \| None` | 否 | `None` | `max_length=MAX_OUTLINE_MD_CHARS` | Markdown 正文 |
| `structure` | `Any \| None` | 否 | `None` | `validate_json_chars(max_chars=2000000)` | 结构化 JSON |

### 7.3 OutlineOut (响应 - 大纲详情)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 大纲 ID (UUID) |
| `project_id` | `str` | 是 | - | 所属项目 ID |
| `title` | `str` | 是 | - | 标题 |
| `content_md` | `str` | 是 | - | Markdown 正文 |
| `structure` | `Any \| None` | 否 | `None` | 结构化 JSON |
| `created_at` | `datetime` | 是 | - | 创建时间 |
| `updated_at` | `datetime` | 是 | - | 更新时间 |

### 7.4 OutlineListItem (响应 - 大纲列表项)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 大纲 ID |
| `title` | `str` | 是 | - | 标题 |
| `updated_at` | `datetime` | 是 | - | 更新时间 |
| `created_at` | `datetime` | 是 | - | 创建时间 |
| `has_chapters` | `bool` | 否 | `False` | 是否已有章节 |

### 7.5 OutlineGenerateContext (嵌套配置)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `include_world_setting` | `bool` | 否 | `True` | 生成时是否包含世界观设定 |
| `include_characters` | `bool` | 否 | `True` | 生成时是否包含角色设定 |

### 7.6 OutlineGenerateRequest (请求 - AI 生成大纲)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `requirements` | `dict[str, Any]` | 否 | `{}` | `max_length=200`; `validate_json_chars(max_chars=20000)` | 生成需求参数 |
| `style_id` | `str \| None` | 否 | `None` | `max_length=36` | 指定写作风格 ID |
| `context` | `OutlineGenerateContext` | 否 | `OutlineGenerateContext()` | - | 上下文配置 |

**对应数据库 Model**: `Outline` 表。

---

## 8. 章节 Schema

**文件**: `backend/app/schemas/chapters.py`

### 8.1 类型别名

```python
ChapterStatus = Literal["planned", "drafting", "done"]
```

章节状态枚举：`planned`（已规划）、`drafting`（草稿中）、`done`（已完成）。

### 8.2 ChapterCreate (请求 - 创建章节)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `number` | `int` | 是 | - | `ge=1` | 章节序号（从 1 开始） |
| `title` | `str \| None` | 否 | `None` | `max_length=255` | 章节标题 |
| `plan` | `str \| None` | 否 | `None` | `max_length=MAX_TEXT_CHARS (40000)` | 章节计划 |
| `status` | `ChapterStatus` | 否 | `"planned"` | - | 初始状态 |

### 8.3 ChapterUpdate (请求 - 更新章节)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `title` | `str \| None` | 否 | `None` | `max_length=255` | 章节标题 |
| `plan` | `str \| None` | 否 | `None` | `max_length=MAX_TEXT_CHARS` | 章节计划 |
| `content_md` | `str \| None` | 否 | `None` | `max_length=MAX_MD_CHARS (200000)` | Markdown 正文 |
| `summary` | `str \| None` | 否 | `None` | `max_length=MAX_TEXT_CHARS` | 章节摘要 |
| `status` | `ChapterStatus \| None` | 否 | `None` | - | 章节状态 |

### 8.4 BulkChapter (批量创建的单个章节)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `number` | `int` | 是 | - | `ge=1` | 章节序号 |
| `title` | `str \| None` | 否 | `None` | `max_length=255` | 章节标题 |
| `plan` | `str \| None` | 否 | `None` | `max_length=MAX_TEXT_CHARS` | 章节计划 |

### 8.5 BulkCreateRequest (请求 - 批量创建章节)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `chapters` | `list[BulkChapter]` | 是 | - | `min_length=1, max_length=MAX_BULK_CREATE_CHAPTERS (2000)` | 章节列表 |

### 8.6 ChapterOut (响应 - 章节详情)

| 继承自 | `ORMModel`（`from_attributes=True`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 章节 ID (UUID) |
| `project_id` | `str` | 是 | - | 所属项目 ID |
| `outline_id` | `str` | 是 | - | 所属大纲 ID |
| `number` | `int` | 是 | - | 章节序号 |
| `title` | `str \| None` | 否 | `None` | 标题 |
| `plan` | `str \| None` | 否 | `None` | 计划 |
| `content_md` | `str \| None` | 否 | `None` | Markdown 正文 |
| `summary` | `str \| None` | 否 | `None` | 摘要 |
| `status` | `ChapterStatus` | 是 | - | 状态 |
| `updated_at` | `datetime` | 是 | - | 更新时间 |

### 8.7 ChapterDetailOut (响应 - 章节完整详情)

| 继承自 | `ChapterOut` |
|--------|------|

与 `ChapterOut` 完全相同（`pass`），语义上用于强调"完整详情"场景。

### 8.8 ChapterListItemOut (响应 - 章节列表项)

| 继承自 | `ORMModel`（`from_attributes=True`） |
|--------|------|

列表视图的精简版本，不包含正文和计划内容，但增加了 `has_*` 布尔标志：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 章节 ID |
| `project_id` | `str` | 是 | - | 所属项目 ID |
| `outline_id` | `str` | 是 | - | 所属大纲 ID |
| `number` | `int` | 是 | - | 章节序号 |
| `title` | `str \| None` | 否 | `None` | 标题 |
| `status` | `ChapterStatus` | 是 | - | 状态 |
| `updated_at` | `datetime` | 是 | - | 更新时间 |
| `has_plan` | `bool` | 是 | - | 是否已有计划 |
| `has_summary` | `bool` | 是 | - | 是否已有摘要 |
| `has_content` | `bool` | 是 | - | 是否已有正文 |

### 8.9 ChapterMetaPageOut (响应 - 章节分页列表)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chapters` | `list[ChapterListItemOut]` | 是 | - | 章节列表项数组 |
| `next_cursor` | `int \| None` | 否 | `None` | 下一页游标（基于 chapter number） |
| `has_more` | `bool` | 否 | `False` | 是否还有更多 |
| `returned` | `int` | 否 | `0` | 本次返回数量 |
| `total` | `int` | 否 | `0` | 总章节数 |

**对应数据库 Model**: `Chapter` 表。

---

## 9. 章节生成 Schema

**文件**: `backend/app/schemas/chapter_generate.py`

### 9.1 PromptOverrideMessage (嵌套 - 提示词覆盖消息)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `role` | `str` | 否 | `"user"` | `max_length=32` | 消息角色 |
| `content` | `str` | 否 | `""` | `max_length=20000` | 消息内容 |
| `name` | `str \| None` | 否 | `None` | `max_length=64` | 可选的消息名称标识 |

### 9.2 PromptOverride (嵌套 - 提示词覆盖)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `system` | `str \| None` | 否 | `None` | `max_length=20000` | 覆盖 system 提示词 |
| `user` | `str \| None` | 否 | `None` | `max_length=20000` | 覆盖 user 提示词 |
| `messages` | `list[PromptOverrideMessage]` | 否 | `[]` | `max_length=100` | 额外消息列表 |

### 9.3 McpToolCall (嵌套 - MCP 工具调用)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `tool_name` | `str` | 否 | `""` | `max_length=128`; 自定义验证: strip 后非空且长度 <= 128 | 工具名称 |
| `args` | `dict[str, object]` | 否 | `{}` | - | 工具调用参数 |

### 9.4 McpResearchConfig (嵌套 - MCP 研究配置)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `enabled` | `bool` | 否 | `False` | - | 是否启用 MCP 研究 |
| `allowlist` | `list[str]` | 否 | `[]` | `max_length=50`; 每项 strip 后非空, max 128 chars | 允许的工具白名单 |
| `calls` | `list[McpToolCall]` | 否 | `[]` | `max_length=50` | 预定义的工具调用列表 |
| `timeout_seconds` | `float \| None` | 否 | `None` | `ge=0.1, le=60.0` | MCP 调用超时 |
| `max_output_chars` | `int \| None` | 否 | `None` | `ge=0, le=20000` | 最大输出字符数 |

### 9.5 ChapterGenerateContext (嵌套 - 生成上下文配置)

| 继承自 | `BaseModel` |
|--------|------|

**此类被 `chapter_plan.py`、`chapter_analysis.py`、`batch_generation.py` 等模块复用。**

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `include_world_setting` | `bool` | 否 | `True` | - | 是否包含世界观设定 |
| `include_style_guide` | `bool` | 否 | `True` | - | 是否包含风格指南 |
| `include_constraints` | `bool` | 否 | `True` | - | 是否包含写作约束 |
| `include_outline` | `bool` | 否 | `True` | - | 是否包含大纲 |
| `include_smart_context` | `bool` | 否 | `True` | - | 是否启用智能上下文 |
| `require_sequential` | `bool` | 否 | `False` | - | 是否要求顺序生成 |
| `character_ids` | `list[str]` | 否 | `[]` | `max_length=200`; 每项 strip 后非空, max 36 chars | 参与角色 ID 列表 |
| `previous_chapter` | `Literal["none","summary","content","tail"] \| None` | 否 | `None` | - | 前一章引用方式 |
| `current_draft_tail` | `str \| None` | 否 | `None` | `max_length=5000` | 当前草稿尾部内容（用于续写） |

### 9.6 ChapterGenerateRequest (请求 - AI 生成章节)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `mode` | `Literal["replace","append"]` | 是 | - | - | 生成模式（替换/追加） |
| `instruction` | `str` | 否 | `""` | `max_length=4000` | 用户指令 |
| `target_word_count` | `int \| None` | 否 | `None` | `ge=100, le=50000` | 目标字数 |
| `plan_first` | `bool` | 否 | `False` | - | 是否先生成计划 |
| `post_edit` | `bool` | 否 | `False` | - | 是否后编辑 |
| `post_edit_sanitize` | `bool` | 否 | `False` | - | 后编辑是否做净化 |
| `content_optimize` | `bool` | 否 | `False` | - | 是否优化内容 |
| `macro_seed` | `str \| None` | 否 | `None` | `max_length=256` | 宏种子（用于可重复生成） |
| `prompt_override` | `PromptOverride \| None` | 否 | `None` | - | 提示词覆盖 |
| `style_id` | `str \| None` | 否 | `None` | `max_length=36` | 指定写作风格 ID |
| `memory_injection_enabled` | `bool` | 否 | `False` | - | 是否启用记忆注入 |
| `memory_query_text` | `str \| None` | 否 | `None` | `max_length=5000` | 记忆查询文本 |
| `memory_modules` | `dict[str, bool]` | 否 | `{}` | - | 记忆模块开关 |
| `context` | `ChapterGenerateContext` | 否 | `ChapterGenerateContext()` | - | 上下文配置 |
| `mcp_research` | `McpResearchConfig` | 否 | `McpResearchConfig()` | - | MCP 研究配置 |

---

## 10. 章节计划 Schema

**文件**: `backend/app/schemas/chapter_plan.py`

### 10.1 ChapterPlanRequest (请求 - AI 生成章节计划)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `instruction` | `str` | 否 | `""` | `max_length=4000` | 用户指令 |
| `context` | `ChapterGenerateContext` | 否 | `ChapterGenerateContext()` | - | 上下文配置（复用 chapter_generate 中的类） |

---

## 11. 章节分析 Schema

**文件**: `backend/app/schemas/chapter_analysis.py`

### 11.1 ChapterAnalyzeRequest (请求 - AI 分析章节)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `instruction` | `str` | 否 | `""` | `max_length=2000` | 分析指令 |
| `context` | `ChapterGenerateContext` | 否 | `ChapterGenerateContext()` | - | 上下文配置 |
| `draft_title` | `str \| None` | 否 | `None` | `max_length=255` | 未保存草稿标题 |
| `draft_plan` | `str \| None` | 否 | `None` | `max_length=MAX_TEXT_CHARS (40000)` | 未保存草稿计划 |
| `draft_summary` | `str \| None` | 否 | `None` | `max_length=MAX_TEXT_CHARS` | 未保存草稿摘要 |
| `draft_content_md` | `str \| None` | 否 | `None` | `max_length=MAX_MD_CHARS (200000)` | 未保存草稿正文 |
| `auto_propose_memory_update` | `bool` | 否 | `False` | - | 分析后是否自动提议记忆更新 |
| `memory_update_focus` | `str \| None` | 否 | `None` | `max_length=4000` | 记忆更新焦点 |
| `memory_update_idempotency_key` | `str \| None` | 否 | `None` | `max_length=64` | 幂等性键 |

### 11.2 ChapterRewriteRequest (请求 - AI 重写章节)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `instruction` | `str` | 否 | `""` | `max_length=2000` | 重写指令 |
| `context` | `ChapterGenerateContext` | 否 | `ChapterGenerateContext()` | - | 上下文配置 |
| `analysis` | `dict[str, Any]` | 否 | `{}` | `max_length=200`; `validate_json_chars(max=100000)` | 分析结果（由分析步骤产出） |
| `draft_content_md` | `str \| None` | 否 | `None` | `max_length=MAX_MD_CHARS` | 草稿正文 |

### 11.3 ChapterAnalysisApplyRequest (请求 - 应用分析结果)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `analysis` | `dict[str, Any]` | 否 | `{}` | `max_length=200`; `validate_json_chars(max=100000)` | 分析结果字典 |
| `draft_content_md` | `str \| None` | 否 | `None` | `max_length=MAX_MD_CHARS` | 草稿正文 |

---

## 12. 角色 Schema

**文件**: `backend/app/schemas/characters.py`

### 12.1 CharacterCreate (请求 - 创建角色)

| 继承自 | `ORMModel`（`from_attributes=True`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `name` | `str` | 是 | - | `min_length=1, max_length=255` | 角色名称 |
| `role` | `str \| None` | 否 | `None` | `max_length=255` | 角色定位（如"主角"、"反派"） |
| `profile` | `str \| None` | 否 | `None` | `max_length=MAX_TEXT_CHARS (40000)` | 角色简介 |
| `notes` | `str \| None` | 否 | `None` | `max_length=MAX_TEXT_CHARS` | 备注 |

### 12.2 CharacterUpdate (请求 - 更新角色)

| 继承自 | `ORMModel`（`from_attributes=True`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `name` | `str \| None` | 否 | `None` | `min_length=1, max_length=255` | 角色名称 |
| `role` | `str \| None` | 否 | `None` | `max_length=255` | 角色定位 |
| `profile` | `str \| None` | 否 | `None` | `max_length=MAX_TEXT_CHARS` | 角色简介 |
| `notes` | `str \| None` | 否 | `None` | `max_length=MAX_TEXT_CHARS` | 备注 |

### 12.3 CharacterOut (响应 - 角色详情)

| 继承自 | `ORMModel`（`from_attributes=True`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 角色 ID (UUID) |
| `project_id` | `str` | 是 | - | 所属项目 ID |
| `name` | `str` | 是 | - | 角色名称 |
| `role` | `str \| None` | 否 | `None` | 角色定位 |
| `profile` | `str \| None` | 否 | `None` | 角色简介 |
| `notes` | `str \| None` | 否 | `None` | 备注 |
| `updated_at` | `datetime` | 是 | - | 更新时间 |

**对应数据库 Model**: `Character` 表。

---

## 13. 角色自动更新 Schema

**文件**: `backend/app/schemas/characters_auto_update.py`

此模块用于 AI 分析章节后自动批量更新角色信息。

### 13.1 类型别名与常量

```python
CharactersAutoUpdateSchemaVersion = Literal["characters_auto_update_v1"]
CharactersAutoUpdateOpType = Literal["upsert", "dedupe"]
CharacterMergeMode = Literal["append_missing", "append", "replace"]

MAX_OPS_V1 = 80
MAX_MD_CHARS_V1 = 20000
```

| 类型/常量 | 说明 |
|-----------|------|
| `CharactersAutoUpdateOpType` | 操作类型: `upsert`（创建或更新）/ `dedupe`（去重合并） |
| `CharacterMergeMode` | 合并模式: `append_missing`（仅补充缺失）/ `append`（追加）/ `replace`（替换） |
| `MAX_OPS_V1` | 单次请求最多 80 个操作 |
| `MAX_MD_CHARS_V1` | 每个 Markdown 字段最大 20000 字符 |

### 13.2 CharacterPatchV1 (嵌套 - 角色补丁)

| 继承自 | `BaseModel`，`ConfigDict(extra="forbid")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `role` | `str \| None` | 否 | `None` | `max_length=255` | 角色定位 |
| `profile` | `str \| None` | 否 | `None` | `max_length=20000` | 角色简介 |
| `notes` | `str \| None` | 否 | `None` | `max_length=20000` | 备注 |

### 13.3 CharactersAutoUpdateOpV1 (嵌套 - 单个操作)

| 继承自 | `BaseModel`，`ConfigDict(extra="forbid")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `op` | `CharactersAutoUpdateOpType` | 是 | - | - | 操作类型 |
| `name` | `str \| None` | 否 | `None` | `max_length=255` | 角色名称（upsert 时必填） |
| `patch` | `dict[str, Any] \| None` | 否 | `None` | 内容须满足 `CharacterPatchV1` 验证 | 补丁数据（upsert 时必填） |
| `merge_mode_profile` | `CharacterMergeMode \| None` | 否 | `None` | - | profile 字段的合并模式 |
| `merge_mode_notes` | `CharacterMergeMode \| None` | 否 | `None` | - | notes 字段的合并模式 |
| `canonical_name` | `str \| None` | 否 | `None` | `max_length=255` | 规范名称（dedupe 时必填） |
| `duplicate_names` | `list[str]` | 否 | `[]` | `max_length=50` | 重复名称列表（dedupe 时必填） |
| `reason` | `str \| None` | 否 | `None` | `max_length=400` | 操作原因说明 |

**model_validator (before)**: `_normalize_character_shape` -- 兼容性处理，将 `{"character": {...}}` 格式归一化为 `name + patch` 格式，并过滤未知字段。

**model_validator (after)**: `_validate_op` -- 根据 `op` 类型验证必填字段：
- `dedupe`: 必须有 `canonical_name` 和 `duplicate_names`
- `upsert`: 必须有 `name` 和 `patch`，且 `patch` 须通过 `CharacterPatchV1` 验证

### 13.4 CharactersAutoUpdateV1Request (请求 - 批量自动更新角色)

| 继承自 | `BaseModel`，`ConfigDict(extra="forbid")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `schema_version` | `CharactersAutoUpdateSchemaVersion` | 否 | `"characters_auto_update_v1"` | - | Schema 版本标识 |
| `title` | `str \| None` | 否 | `None` | `max_length=255` | 更新批次标题 |
| `summary_md` | `str \| None` | 否 | `None` | `max_length=20000` | 更新摘要 |
| `ops` | `list[CharactersAutoUpdateOpV1]` | 否 | `[]` | `max_length=80` | 操作列表（空列表为 no-op） |

---

## 14. 世界观百科 Schema

**文件**: `backend/app/schemas/worldbook.py`

### 14.1 类型别名

```python
WorldBookPriority = Literal["drop_first", "optional", "important", "must"]
WorldBookImportMode = Literal["merge", "overwrite"]
```

| 类型 | 说明 |
|------|------|
| `WorldBookPriority` | 词条优先级: `drop_first`（优先丢弃）< `optional`（可选）< `important`（重要）< `must`（必须） |
| `WorldBookImportMode` | 导入模式: `merge`（合并）/ `overwrite`（覆盖） |

### 14.2 WorldBookEntryCreate (请求 - 创建词条)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `title` | `str` | 是 | - | `min_length=1, max_length=255` | 词条标题 |
| `content_md` | `str` | 否 | `""` | `max_length=MAX_MD_CHARS (200000)` | Markdown 内容 |
| `enabled` | `bool` | 否 | `True` | - | 是否启用 |
| `constant` | `bool` | 否 | `False` | - | 是否为常驻词条（始终包含在上下文中） |
| `keywords` | `list[str]` | 否 | `[]` | `max_length=100`; 每项 strip 后非空, max 64 chars | 触发关键词 |
| `exclude_recursion` | `bool` | 否 | `False` | - | 排除递归匹配 |
| `prevent_recursion` | `bool` | 否 | `False` | - | 阻止递归匹配 |
| `char_limit` | `int` | 否 | `12000` | `ge=0, le=200000` | 字符限制 |
| `priority` | `WorldBookPriority` | 否 | `"important"` | - | 优先级 |

### 14.3 WorldBookEntryUpdate (请求 - 更新词条)

| 继承自 | `BaseModel` |
|--------|------|

所有字段均为可选，结构与 Create 一致，但所有类型包裹 `| None`。

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `title` | `str \| None` | 否 | `None` | `min_length=1, max_length=255` | 词条标题 |
| `content_md` | `str \| None` | 否 | `None` | `max_length=MAX_MD_CHARS` | Markdown 内容 |
| `enabled` | `bool \| None` | 否 | `None` | - | 是否启用 |
| `constant` | `bool \| None` | 否 | `None` | - | 是否常驻 |
| `keywords` | `list[str] \| None` | 否 | `None` | `max_length=100`; 同 Create 验证 | 关键词 |
| `exclude_recursion` | `bool \| None` | 否 | `None` | - | 排除递归 |
| `prevent_recursion` | `bool \| None` | 否 | `None` | - | 阻止递归 |
| `char_limit` | `int \| None` | 否 | `None` | `ge=0, le=200000` | 字符限制 |
| `priority` | `WorldBookPriority \| None` | 否 | `None` | - | 优先级 |

### 14.4 WorldBookEntryOut (响应 - 词条详情)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 词条 ID (UUID) |
| `project_id` | `str` | 是 | - | 所属项目 ID |
| `title` | `str` | 是 | - | 标题 |
| `content_md` | `str` | 是 | - | Markdown 内容 |
| `enabled` | `bool` | 是 | - | 是否启用 |
| `constant` | `bool` | 是 | - | 是否常驻 |
| `keywords` | `list[str]` | 否 | `[]` | 关键词 |
| `exclude_recursion` | `bool` | 是 | - | 排除递归 |
| `prevent_recursion` | `bool` | 是 | - | 阻止递归 |
| `char_limit` | `int` | 是 | - | 字符限制 |
| `priority` | `WorldBookPriority` | 是 | - | 优先级 |
| `updated_at` | `datetime` | 是 | - | 更新时间 |

### 14.5 WorldBookBulkUpdateRequest (请求 - 批量更新词条)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `entry_ids` | `list[str]` | 是 | - | `min_length=1, max_length=200` | 目标词条 ID 列表 |
| `enabled` | `bool \| None` | 否 | `None` | - | 批量设置启用状态 |
| `constant` | `bool \| None` | 否 | `None` | - | 批量设置常驻状态 |
| `exclude_recursion` | `bool \| None` | 否 | `None` | - | 批量设置排除递归 |
| `prevent_recursion` | `bool \| None` | 否 | `None` | - | 批量设置阻止递归 |
| `char_limit` | `int \| None` | 否 | `None` | `ge=0, le=200000` | 批量设置字符限制 |
| `priority` | `WorldBookPriority \| None` | 否 | `None` | - | 批量设置优先级 |

### 14.6 WorldBookBulkDeleteRequest (请求 - 批量删除)

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|------|------|------|----------|------|
| `entry_ids` | `list[str]` | 是 | `min_length=1, max_length=200` | 待删除词条 ID 列表 |

### 14.7 WorldBookDuplicateRequest (请求 - 批量复制)

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|------|------|------|----------|------|
| `entry_ids` | `list[str]` | 是 | `min_length=1, max_length=200` | 待复制词条 ID 列表 |

### 14.8 WorldBookTriggeredEntryOut (响应 - 触发的词条)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `str` | 是 | 词条 ID |
| `title` | `str` | 是 | 标题 |
| `reason` | `str` | 是 | 触发原因 |
| `priority` | `WorldBookPriority` | 是 | 优先级 |

### 14.9 WorldBookPreviewTriggerRequest (请求 - 预览触发)

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `query_text` | `str` | 否 | `""` | `max_length=50000` | 查询文本 |
| `include_constant` | `bool` | 否 | `True` | - | 是否包含常驻词条 |
| `enable_recursion` | `bool` | 否 | `True` | - | 是否启用递归匹配 |
| `char_limit` | `int` | 否 | `12000` | `ge=0, le=200000` | 总字符限制 |

### 14.10 WorldBookPreviewTriggerOut (响应 - 预览结果)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `triggered` | `list[WorldBookTriggeredEntryOut]` | 否 | `[]` | 触发的词条列表 |
| `text_md` | `str` | 否 | `""` | 合并后的 Markdown 文本 |
| `truncated` | `bool` | 否 | `False` | 是否被截断 |

### 14.11 导入导出 Schema

#### WorldBookExportEntryV1 (导出的单个词条)

与 `WorldBookEntryCreate` 结构完全一致，包含所有词条字段和同样的关键词验证。

#### WorldBookExportAllOut (响应 - 全量导出)

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `schema_version` | `str` | 否 | `"worldbook_export_all_v1"` | `max_length=64` | 版本标识 |
| `entries` | `list[WorldBookExportEntryV1]` | 否 | `[]` | `max_length=2000` | 词条列表 |

#### WorldBookImportAllRequest (请求 - 全量导入)

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `schema_version` | `str` | 否 | `"worldbook_export_all_v1"` | `max_length=64` | 版本标识 |
| `dry_run` | `bool` | 否 | `False` | - | 是否仅预览不实际导入 |
| `mode` | `WorldBookImportMode` | 否 | `"merge"` | - | 导入模式 |
| `entries` | `list[WorldBookExportEntryV1]` | 否 | `[]` | `max_length=2000` | 词条列表 |

**对应数据库 Model**: `WorldBookEntry` 表。

---

## 15. 世界观百科自动更新 Schema

**文件**: `backend/app/schemas/worldbook_auto_update.py`

此模块用于 AI 分析章节后自动批量更新世界观百科词条。

### 15.1 类型别名与常量

```python
WorldbookAutoUpdateSchemaVersion = Literal["worldbook_auto_update_v1"]
WorldbookAutoUpdateOpType = Literal["create", "update", "merge", "dedupe"]
WorldbookMergeMode = Literal["append_missing", "append", "replace"]

MAX_OPS_V1 = 80
MAX_KEYWORDS_V1 = 40
MAX_ALIASES_V1 = 40
MAX_MD_CHARS_V1 = 40000
```

### 15.2 WorldbookEntryPatchV1 (嵌套 - 词条补丁)

| 继承自 | `BaseModel`，`ConfigDict(extra="forbid")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `title` | `str \| None` | 否 | `None` | `max_length=255` | 标题 |
| `content_md` | `str \| None` | 否 | `None` | `max_length=40000` | 内容 |
| `keywords` | `list[str] \| None` | 否 | `None` | `max_length=40` | 关键词 |
| `aliases` | `list[str] \| None` | 否 | `None` | `max_length=40` | 别名 |
| `enabled` | `bool \| None` | 否 | `None` | - | 启用状态 |
| `constant` | `bool \| None` | 否 | `None` | - | 常驻状态 |
| `exclude_recursion` | `bool \| None` | 否 | `None` | - | 排除递归 |
| `prevent_recursion` | `bool \| None` | 否 | `None` | - | 阻止递归 |
| `char_limit` | `int \| None` | 否 | `None` | `ge=0, le=20000` | 字符限制 |
| `priority` | `str \| None` | 否 | `None` | `max_length=32` | 优先级 |

### 15.3 WorldbookEntryCreateV1 (嵌套 - 新建词条)

| 继承自 | `BaseModel`，`ConfigDict(extra="forbid")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `title` | `str` | 是 | - | `min_length=1, max_length=255` | 标题 |
| `content_md` | `str` | 否 | `""` | `max_length=40000` | 内容 |
| `keywords` | `list[str]` | 否 | `[]` | `max_length=40` | 关键词 |
| `aliases` | `list[str]` | 否 | `[]` | `max_length=40` | 别名 |
| `enabled` | `bool` | 否 | `True` | - | 启用 |
| `constant` | `bool` | 否 | `False` | - | 常驻 |
| `exclude_recursion` | `bool` | 否 | `False` | - | 排除递归 |
| `prevent_recursion` | `bool` | 否 | `False` | - | 阻止递归 |
| `char_limit` | `int` | 否 | `12000` | `ge=0, le=20000` | 字符限制 |
| `priority` | `str` | 否 | `"important"` | `max_length=32` | 优先级 |

### 15.4 WorldbookAutoUpdateOpV1 (嵌套 - 单个操作)

| 继承自 | `BaseModel`，`ConfigDict(extra="forbid")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `op` | `WorldbookAutoUpdateOpType` | 是 | - | - | 操作类型 (create/update/merge/dedupe) |
| `match_title` | `str \| None` | 否 | `None` | `max_length=255` | 匹配标题（update/merge 必填） |
| `entry` | `dict[str, Any] \| None` | 否 | `None` | 内容须满足对应 Schema 验证 | 词条数据 |
| `merge_mode` | `WorldbookMergeMode \| None` | 否 | `None` | - | 合并模式（merge 必填） |
| `canonical_title` | `str \| None` | 否 | `None` | `max_length=255` | 规范标题（dedupe 必填） |
| `duplicate_titles` | `list[str]` | 否 | `[]` | `max_length=50` | 重复标题列表（dedupe 必填） |
| `reason` | `str \| None` | 否 | `None` | `max_length=400` | 操作原因 |

**model_validator (before)**: `_normalize_item_shape` -- 复杂的兼容性处理：
1. 将 `{"item": {...}}` 格式归一化为 `{"entry": {...}}`
2. 将 `content` / `description` 字段映射到 `content_md`
3. 将数字优先级转换为字符串（0 -> "drop_first", 1 -> "optional", 2-5 -> "important", 6+ -> "must"）
4. 过滤未知字段

**model_validator (after)**: `_validate_op` -- 根据 `op` 类型验证:
- `dedupe`: 必须有 `canonical_title` 和 `duplicate_titles`
- `create`: 必须有 `entry`，并通过 `WorldbookEntryCreateV1` 验证
- `update`/`merge`: 必须有 `match_title` 和 `entry`，通过 `WorldbookEntryPatchV1` 验证; merge 还需 `merge_mode`

### 15.5 WorldbookAutoUpdateV1Request (请求 - 批量自动更新百科)

| 继承自 | `BaseModel`，`ConfigDict(extra="forbid")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `schema_version` | `WorldbookAutoUpdateSchemaVersion` | 否 | `"worldbook_auto_update_v1"` | - | 版本标识 |
| `title` | `str \| None` | 否 | `None` | `max_length=255` | 更新批次标题 |
| `summary_md` | `str \| None` | 否 | `None` | `max_length=40000` | 更新摘要 |
| `ops` | `list[WorldbookAutoUpdateOpV1]` | 否 | `[]` | `max_length=80` | 操作列表 |

---

## 16. 写作风格 Schema

**文件**: `backend/app/schemas/writing_styles.py`

### 16.1 WritingStyleOut (响应 - 写作风格详情)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 风格 ID (UUID) |
| `owner_user_id` | `str \| None` | 否 | `None` | 所有者用户 ID（null 表示系统预设） |
| `name` | `str` | 是 | - | 风格名称 |
| `description` | `str \| None` | 否 | `None` | 风格描述 |
| `prompt_content` | `str` | 是 | - | 提示词内容 |
| `is_preset` | `bool` | 否 | `False` | 是否为系统预设 |
| `created_at` | `datetime \| None` | 否 | `None` | 创建时间 |
| `updated_at` | `datetime \| None` | 否 | `None` | 更新时间 |

### 16.2 WritingStyleCreateRequest (请求 - 创建写作风格)

| 继承自 | `RequestModel`（`extra="forbid"`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `name` | `str` | 是 | - | `min_length=1, max_length=255` | 风格名称 |
| `description` | `str \| None` | 否 | `None` | `max_length=1000` | 描述 |
| `prompt_content` | `str` | 是 | - | `min_length=1, max_length=8000` | 提示词内容 |

### 16.3 WritingStyleUpdateRequest (请求 - 更新写作风格)

| 继承自 | `RequestModel`（`extra="forbid"`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `name` | `str \| None` | 否 | `None` | `min_length=1, max_length=255` | 风格名称 |
| `description` | `str \| None` | 否 | `None` | `max_length=1000` | 描述 |
| `prompt_content` | `str \| None` | 否 | `None` | `min_length=1, max_length=8000` | 提示词内容 |

### 16.4 ProjectDefaultStyleOut (响应 - 项目默认风格)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `project_id` | `str` | 是 | - | 项目 ID |
| `style_id` | `str \| None` | 否 | `None` | 默认风格 ID |
| `updated_at` | `datetime \| None` | 否 | `None` | 更新时间 |

### 16.5 ProjectDefaultStylePutRequest (请求 - 设置项目默认风格)

| 继承自 | `RequestModel`（`extra="forbid"`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `style_id` | `str \| None` | 否 | `None` | 风格 ID（null 则清除） |

**对应数据库 Model**: `WritingStyle` 表, `ProjectDefaultStyle` 关联表。

---

## 17. LLM 预设 Schema

**文件**: `backend/app/schemas/llm_preset.py`

### 17.1 LLMPresetOut (响应 - 项目 LLM 预设详情)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `project_id` | `str` | 是 | - | 所属项目 ID |
| `provider` | `LLMProvider` | 是 | - | LLM 提供商 |
| `provider_key` | `str \| None` | 否 | `None` | 提供商标识键 |
| `model_key` | `str \| None` | 否 | `None` | 模型标识键 |
| `known_model` | `bool` | 否 | `False` | 是否为已知模型 |
| `contract_mode` | `str` | 否 | `"audit"` | 合约模式 |
| `pricing` | `dict[str, Any]` | 否 | `{}` | 定价信息 |
| `base_url` | `str \| None` | 否 | `None` | API 地址 |
| `model` | `str` | 是 | - | 模型名称 |
| `temperature` | `float \| None` | 否 | `None` | 温度参数 |
| `top_p` | `float \| None` | 否 | `None` | Top-p 采样 |
| `max_tokens` | `int \| None` | 否 | `None` | 最大生成 token |
| `max_tokens_limit` | `int \| None` | 否 | `None` | 模型 token 上限 |
| `max_tokens_recommended` | `int \| None` | 否 | `None` | 推荐 token 数 |
| `context_window_limit` | `int \| None` | 否 | `None` | 上下文窗口大小 |
| `presence_penalty` | `float \| None` | 否 | `None` | 存在惩罚 |
| `frequency_penalty` | `float \| None` | 否 | `None` | 频率惩罚 |
| `top_k` | `int \| None` | 否 | `None` | Top-k 采样 |
| `stop` | `list[str]` | 否 | `[]` | 停止序列 |
| `timeout_seconds` | `int \| None` | 否 | `None` | 超时秒数 |
| `extra` | `dict[str, Any]` | 否 | `{}` | 额外参数 |

### 17.2 LLMPresetPutRequest (请求 - 设置 LLM 预设)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `provider` | `LLMProvider` | 是 | - | - | LLM 提供商 |
| `base_url` | `str \| None` | 否 | `None` | `max_length=2048` | API 地址 |
| `model` | `str` | 是 | - | `min_length=1, max_length=255` | 模型名称 |
| `temperature` | `float \| None` | 否 | `None` | - | 温度 |
| `top_p` | `float \| None` | 否 | `None` | - | Top-p |
| `max_tokens` | `int \| None` | 否 | `None` | - | 最大 token |
| `presence_penalty` | `float \| None` | 否 | `None` | - | 存在惩罚 |
| `frequency_penalty` | `float \| None` | 否 | `None` | - | 频率惩罚 |
| `top_k` | `int \| None` | 否 | `None` | - | Top-k |
| `stop` | `list[str]` | 否 | `[]` | `max_length=32`; 每项 strip 后非空, max 256 chars | 停止序列 |
| `timeout_seconds` | `int \| None` | 否 | `None` | `ge=1, le=1800` | 超时 |
| `extra` | `dict[str, Any]` | 否 | `{}` | `max_length=200`; `validate_json_chars(max=20000)`; key <= 128 chars | 额外参数 |

---

## 18. LLM 配置档 Schema

**文件**: `backend/app/schemas/llm_profiles.py`

LLM 配置档是用户级别的全局 LLM 配置，可被多个项目引用。

### 18.1 辅助函数

`_validate_stop_items(value)` -- 复用的 stop 列表验证逻辑，逐项检查类型、空值和长度。

### 18.2 LLMProfileCreate (请求 - 创建配置档)

| 继承自 | `RequestModel`（`extra="forbid"`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `name` | `str` | 是 | - | `min_length=1, max_length=255` | 配置档名称 |
| `provider` | `str` | 是 | - | `min_length=1, max_length=32` | 提供商标识 |
| `base_url` | `str \| None` | 否 | `None` | `max_length=2048` | API 地址 |
| `model` | `str` | 是 | - | `min_length=1, max_length=255` | 模型名称 |
| `temperature` | `float \| None` | 否 | `None` | - | 温度 |
| `top_p` | `float \| None` | 否 | `None` | - | Top-p |
| `max_tokens` | `int \| None` | 否 | `None` | - | 最大 token |
| `presence_penalty` | `float \| None` | 否 | `None` | - | 存在惩罚 |
| `frequency_penalty` | `float \| None` | 否 | `None` | - | 频率惩罚 |
| `top_k` | `int \| None` | 否 | `None` | - | Top-k |
| `stop` | `list[str]` | 否 | `[]` | `max_length=32`; `_validate_stop_items` | 停止序列 |
| `timeout_seconds` | `int \| None` | 否 | `None` | `ge=1, le=1800` | 超时 |
| `extra` | `dict[str, Any]` | 否 | `{}` | `max_length=200`; `validate_json_chars(max=20000)`; key <= 128 | 额外参数 |
| `api_key` | `str \| None` | 否 | `None` | `max_length=4096` | API 密钥（明文写入，存储时加密） |

### 18.3 LLMProfileUpdate (请求 - 更新配置档)

| 继承自 | `RequestModel`（`extra="forbid"`） |
|--------|------|

所有字段均为可选（`None` 默认值），结构与 Create 一致，`stop` 和 `extra` 类型包裹 `| None`。

### 18.4 LLMProfileOut (响应 - 配置档详情)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 配置档 ID (UUID) |
| `owner_user_id` | `str` | 是 | - | 所有者用户 ID |
| `name` | `str` | 是 | - | 名称 |
| `provider` | `str` | 是 | - | 提供商 |
| `provider_key` | `str \| None` | 否 | `None` | 提供商标识键 |
| `model_key` | `str \| None` | 否 | `None` | 模型标识键 |
| `known_model` | `bool` | 否 | `False` | 是否已知模型 |
| `contract_mode` | `str` | 否 | `"audit"` | 合约模式 |
| `pricing` | `dict[str, Any]` | 否 | `{}` | 定价信息 |
| `base_url` | `str \| None` | 否 | `None` | API 地址 |
| `model` | `str` | 是 | - | 模型名称 |
| `temperature` | `float \| None` | 否 | `None` | 温度 |
| `top_p` | `float \| None` | 否 | `None` | Top-p |
| `max_tokens` | `int \| None` | 否 | `None` | 最大 token |
| `presence_penalty` | `float \| None` | 否 | `None` | 存在惩罚 |
| `frequency_penalty` | `float \| None` | 否 | `None` | 频率惩罚 |
| `top_k` | `int \| None` | 否 | `None` | Top-k |
| `stop` | `list[str]` | 否 | `[]` | 停止序列 |
| `timeout_seconds` | `int \| None` | 否 | `None` | 超时 |
| `extra` | `dict[str, Any]` | 否 | `{}` | 额外参数 |
| `has_api_key` | `bool` | 是 | - | 是否已配置 API Key |
| `masked_api_key` | `str \| None` | 否 | `None` | 脱敏后的 API Key |
| `created_at` | `datetime` | 是 | - | 创建时间 |
| `updated_at` | `datetime` | 是 | - | 更新时间 |

**对应数据库 Model**: `LLMProfile` 表。注意响应中不会返回明文 API Key，只返回 `has_api_key` 和 `masked_api_key`。

---

## 19. LLM 任务预设 Schema

**文件**: `backend/app/schemas/llm_task_presets.py`

每个 AI 任务（如章节生成、大纲生成等）可以独立配置 LLM 参数。

### 19.1 LLMTaskCatalogItemOut (响应 - 任务目录项)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | `str` | 是 | 任务唯一键 |
| `label` | `str` | 是 | 显示标签 |
| `group` | `str` | 是 | 所属分组 |
| `description` | `str` | 是 | 任务描述 |

### 19.2 LLMTaskPresetOut (响应 - 任务预设详情)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `project_id` | `str` | 是 | - | 项目 ID |
| `task_key` | `str` | 是 | - | 任务键 |
| `llm_profile_id` | `str \| None` | 否 | `None` | 引用的配置档 ID |
| `provider` | `LLMProvider` | 是 | - | 提供商 |
| `provider_key` | `str \| None` | 否 | `None` | 提供商标识键 |
| `model_key` | `str \| None` | 否 | `None` | 模型标识键 |
| `known_model` | `bool` | 否 | `False` | 是否已知模型 |
| `contract_mode` | `str` | 否 | `"audit"` | 合约模式 |
| `pricing` | `dict[str, Any]` | 否 | `{}` | 定价 |
| `base_url` | `str \| None` | 否 | `None` | API 地址 |
| `model` | `str` | 是 | - | 模型名称 |
| `temperature` | `float \| None` | 否 | `None` | 温度 |
| `top_p` | `float \| None` | 否 | `None` | Top-p |
| `max_tokens` | `int \| None` | 否 | `None` | 最大 token |
| `max_tokens_limit` | `int \| None` | 否 | `None` | token 上限 |
| `max_tokens_recommended` | `int \| None` | 否 | `None` | 推荐 token |
| `context_window_limit` | `int \| None` | 否 | `None` | 上下文窗口 |
| `presence_penalty` | `float \| None` | 否 | `None` | 存在惩罚 |
| `frequency_penalty` | `float \| None` | 否 | `None` | 频率惩罚 |
| `top_k` | `int \| None` | 否 | `None` | Top-k |
| `stop` | `list[str]` | 否 | `[]` | 停止序列 |
| `timeout_seconds` | `int \| None` | 否 | `None` | 超时 |
| `extra` | `dict[str, Any]` | 否 | `{}` | 额外参数 |
| `source` | `str` | 否 | `"task_override"` | 配置来源标识 |

### 19.3 LLMTaskPresetPutRequest (请求 - 设置任务预设)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `llm_profile_id` | `str \| None` | 否 | `None` | `max_length=36`; 自定义验证: strip 后空字符串转 None | 引用的配置档 ID |
| `provider` | `LLMProvider` | 是 | - | - | 提供商 |
| `base_url` | `str \| None` | 否 | `None` | `max_length=2048` | API 地址 |
| `model` | `str` | 是 | - | `min_length=1, max_length=255` | 模型名称 |
| `temperature` | `float \| None` | 否 | `None` | - | 温度 |
| `top_p` | `float \| None` | 否 | `None` | - | Top-p |
| `max_tokens` | `int \| None` | 否 | `None` | - | 最大 token |
| `presence_penalty` | `float \| None` | 否 | `None` | - | 存在惩罚 |
| `frequency_penalty` | `float \| None` | 否 | `None` | - | 频率惩罚 |
| `top_k` | `int \| None` | 否 | `None` | - | Top-k |
| `stop` | `list[str]` | 否 | `[]` | `max_length=32`; 同 llm_preset 验证 | 停止序列 |
| `timeout_seconds` | `int \| None` | 否 | `None` | `ge=1, le=1800` | 超时 |
| `extra` | `dict[str, Any]` | 否 | `{}` | `max_length=200`; `validate_json_chars(max=20000)` | 额外参数 |

**对应数据库 Model**: `LLMTaskPreset` 表。

---

## 20. LLM 测试 Schema

**文件**: `backend/app/schemas/llm_test.py`

### 20.1 LLMTestRequest (请求 - 测试 LLM 连接)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `project_id` | `str \| None` | 否 | `None` | `max_length=36` | 可选的项目上下文 |
| `profile_id` | `str \| None` | 否 | `None` | `max_length=36` | 可选的配置档 ID |
| `provider` | `LLMProvider` | 是 | - | - | LLM 提供商 |
| `base_url` | `str \| None` | 否 | `None` | `max_length=2048` | API 地址 |
| `model` | `str` | 是 | - | `min_length=1, max_length=255` | 模型名称 |
| `timeout_seconds` | `int \| None` | 否 | `180` | `ge=1, le=1800` | 超时（默认 180 秒） |
| `params` | `dict[str, Any]` | 否 | `{}` | `max_length=200`; `validate_json_chars(max=20000)` | 测试参数 |
| `extra` | `dict[str, Any]` | 否 | `{}` | `max_length=200`; `validate_json_chars(max=20000)` | 额外参数 |

---

## 21. 提示词预设 Schema

**文件**: `backend/app/schemas/prompt_presets.py`

提示词预设系统是一套完整的提示词模板管理体系，包含预设、提示词块、预览、导入导出等功能。

### 21.1 PromptPresetOut (响应 - 预设元数据)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 预设 ID |
| `project_id` | `str` | 是 | - | 项目 ID |
| `name` | `str` | 是 | - | 名称 |
| `resource_key` | `str \| None` | 否 | `None` | 资源键 |
| `category` | `str \| None` | 否 | `None` | 分类 |
| `scope` | `str` | 是 | - | 作用域 |
| `version` | `int` | 是 | - | 版本号 |
| `active_for` | `list[str]` | 否 | `[]` | 激活的任务列表 |
| `created_at` | `datetime \| None` | 否 | `None` | 创建时间 |
| `updated_at` | `datetime \| None` | 否 | `None` | 更新时间 |

### 21.2 PromptPresetCreate (请求 - 创建预设)

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `name` | `str` | 是 | - | `min_length=1, max_length=255` | 名称 |
| `category` | `str \| None` | 否 | `None` | `max_length=64` | 分类 |
| `scope` | `str` | 否 | `"project"` | `min_length=1, max_length=32` | 作用域 |
| `version` | `int` | 否 | `1` | `ge=1` | 版本号 |
| `active_for` | `list[str]` | 否 | `[]` | `max_length=50` | 激活的任务 |

### 21.3 PromptPresetUpdate (请求 - 更新预设)

所有字段均为可选，结构与 Create 一致。

### 21.4 PromptPresetResourceOut (响应 - 预设资源)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `key` | `str` | 是 | - | 资源键 |
| `name` | `str` | 是 | - | 名称 |
| `category` | `str \| None` | 否 | `None` | 分类 |
| `scope` | `str` | 是 | - | 作用域 |
| `version` | `int` | 是 | - | 版本号 |
| `activation_tasks` | `list[str]` | 否 | `[]` | 可激活的任务列表 |
| `preset_id` | `str \| None` | 否 | `None` | 关联的预设 ID |
| `preset_version` | `int \| None` | 否 | `None` | 预设版本 |
| `preset_updated_at` | `datetime \| None` | 否 | `None` | 预设更新时间 |

### 21.5 PromptBlockOut (响应 - 提示词块详情)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 块 ID |
| `preset_id` | `str` | 是 | - | 所属预设 ID |
| `identifier` | `str` | 是 | - | 标识符（唯一键） |
| `name` | `str` | 是 | - | 显示名称 |
| `role` | `str` | 是 | - | 消息角色 (system/user/assistant) |
| `enabled` | `bool` | 是 | - | 是否启用 |
| `template` | `str \| None` | 否 | `None` | 模板内容 |
| `marker_key` | `str \| None` | 否 | `None` | 标记键 |
| `injection_position` | `str` | 是 | - | 注入位置 |
| `injection_depth` | `int \| None` | 否 | `None` | 注入深度 |
| `injection_order` | `int` | 是 | - | 注入排序 |
| `triggers` | `list[str]` | 否 | `[]` | 触发条件 |
| `forbid_overrides` | `bool` | 否 | `False` | 是否禁止覆盖 |
| `budget` | `dict[str, Any]` | 否 | `{}` | Token 预算配置 |
| `cache` | `dict[str, Any]` | 否 | `{}` | 缓存配置 |
| `created_at` | `datetime \| None` | 否 | `None` | 创建时间 |
| `updated_at` | `datetime \| None` | 否 | `None` | 更新时间 |

### 21.6 PromptBlockCreate (请求 - 创建提示词块)

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `identifier` | `str` | 是 | - | `min_length=1, max_length=128` | 标识符 |
| `name` | `str` | 是 | - | `min_length=1, max_length=255` | 名称 |
| `role` | `str` | 是 | - | `min_length=1, max_length=16` | 角色 |
| `enabled` | `bool` | 否 | `True` | - | 启用 |
| `template` | `str \| None` | 否 | `None` | `max_length=MAX_TEMPLATE_CHARS (100000)` | 模板 |
| `marker_key` | `str \| None` | 否 | `None` | `max_length=255` | 标记键 |
| `injection_position` | `str` | 否 | `"relative"` | `min_length=1, max_length=16` | 注入位置 |
| `injection_depth` | `int \| None` | 否 | `None` | - | 注入深度 |
| `injection_order` | `int` | 否 | `0` | - | 注入排序 |
| `triggers` | `list[str]` | 否 | `[]` | `max_length=50` | 触发条件 |
| `forbid_overrides` | `bool` | 否 | `False` | - | 禁止覆盖 |
| `budget` | `dict[str, Any]` | 否 | `{}` | `max_length=100`; `validate_json_chars(max=20000)` | 预算 |
| `cache` | `dict[str, Any]` | 否 | `{}` | `max_length=100`; `validate_json_chars(max=20000)` | 缓存 |

### 21.7 PromptBlockUpdate (请求 - 更新提示词块)

所有字段均为可选，结构与 Create 一致。

### 21.8 PromptBlockReorderRequest (请求 - 排序提示词块)

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|------|------|------|----------|------|
| `ordered_block_ids` | `list[str]` | 是 | `min_length=1, max_length=200`; 每项 strip 后非空, max 36 chars | 排序后的块 ID 列表 |

### 21.9 PromptPreviewRequest (请求 - 预览渲染后的提示词)

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `task` | `str` | 是 | - | `min_length=1, max_length=64` | 目标任务 |
| `preset_id` | `str \| None` | 否 | `None` | `max_length=36` | 指定预设 ID |
| `values` | `dict[str, Any]` | 否 | `{}` | `max_length=200`; `validate_json_chars(max=100000)` | 模板变量值 |

### 21.10 PromptPreviewBlock (响应 - 预览中的单个块)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 块 ID |
| `identifier` | `str` | 是 | - | 标识符 |
| `role` | `str` | 是 | - | 角色 |
| `enabled` | `bool` | 是 | - | 是否启用 |
| `text` | `str` | 是 | - | 渲染后的文本 |
| `missing` | `list[str]` | 否 | `[]` | 缺失的模板变量 |
| `token_estimate` | `int` | 否 | `0` | 估算 token 数 |

### 21.11 PromptPreviewOut (响应 - 预览结果)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `preset_id` | `str` | 是 | - | 预设 ID |
| `task` | `str` | 是 | - | 任务 |
| `system` | `str` | 是 | - | 渲染后的 system 提示词 |
| `user` | `str` | 是 | - | 渲染后的 user 提示词 |
| `prompt_tokens_estimate` | `int` | 否 | `0` | 估算 token 总数 |
| `prompt_budget_tokens` | `int \| None` | 否 | `None` | Token 预算上限 |
| `missing` | `list[str]` | 否 | `[]` | 全局缺失变量 |
| `blocks` | `list[PromptPreviewBlock]` | 否 | `[]` | 各块预览详情 |

### 21.12 导入导出 Schema

#### PromptPresetExportBlock

与 `PromptBlockCreate` 结构完全一致，包含所有提示词块字段。

#### PromptPresetExportPreset

与 `PromptPresetCreate` 结构完全一致。

#### PromptPresetExportOut (响应 - 单预设导出)

| 字段 | 类型 | 说明 |
|------|------|------|
| `preset` | `PromptPresetExportPreset` | 预设元数据 |
| `blocks` | `list[PromptPresetExportBlock]` | 提示词块列表 |

#### PromptPresetImportRequest (请求 - 单预设导入)

| 字段 | 类型 | 验证规则 | 说明 |
|------|------|----------|------|
| `preset` | `PromptPresetExportPreset` | - | 预设元数据 |
| `blocks` | `list[PromptPresetExportBlock]` | `max_length=200` | 提示词块列表 |

#### PromptPresetExportAllOut (响应 - 全量导出)

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `schema_version` | `str` | `"prompt_presets_export_all_v1"` | 版本标识 |
| `presets` | `list[PromptPresetExportOut]` | `[]` | 预设列表（max 200） |

#### PromptPresetImportAllRequest (请求 - 全量导入)

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `schema_version` | `str` | `"prompt_presets_export_all_v1"` | 版本标识 |
| `dry_run` | `bool` | `False` | 仅预览 |
| `presets` | `list[PromptPresetExportOut]` | `[]` | 预设列表（max 200） |

**对应数据库 Model**: `PromptPreset` 表, `PromptBlock` 表。

---

## 22. 批量生成 Schema

**文件**: `backend/app/schemas/batch_generation.py`

### 22.1 类型别名

```python
BatchGenerationTaskStatus = Literal["queued", "running", "paused", "succeeded", "failed", "canceled"]
BatchGenerationItemStatus = Literal["queued", "running", "succeeded", "failed", "canceled", "skipped"]
```

### 22.2 BatchGenerationCreateRequest (请求 - 创建批量生成任务)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `after_chapter_id` | `str \| None` | 否 | `None` | `max_length=36` | 从哪个章节之后开始 |
| `count` | `int` | 是 | - | `ge=1, le=200` | 生成数量 |
| `include_existing` | `bool` | 否 | `False` | - | 是否包含已有章节 |
| `instruction` | `str` | 否 | `""` | `max_length=4000` | 全局指令 |
| `target_word_count` | `int \| None` | 否 | `None` | `ge=100, le=50000` | 每章目标字数 |
| `plan_first` | `bool` | 否 | `False` | - | 是否先生成计划 |
| `post_edit` | `bool` | 否 | `False` | - | 后编辑 |
| `post_edit_sanitize` | `bool` | 否 | `False` | - | 后编辑净化 |
| `content_optimize` | `bool` | 否 | `False` | - | 内容优化 |
| `style_id` | `str \| None` | 否 | `None` | `max_length=36` | 写作风格 ID |
| `context` | `ChapterGenerateContext` | 否 | `ChapterGenerateContext()` | - | 上下文配置 |

### 22.3 BatchGenerationTaskItemOut (响应 - 批量任务子项)

| 继承自 | `ORMModel`（`from_attributes=True`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 子项 ID |
| `task_id` | `str` | 是 | - | 所属任务 ID |
| `chapter_id` | `str \| None` | 否 | `None` | 关联章节 ID |
| `chapter_number` | `int` | 是 | - | 章节序号 |
| `status` | `BatchGenerationItemStatus` | 是 | - | 子项状态 |
| `attempt_count` | `int` | 是 | - | 尝试次数 |
| `generation_run_id` | `str \| None` | 否 | `None` | 生成记录 ID |
| `last_request_id` | `str \| None` | 否 | `None` | 最后请求 ID |
| `error_message` | `str \| None` | 否 | `None` | 错误消息 |
| `last_error_json` | `str \| None` | 否 | `None` | 最后错误 JSON |
| `started_at` | `datetime \| None` | 否 | `None` | 开始时间 |
| `finished_at` | `datetime \| None` | 否 | `None` | 结束时间 |
| `created_at` | `datetime` | 是 | - | 创建时间 |
| `updated_at` | `datetime` | 是 | - | 更新时间 |

### 22.4 BatchGenerationTaskOut (响应 - 批量任务详情)

| 继承自 | `ORMModel`（`from_attributes=True`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 任务 ID |
| `project_id` | `str` | 是 | - | 项目 ID |
| `outline_id` | `str` | 是 | - | 大纲 ID |
| `actor_user_id` | `str \| None` | 否 | `None` | 操作用户 ID |
| `project_task_id` | `str \| None` | 否 | `None` | 项目任务 ID |
| `status` | `BatchGenerationTaskStatus` | 是 | - | 任务状态 |
| `total_count` | `int` | 是 | - | 总章节数 |
| `completed_count` | `int` | 是 | - | 已完成数 |
| `failed_count` | `int` | 是 | - | 失败数 |
| `skipped_count` | `int` | 是 | - | 跳过数 |
| `cancel_requested` | `bool` | 是 | - | 是否请求取消 |
| `pause_requested` | `bool` | 是 | - | 是否请求暂停 |
| `checkpoint_json` | `str \| None` | 否 | `None` | 检查点 JSON |
| `error_json` | `str \| None` | 否 | `None` | 错误 JSON |
| `created_at` | `datetime` | 是 | - | 创建时间 |
| `updated_at` | `datetime` | 是 | - | 更新时间 |

**对应数据库 Model**: `BatchGenerationTask` 表, `BatchGenerationTaskItem` 表。

---

## 23. 生成记录 Schema

**文件**: `backend/app/schemas/generation_runs.py`

### 23.1 GenerationRunOut (响应 - 生成记录详情)

| 继承自 | `BaseModel` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `str` | 是 | - | 记录 ID |
| `project_id` | `str` | 是 | - | 项目 ID |
| `actor_user_id` | `str \| None` | 否 | `None` | 操作用户 ID |
| `chapter_id` | `str \| None` | 否 | `None` | 关联章节 ID |
| `type` | `str` | 是 | - | 生成类型（如 chapter_generate, outline_generate 等） |
| `provider` | `str \| None` | 否 | `None` | LLM 提供商 |
| `model` | `str \| None` | 否 | `None` | 模型名称 |
| `request_id` | `str \| None` | 否 | `None` | 请求 ID |
| `prompt_system` | `str \| None` | 否 | `None` | System 提示词（调试用） |
| `prompt_user` | `str \| None` | 否 | `None` | User 提示词（调试用） |
| `prompt_render_log` | `dict[str, Any] \| None` | 否 | `None` | 提示词渲染日志 |
| `params` | `dict[str, Any]` | 否 | `{}` | LLM 调用参数 |
| `output_text` | `str \| None` | 否 | `None` | 生成的文本 |
| `error` | `dict[str, Any] \| None` | 否 | `None` | 错误信息 |
| `created_at` | `datetime` | 是 | - | 创建时间 |

**对应数据库 Model**: `GenerationRun` 表。此 Schema 是只读的，仅用于查询历史生成记录。

---

## 24. 记忆打包 Schema

**文件**: `backend/app/schemas/memory_pack.py`

### 24.1 MemoryContextSection (类型别名)

```python
MemoryContextSection = Literal[
    "worldbook", "story_memory", "semantic_history",
    "foreshadow_open_loops", "structured", "tables",
    "vector_rag", "graph", "fractal",
]
```

系统支持的 9 种记忆上下文区段。

### 24.2 MemoryContextSectionOut (响应 - 单个区段状态)

| 继承自 | `BaseModel`，`ConfigDict(extra="allow")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `enabled` | `bool` | 否 | `False` | 区段是否启用 |
| `disabled_reason` | `str \| None` | 否 | `None` | 未启用的原因 |

> 注意: `extra="allow"` 意味着区段可以携带额外的动态字段（如区段特有的统计信息）。

### 24.3 MemoryContextLogItemOut (响应 - 上下文日志条目)

| 继承自 | `BaseModel`，`ConfigDict(extra="allow")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `section` | `MemoryContextSection` | 是 | - | 区段名称 |
| `enabled` | `bool` | 是 | - | 是否启用 |
| `disabled_reason` | `str \| None` | 否 | `None` | 未启用原因 |
| `note` | `str \| None` | 否 | `None` | 附加说明 |

### 24.4 MemoryContextPackOut (响应 - 完整记忆上下文包)

| 继承自 | `BaseModel` |
|--------|------|

包含 9 个记忆区段 + 日志列表：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `worldbook` | `MemoryContextSectionOut` | `MemoryContextSectionOut()` | 世界观百科区段 |
| `story_memory` | `MemoryContextSectionOut` | `MemoryContextSectionOut()` | 故事记忆区段 |
| `semantic_history` | `MemoryContextSectionOut` | `MemoryContextSectionOut()` | 语义历史区段 |
| `foreshadow_open_loops` | `MemoryContextSectionOut` | `MemoryContextSectionOut()` | 伏笔/开放循环区段 |
| `structured` | `MemoryContextSectionOut` | `MemoryContextSectionOut()` | 结构化数据区段 |
| `tables` | `MemoryContextSectionOut` | `MemoryContextSectionOut()` | 表格数据区段 |
| `vector_rag` | `MemoryContextSectionOut` | `MemoryContextSectionOut()` | 向量 RAG 区段 |
| `graph` | `MemoryContextSectionOut` | `MemoryContextSectionOut()` | 知识图谱区段 |
| `fractal` | `MemoryContextSectionOut` | `MemoryContextSectionOut()` | 分形记忆区段 |
| `logs` | `list[MemoryContextLogItemOut]` | `[]` | 组装日志 |

---

## 25. 记忆预览 Schema

**文件**: `backend/app/schemas/memory_preview.py`

### 25.1 MemoryPreviewRequest (请求 - 预览记忆上下文)

| 继承自 | `RequestModel`（`extra="forbid"`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `query_text` | `str` | 否 | `""` | `max_length=5000` | 查询文本 |
| `section_enabled` | `dict[str, bool]` | 否 | `{}` | - | 各区段的启用开关覆盖 |
| `budget_overrides` | `dict[str, int]` | 否 | `{}` | - | 各区段的 token 预算覆盖 |

---

## 26. 记忆更新 Schema

**文件**: `backend/app/schemas/memory_update.py`

此模块定义了结构化记忆（知识图谱中的实体、关系、事件、伏笔、证据）的批量更新协议。

### 26.1 类型别名与常量

```python
MemoryUpdateSchemaVersion = Literal["memory_update_v1"]
MemoryTargetTable = Literal["entities", "relations", "events", "foreshadows", "evidence"]
MemoryOpType = Literal["upsert", "delete"]

MAX_OPS_V1 = 50
MAX_EVIDENCE_IDS_PER_OP = 20
MAX_ATTRIBUTES_JSON_CHARS = 8000
MAX_MD_CHARS = 40000
```

### 26.2 After 模型（目标数据结构）

每种目标表有对应的 After 模型，描述 upsert 操作后的期望状态：

#### EntityAfter (实体)

| 继承自 | `_AfterBase`（`ConfigDict(extra="forbid")`） |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `entity_type` | `str` | 否 | `"generic"` | `max_length=64` | 实体类型（如 person, location 等） |
| `name` | `str` | 是 | - | `min_length=1, max_length=255` | 实体名称 |
| `summary_md` | `str \| None` | 否 | `None` | `max_length=40000` | 摘要 Markdown |
| `attributes` | `dict[str, Any] \| None` | 否 | `None` | JSON 紧凑后 <= 8000 chars | 扩展属性 |

#### RelationAfter (关系)

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `from_entity_id` | `str` | 是 | - | `min_length=1, max_length=36` | 起始实体 ID |
| `to_entity_id` | `str` | 是 | - | `min_length=1, max_length=36` | 目标实体 ID |
| `relation_type` | `str` | 否 | `"related_to"` | `max_length=64` | 关系类型 |
| `description_md` | `str \| None` | 否 | `None` | `max_length=40000` | 描述 Markdown |
| `attributes` | `dict[str, Any] \| None` | 否 | `None` | JSON <= 8000 chars | 扩展属性 |

#### EventAfter (事件)

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `chapter_id` | `str \| None` | 否 | `None` | `max_length=36` | 关联章节 ID |
| `event_type` | `str` | 否 | `"event"` | `max_length=64` | 事件类型 |
| `title` | `str \| None` | 否 | `None` | `max_length=255` | 事件标题 |
| `content_md` | `str` | 否 | `""` | `max_length=40000` | 事件内容 |
| `attributes` | `dict[str, Any] \| None` | 否 | `None` | JSON <= 8000 chars | 扩展属性 |

#### ForeshadowAfter (伏笔)

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `chapter_id` | `str \| None` | 否 | `None` | `max_length=36` | 设置伏笔的章节 |
| `resolved_at_chapter_id` | `str \| None` | 否 | `None` | `max_length=36` | 解决伏笔的章节 |
| `title` | `str \| None` | 否 | `None` | `max_length=255` | 伏笔标题 |
| `content_md` | `str` | 否 | `""` | `max_length=40000` | 伏笔内容 |
| `resolved` | `int` | 否 | `0` | `ge=0, le=1` | 是否已解决（0/1） |
| `attributes` | `dict[str, Any] \| None` | 否 | `None` | JSON <= 8000 chars | 扩展属性 |

#### EvidenceAfter (证据)

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `source_type` | `str` | 否 | `"unknown"` | `max_length=32` | 来源类型 |
| `source_id` | `str \| None` | 否 | `None` | `max_length=64` | 来源 ID |
| `quote_md` | `str` | 否 | `""` | `max_length=40000` | 引文 Markdown |
| `attributes` | `dict[str, Any] \| None` | 否 | `None` | JSON <= 8000 chars | 扩展属性 |

### 26.3 AFTER_MODEL_BY_TABLE (路由表)

```python
AFTER_MODEL_BY_TABLE = {
    "entities": EntityAfter,
    "relations": RelationAfter,
    "events": EventAfter,
    "foreshadows": ForeshadowAfter,
    "evidence": EvidenceAfter,
}
```

### 26.4 MemoryUpdateOpV1 (嵌套 - 单个操作)

| 继承自 | `BaseModel`，`ConfigDict(extra="forbid")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `op` | `MemoryOpType` | 是 | - | - | 操作类型 (upsert/delete) |
| `target_table` | `MemoryTargetTable` | 是 | - | - | 目标表 |
| `target_id` | `str \| None` | 否 | `None` | `max_length=64` | 目标记录 ID（delete 必填） |
| `after` | `dict[str, Any] \| None` | 否 | `None` | 通过 `AFTER_MODEL_BY_TABLE` 动态验证 | upsert 后的期望状态 |
| `evidence_ids` | `list[str]` | 否 | `[]` | `max_length=20`; 每项 strip 后非空, max 64 chars | 关联证据 ID |

**model_validator (after)**: `_validate_op`:
- `delete`: 必须有 `target_id`，`after` 必须为 `None`
- `upsert`: `after` 必填，且通过对应目标表的 After 模型验证

### 26.5 MemoryUpdateV1Request (请求 - 批量记忆更新)

| 继承自 | `BaseModel`，`ConfigDict(extra="forbid")` |
|--------|------|

| 字段 | 类型 | 必填 | 默认值 | 验证规则 | 说明 |
|------|------|------|--------|----------|------|
| `schema_version` | `MemoryUpdateSchemaVersion` | 否 | `"memory_update_v1"` | - | 版本标识 |
| `idempotency_key` | `str` | 是 | - | `min_length=8, max_length=64` | 幂等性键（防止重复提交） |
| `title` | `str \| None` | 否 | `None` | `max_length=255` | 更新批次标题 |
| `summary_md` | `str \| None` | 否 | `None` | `max_length=40000` | 更新摘要 |
| `ops` | `list[MemoryUpdateOpV1]` | 否 | `[]` | `max_length=50` | 操作列表 |

---

## 27. 数据流向总图

### 27.1 核心数据流模式

本系统中所有数据交互遵循统一的三层流转模式:

```
前端请求                            后端处理                              响应返回
──────────                         ──────────                           ──────────

XxxCreate/Request  ─────>  路由层(Router)  ─────>  OkResponse { data: XxxOut }
XxxUpdate/Request  ─────>  服务层(Service) ─────>  OkResponse { data: XxxOut }
XxxPutRequest      ─────>  数据层(CRUD)    ─────>  OkResponse { data: XxxOut }
                           DB Model 持久化         ErrorResponse { error }
```

### 27.2 CRUD 操作数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│ 创建                                                                │
│                                                                     │
│ XxxCreate (请求Schema)                                              │
│   |                                                                 │
│   v                                                                 │
│ Router: 接收 + Pydantic 自动验证                                     │
│   |                                                                 │
│   v                                                                 │
│ Service: 业务逻辑 -> DB Model.create()                               │
│   |                                                                 │
│   v                                                                 │
│ XxxOut.model_validate(db_obj)  [ORMModel.from_attributes=True]      │
│   |                                                                 │
│   v                                                                 │
│ OkResponse(ok=True, data=XxxOut, request_id=...)                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 更新                                                                │
│                                                                     │
│ XxxUpdate (请求Schema, 所有字段 Optional)                            │
│   |                                                                 │
│   v                                                                 │
│ Router: 接收 + 验证                                                  │
│   |                                                                 │
│   v                                                                 │
│ Service: 仅更新 non-None 字段 -> DB Model.update()                   │
│   |                                                                 │
│   v                                                                 │
│ XxxOut.model_validate(db_obj)                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 27.3 AI 生成操作数据流

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 章节生成                                                                  │
│                                                                          │
│ ChapterGenerateRequest                                                   │
│   ├── mode (replace/append)                                              │
│   ├── instruction                                                        │
│   ├── context: ChapterGenerateContext                                    │
│   │     ├── include_world_setting ──> ProjectSettings.world_setting      │
│   │     ├── include_style_guide ──> ProjectSettings.style_guide          │
│   │     ├── include_constraints ──> ProjectSettings.constraints          │
│   │     ├── include_outline ──> Outline.content_md                       │
│   │     ├── character_ids ──> Character[] 角色资料                        │
│   │     └── previous_chapter ──> 前序章节内容/摘要                        │
│   ├── style_id ──> WritingStyle.prompt_content                           │
│   ├── memory_injection_enabled ──> MemoryContextPack 记忆注入             │
│   ├── mcp_research ──> MCP 工具调用结果                                   │
│   └── prompt_override ──> 用户自定义提示词覆盖                            │
│                                                                          │
│         ↓ 服务层组装                                                      │
│                                                                          │
│   提示词引擎(PromptPreset + PromptBlock)                                 │
│     + 上下文材料                                                          │
│     + LLM 配置(LLMPreset/LLMTaskPreset/LLMProfile 三级查找)              │
│         ↓                                                                │
│   LLM API 调用                                                           │
│         ↓                                                                │
│   GenerationRun 持久化 (记录输入输出)                                     │
│         ↓                                                                │
│   Chapter.content_md 更新 (replace/append)                               │
│         ↓                                                                │
│   自动更新管线 (如果 auto_update_* 启用):                                 │
│     ├── WorldbookAutoUpdateV1Request ──> 世界观百科                       │
│     ├── CharactersAutoUpdateV1Request ──> 角色                           │
│     ├── MemoryUpdateV1Request ──> 知识图谱                               │
│     └── 向量索引/搜索索引/分形记忆...                                     │
│         ↓                                                                │
│   SSE 流式返回生成文本                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 27.4 LLM 配置解析优先级

```
LLM 参数查找顺序 (高优先 -> 低优先):
┌───────────────────────────────────────────────────────────┐
│ 1. LLMTaskPreset (任务级预设)                              │
│    - 如果该任务有自定义配置，直接使用                        │
│    - source = "task_override"                              │
│                                                           │
│ 2. LLMPreset (项目级预设)                                  │
│    - 项目的默认 LLM 配置                                   │
│    - 可引用 LLMProfile                                     │
│                                                           │
│ 3. LLMProfile (用户级配置档)                               │
│    - 通过 project.llm_profile_id 引用                      │
│    - 跨项目共享                                            │
│                                                           │
│ 4. 系统默认配置                                            │
│    - 环境变量 / 配置文件                                    │
└───────────────────────────────────────────────────────────┘
```

### 27.5 自动更新数据流

```
章节内容变更（生成/手动编辑保存后）
         ↓
   自动更新调度器
         ↓
   ┌─────────────────────────────────────────────────────────┐
   │ AI 分析章节内容，输出结构化更新请求:                       │
   │                                                         │
   │ CharactersAutoUpdateV1Request                            │
   │   ops: [ {op:"upsert", name, patch, merge_mode_*} ]     │
   │         [ {op:"dedupe", canonical_name, duplicate_names}]│
   │                                                         │
   │ WorldbookAutoUpdateV1Request                             │
   │   ops: [ {op:"create", entry:{title, content_md, ...}} ]│
   │         [ {op:"update", match_title, entry:{patch}} ]    │
   │         [ {op:"merge", match_title, entry, merge_mode} ] │
   │         [ {op:"dedupe", canonical_title, duplicates} ]   │
   │                                                         │
   │ MemoryUpdateV1Request                                    │
   │   ops: [ {op:"upsert", target_table, after:{...}} ]     │
   │         [ {op:"delete", target_table, target_id} ]       │
   └─────────────────────────────────────────────────────────┘
         ↓
   服务层逐条执行操作
         ↓
   数据库更新 (Character/WorldBookEntry/Memory* 表)
```

### 27.6 Schema 与 DB Model 对应关系总览

| 功能模块 | 请求 Schema | 响应 Schema | DB Model |
|----------|-------------|-------------|----------|
| 项目 | `ProjectCreate`, `ProjectUpdate` | `ProjectOut` | `Project` |
| 项目设置 | `ProjectSettingsUpdate` | `ProjectSettingsOut` | `ProjectSettings` |
| 大纲 | `OutlineCreate`, `OutlineUpdate` | `OutlineOut`, `OutlineListItem` | `Outline` |
| 大纲生成 | `OutlineGenerateRequest` | SSE 流式 | `Outline` + `GenerationRun` |
| 章节 | `ChapterCreate`, `ChapterUpdate`, `BulkCreateRequest` | `ChapterOut`, `ChapterDetailOut`, `ChapterListItemOut`, `ChapterMetaPageOut` | `Chapter` |
| 章节生成 | `ChapterGenerateRequest` | SSE 流式 | `Chapter` + `GenerationRun` |
| 章节计划 | `ChapterPlanRequest` | SSE 流式 | `Chapter` + `GenerationRun` |
| 章节分析 | `ChapterAnalyzeRequest`, `ChapterRewriteRequest`, `ChapterAnalysisApplyRequest` | SSE 流式 / JSON | `Chapter` + `GenerationRun` |
| 角色 | `CharacterCreate`, `CharacterUpdate` | `CharacterOut` | `Character` |
| 角色自动更新 | `CharactersAutoUpdateV1Request` | JSON 结果 | `Character` |
| 世界观百科 | `WorldBookEntryCreate`, `WorldBookEntryUpdate`, `WorldBookBulkUpdateRequest`, `WorldBookBulkDeleteRequest`, `WorldBookDuplicateRequest` | `WorldBookEntryOut`, `WorldBookPreviewTriggerOut` | `WorldBookEntry` |
| 百科导入导出 | `WorldBookImportAllRequest` | `WorldBookExportAllOut` | `WorldBookEntry` |
| 百科自动更新 | `WorldbookAutoUpdateV1Request` | JSON 结果 | `WorldBookEntry` |
| 写作风格 | `WritingStyleCreateRequest`, `WritingStyleUpdateRequest` | `WritingStyleOut` | `WritingStyle` |
| 项目默认风格 | `ProjectDefaultStylePutRequest` | `ProjectDefaultStyleOut` | `ProjectDefaultStyle` |
| LLM 预设 | `LLMPresetPutRequest` | `LLMPresetOut` | `LLMPreset` (项目表) |
| LLM 配置档 | `LLMProfileCreate`, `LLMProfileUpdate` | `LLMProfileOut` | `LLMProfile` |
| LLM 任务预设 | `LLMTaskPresetPutRequest` | `LLMTaskPresetOut`, `LLMTaskCatalogItemOut` | `LLMTaskPreset` |
| LLM 测试 | `LLMTestRequest` | SSE 流式 | (无持久化) |
| 提示词预设 | `PromptPresetCreate`, `PromptPresetUpdate` | `PromptPresetOut`, `PromptPresetResourceOut` | `PromptPreset` |
| 提示词块 | `PromptBlockCreate`, `PromptBlockUpdate`, `PromptBlockReorderRequest` | `PromptBlockOut` | `PromptBlock` |
| 提示词预览 | `PromptPreviewRequest` | `PromptPreviewOut` | (无持久化) |
| 提示词导入导出 | `PromptPresetImportRequest`, `PromptPresetImportAllRequest` | `PromptPresetExportOut`, `PromptPresetExportAllOut` | `PromptPreset` + `PromptBlock` |
| 批量生成 | `BatchGenerationCreateRequest` | `BatchGenerationTaskOut`, `BatchGenerationTaskItemOut` | `BatchGenerationTask`, `BatchGenerationTaskItem` |
| 生成记录 | (无请求 Schema) | `GenerationRunOut` | `GenerationRun` |
| 记忆打包 | (无请求 Schema) | `MemoryContextPackOut` | (运行时组装) |
| 记忆预览 | `MemoryPreviewRequest` | `MemoryContextPackOut` | (运行时组装) |
| 记忆更新 | `MemoryUpdateV1Request` | JSON 结果 | `MemoryEntity`, `MemoryRelation`, `MemoryEvent`, `MemoryForeshadow`, `MemoryEvidence` |

### 27.7 Schema 交叉引用关系

```
chapter_generate.py
  ├── ChapterGenerateContext  ──(被引用)──> chapter_plan.py
  │                           ──(被引用)──> chapter_analysis.py
  │                           ──(被引用)──> batch_generation.py
  ├── PromptOverride
  ├── McpResearchConfig
  └── McpToolCall

llm.py
  └── LLMProvider ──(被引用)──> llm_preset.py
                  ──(被引用)──> llm_task_presets.py
                  ──(被引用)──> llm_test.py

base.py
  ├── ORMModel ──(被引用)──> chapters.py (ChapterOut, ChapterListItemOut)
  │            ──(被引用)──> characters.py (CharacterCreate/Update/Out)
  │            ──(被引用)──> projects.py (ProjectOut)
  │            ──(被引用)──> batch_generation.py (Task/ItemOut)
  └── RequestModel ──(被引用)──> projects.py (Create/Update)
                   ──(被引用)──> llm_profiles.py (Create/Update)
                   ──(被引用)──> writing_styles.py (Create/Update)
                   ──(被引用)──> memory_preview.py (Request)

limits.py
  └── 常量 + validate_json_chars ──(被引用)──> 几乎所有其他 Schema 文件
```

---

> 文档版本: 2026-03-24 / 基于 `backend/app/schemas/` 全部 27 个文件逐行阅读生成
