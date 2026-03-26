# 05 - 后端 LLM 集成层详解

---

## 一、LLM 客户端架构 (client.py)

文件路径: `backend/app/llm/client.py`

### 1.1 整体设计模式

采用 **参数过滤 + Provider 路由 + 延迟导入** 的设计模式。核心思路是：

1. 统一入口函数接收标准化参数。
2. 按 `provider` 字段路由到对应的适配器模块。
3. 适配器模块通过延迟导入（`from ... import ...` 在函数内部）避免循环依赖和不必要的加载。

### 1.2 参数过滤机制

`_filter_params(provider, params)` 根据 provider 类型过滤参数：

| Provider | 支持的参数 |
|---|---|
| `openai`, `openai_responses` | `temperature`, `top_p`, `max_tokens`, `presence_penalty`, `frequency_penalty`, `stop` |
| `openai_compatible`, `openai_responses_compatible` | `temperature`, `top_p`, `max_tokens`, `stop` |
| `anthropic` | `temperature`, `top_p`, `max_tokens`, `top_k`, `stop` |
| `gemini` | `temperature`, `top_p`, `max_tokens`, `top_k`, `stop` |

过滤规则：
- `None` 值直接跳过。
- 空列表的 `stop` 参数跳过。
- 不在支持列表中的参数记录到 `dropped` 列表。

返回 `(filtered_params, dropped_params)` 二元组。

### 1.3 核心 API 函数

#### call_llm() - 同步调用

```python
def call_llm(*, provider, base_url, model, api_key, system, user, params, timeout_seconds, extra=None) -> LLMCallResult
```

将 system/user 字符串转换为 `ChatMessage` 列表后委托给 `call_llm_messages()`。

#### call_llm_messages() - 同步多消息调用

```python
def call_llm_messages(*, provider, base_url, model, api_key, messages, params, timeout_seconds, extra=None) -> LLMCallResult
```

完整流程：
1. 验证 `api_key` 非空（否则抛出 `LLM_KEY_MISSING`）。
2. 规范化 `base_url`。
3. 过滤参数。
4. 创建 httpx 客户端和超时配置。
5. 按 provider 路由到对应适配器。
6. 捕获异常并附加 LLM 上下文信息。

超时配置策略：
- `read_timeout` = `max(1.0, timeout_seconds)`
- `connect_timeout` = `min(10.0, read_timeout)`
- `write_timeout` = `min(10.0, read_timeout)`
- `pool_timeout` = `min(10.0, read_timeout)`

异常处理链：
- `AppError` -> 附加 provider/model/base_url 等上下文信息后重新抛出。
- `httpx.TimeoutException` -> `LLM_TIMEOUT` (504)。
- `httpx.HTTPError` -> `LLM_UPSTREAM_ERROR` (502)。
- `json.JSONDecodeError` -> `LLM_UPSTREAM_ERROR` (502)。

#### call_llm_stream() / call_llm_stream_messages() - 流式调用

```python
def call_llm_stream(...) -> tuple[Iterator[str], LLMStreamState]
def call_llm_stream_messages(...) -> tuple[Iterator[str], LLMStreamState]
```

返回 `(文本迭代器, 流状态对象)` 二元组。流式版本的异常处理由各 provider 适配器内部的生成器处理。

### 1.4 Provider 路由表

| provider 值 | 调用的适配器函数 |
|---|---|
| `openai`, `openai_compatible` | `openai_chat.call_openai_chat_completions[_stream]` |
| `openai_responses`, `openai_responses_compatible` | `openai_responses.call_openai_responses[_stream]` |
| `anthropic` | `anthropic_messages.call_anthropic_messages[_stream]` |
| `gemini` | `gemini_generate_content.call_gemini_generate_content[_stream]` |

### 1.5 错误上下文附加

`_attach_llm_error_context(exc, *, provider, base_url, model, timeout_seconds)` 将 LLM 调用上下文注入到 `AppError.details` 中：

- `provider`: 提供商标识。
- `model`: 模型名称。
- `timeout_seconds`: 超时时长。
- `base_url_host`: base_url 的主机部分（仅提取 netloc，不包含路径）。

---

## 二、HTTP 客户端层 (http_client.py)

文件路径: `backend/app/llm/http_client.py`

### 2.1 线程安全的客户端管理

使用 `threading.local()` + `threading.Lock()` 实现线程安全的 httpx 客户端管理：

- 每个线程拥有独立的 `httpx.Client` 实例（存储在 `_local.client` 中）。
- 全局 `_clients: set[httpx.Client]` 跟踪所有已创建的客户端。
- `_lock` 保护 `_clients` 集合的并发访问。

### 2.2 get_llm_http_client()

```python
def get_llm_http_client() -> httpx.Client
```

1. 检查当前线程是否已有未关闭的客户端，有则复用。
2. 否则创建新客户端：
   - `trust_env`: 由环境变量 `LLM_HTTP_TRUST_ENV` 控制（默认 `False`）。
   - `proxy`: 由环境变量 `LLM_HTTP_PROXY` 指定代理地址。
3. 将新客户端注册到全局集合。

### 2.3 close_llm_http_client()

```python
def close_llm_http_client() -> None
```

在应用关闭时调用（由 `lifespan` 的 finally 块触发），关闭所有线程的 httpx 客户端。先在锁内复制并清空客户端集合，然后逐一关闭。

---

## 三、类型系统 (types.py)

文件路径: `backend/app/llm/types.py`

### 3.1 LLMCallResult

```python
@dataclass(frozen=True, slots=True)
class LLMCallResult:
    text: str              # 生成的文本
    latency_ms: int        # 调用延迟（毫秒）
    dropped_params: list[str]  # 被丢弃的参数列表
    finish_reason: str | None = None  # 结束原因
```

同步调用的返回值，不可变数据类。

### 3.2 LLMStreamState

```python
@dataclass(slots=True)
class LLMStreamState:
    finish_reason: str | None = None     # 流结束原因
    latency_ms: int | None = None        # 总延迟
    dropped_params: list[str] = field(default_factory=list)  # 被丢弃的参数
```

流式调用的状态跟踪对象，可变数据类。在流式迭代过程中逐步更新。

---

## 四、模型注册表 (registry.py)

文件路径: `backend/app/llm/registry.py`

### 4.1 数据结构

#### LLMPricingSpec - 定价规格

```python
@dataclass(frozen=True, slots=True)
class LLMPricingSpec:
    input_per_million: float | None = None   # 输入每百万 token 价格
    output_per_million: float | None = None  # 输出每百万 token 价格
    currency: str = "USD"                    # 货币
    source: str = "pending_verification"     # 定价来源
```

#### LLMCapabilitySpec - 能力规格

```python
@dataclass(frozen=True, slots=True)
class LLMCapabilitySpec:
    max_output_tokens: int | None = None      # 最大输出 token 数
    max_context_tokens: int | None = None     # 最大上下文 token 数
    streaming: bool = True                     # 是否支持流式
    supports_json_mode: bool | None = None     # JSON 模式支持
    supports_tool_calling: bool | None = None  # 工具调用支持
    supports_vision: bool | None = None        # 视觉支持
```

#### LLMProviderContract - 提供商合约

```python
@dataclass(frozen=True, slots=True)
class LLMProviderContract:
    key: str                         # 唯一标识
    default_base_url: str | None     # 默认 API 地址
    requires_base_url: bool          # 是否强制要求 base_url
    allows_unknown_models: bool      # 是否允许未注册模型
    recommended_max_tokens: int      # 推荐最大 token 数
    supported_params: frozenset[str] # 支持的参数集合
    aliases: frozenset[str] = frozenset()  # 别名
```

#### LLMModelContract - 模型合约

```python
@dataclass(frozen=True, slots=True)
class LLMModelContract:
    provider: str
    model: str
    capabilities: LLMCapabilitySpec
    pricing: LLMPricingSpec | None = None
    aliases: frozenset[str] = frozenset()          # 精确别名
    prefix_aliases: frozenset[str] = frozenset()   # 前缀别名（匹配 `prefix-*`）
```

#### LLMContractResolution - 解析结果

```python
@dataclass(frozen=True, slots=True)
class LLMContractResolution:
    provider: str
    model: str
    model_key: str                                   # "provider::model"
    provider_contract: LLMProviderContract
    model_contract: LLMModelContract | None
    compatibility_alias: str | None = None           # 匹配的别名
    notes: tuple[str, ...] = ()                      # 解析备注
```

### 4.2 注册的提供商

| key | 默认 base_url | 要求 base_url | 允许未知模型 | 推荐 max_tokens | 别名 |
|---|---|---|---|---|---|
| `openai` | `https://api.openai.com/v1` | 否 | 否 | 12000 | `openai-chat` |
| `openai_responses` | `https://api.openai.com/v1` | 否 | 否 | 12000 | `openai-responses` |
| `openai_compatible` | 无 | 是 | 是 | 12000 | `openai_compat`, `openai-compatible` |
| `openai_responses_compatible` | 无 | 是 | 是 | 12000 | `openai_responses_compat`, `openai-responses-compatible` |
| `anthropic` | `https://api.anthropic.com` | 否 | 否 | 8192 | 无 |
| `gemini` | `https://generativelanguage.googleapis.com` | 否 | 否 | 8192 | `google` |

### 4.3 注册的模型

#### OpenAI Chat

| 模型 | 别名 | max_output | max_context | 特殊能力 |
|---|---|---|---|---|
| `gpt-4o-mini` | `gpt-4o-mini-2024-07-18` | 16384 | 128000 | JSON, 工具调用, 视觉 |
| `gpt-4o` | `gpt-4o-2024-08-06` | 16384 | 128000 | JSON, 工具调用, 视觉 |
| `gpt-4.1-mini` | `gpt-4.1-mini-2025-04-14` | - | - | JSON, 工具调用 |
| `gpt-4.1` | `gpt-4.1-2025-04-14` | - | - | JSON, 工具调用 |
| `gpt-4` | 前缀 `gpt-4` | 8192 | 8192 | JSON |

#### OpenAI Responses

与 OpenAI Chat 相同的模型列表（`gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`, `gpt-4`），注册在 `openai_responses` provider 下。

#### Anthropic

| 模型 | 别名 | 特殊能力 |
|---|---|---|
| `claude-3-7-sonnet-20250219` | `claude-3-7-sonnet`, `claude-3-7-sonnet-latest` | JSON, 工具调用 |

#### Gemini

| 模型 | 别名 | 特殊能力 |
|---|---|---|
| `gemini-2.0-flash` | `gemini-2.0-flash-exp` | JSON, 工具调用, 视觉 |
| `gemini-1.5-pro` | 前缀 `gemini-1.5-pro` | JSON, 工具调用, 视觉 |
| `gemini-1.5-flash` | 前缀 `gemini-1.5-flash` | JSON, 工具调用, 视觉 |

### 4.4 模型解析流程

`resolve_llm_contract(provider, model, *, mode)` 的解析优先级：

1. **精确匹配** - `model == contract.model`。
2. **别名匹配** - `model in contract.aliases`，标注 `compatibility_alias` 和 `notes=("compatibility_alias",)`。
3. **前缀匹配** - `model.startswith(prefix + "-")`，标注 `notes=("prefix_alias",)`。
4. **未注册模型** - 如果 provider 允许未知模型（`allows_unknown_models=True`），返回 `model_contract=None`，标注 `gateway_passthrough`。否则在 `enforce` 模式下抛出 `unsupported_model` 错误，`audit` 模式标注 `unregistered_model`。

### 4.5 Base URL 解析

`resolve_base_url(provider, base_url, *, mode)`:
1. 用户提供了 base_url -> 规范化后返回。
2. provider 有默认 base_url -> 使用默认值。
3. `enforce` 模式 -> 抛出 `base_url_required` 错误。
4. `audit` 模式 -> 返回 `base_url=None`，标注 `missing_base_url`。

### 4.6 辅助查询函数

| 函数 | 说明 |
|---|---|
| `normalize_provider(provider)` | 规范化 provider 名，支持别名映射 |
| `provider_contract(provider)` | 获取 provider 合约对象 |
| `canonical_model_key(provider, model)` | 获取规范模型键 `"provider::model"` |
| `max_output_tokens_limit(provider, model)` | 查询最大输出 token 限制 |
| `max_context_tokens_limit(provider, model)` | 查询最大上下文 token 限制 |
| `recommended_max_tokens(provider, model)` | 获取推荐 max_tokens |
| `pricing_contract(provider, model)` | 获取定价合约 |
| `supported_params(provider)` | 获取支持的参数集合 |

---

## 五、能力检测 (capabilities.py)

文件路径: `backend/app/llm/capabilities.py`

### 5.1 ModelTokenCaps

```python
@dataclass(frozen=True, slots=True)
class ModelTokenCaps:
    max_output_tokens: int | None
    max_context_tokens: int | None
```

### 5.2 API 函数

| 函数 | 说明 |
|---|---|
| `get_model_token_caps(provider, model)` | 获取模型的 token 上限，两者都为 None 时返回 None |
| `max_output_tokens_limit(provider, model)` | 获取最大输出 token 限制 |
| `max_context_tokens_limit(provider, model)` | 获取最大上下文 token 限制 |
| `recommended_max_tokens(provider, model)` | 获取推荐 max_tokens，异常时返回默认值 8192 |

所有函数都使用 `mode="audit"` 模式查询注册表，不会因未注册模型而抛出异常。

---

## 六、消息构建系统

### 6.1 消息基础 (messages.py)

文件路径: `backend/app/llm/messages.py`

#### ChatMessage 数据类

```python
@dataclass(frozen=True, slots=True)
class ChatMessage:
    role: str          # system / user / assistant / tool
    content: str
    name: str | None = None
```

#### normalize_role(role)

角色规范化：
- `"model"` -> `"assistant"`（Gemini 兼容）。
- 在 `{system, user, assistant, tool}` 中的保留。
- 其他一律归为 `"user"`。

#### merge_consecutive(messages)

合并连续相同角色和名称的消息，用 `\n\n` 连接内容。跳过空内容消息。

#### coalesce_system(messages)

将所有 system 消息提取并合并为单一字符串，返回 `(system_text, non_system_messages)` 二元组。

#### flatten_messages(messages)

将消息列表扁平化为纯文本：
- `user` 角色直接使用内容。
- 其他角色加 `[ROLE]` 前缀。

### 6.2 OpenAI 消息格式 (openai_messages.py)

文件路径: `backend/app/llm/openai_messages.py`

#### openai_messages_from_list(*, messages, merge_system_into_user)

两种模式：

**merge_system_into_user=True**: 将所有消息（含 system）合并为单条 user 消息。适用于不支持 system role 的模型/网关。

**merge_system_into_user=False**: 标准 OpenAI 格式：
- system 消息合并为一条放在最前。
- 非 system 消息保持原角色和名称。
- 空列表时补一个空 user 消息。

### 6.3 OpenAI 响应提取 (openai_extract.py)

文件路径: `backend/app/llm/openai_extract.py`

#### extract_openai_like_text(data)

从多种响应格式中提取文本，按优先级尝试：

1. `choices[0].message.content`（标准 Chat Completions）。
2. `choices[0].message.content` 为列表时，提取每个 `text` 部分。
3. `choices[0].text`（旧式 Completions）。
4. `choices[0].delta.content`（流式 chunk 的首次 delta）。
5. `output[].content[].text`（Responses API 格式）。
6. `output_text`（Responses API 快捷字段）。
7. `content`（直接文本）。

#### extract_openai_finish_reason(data)

提取 `choices[0].finish_reason` 或顶层 `finish_reason`。

#### extract_openai_stream_delta_text(data)

流式增量文本提取：
1. `type == "response.output_text.delta"` 时提取 `delta`（Responses SSE）。
2. `choices[0].delta.content`（Chat Completions SSE）。
3. `choices[0].delta.content` 为列表时提取 `text` 部分。
4. `choices[0].text`。

---

## 七、Token 计算 (max_tokens.py)

文件路径: `backend/app/llm/max_tokens.py`

### 7.1 功能

`extract_max_tokens_upper_bound(text)` 从上游错误消息中提取 max_tokens 上限值。

### 7.2 匹配模式

使用 8 个正则表达式匹配各种格式的 max_tokens 限制信息：

- `max_tokens > <limit>`
- `max_tokens <= <limit>` / `max_tokens must be <= <limit>`
- `max_completion_tokens > <limit>` / `<= <limit>`
- `maxCompletionTokens <= <limit>`
- `max_output_tokens > <limit>` / `<= <limit>`
- `maxOutputTokens <= <limit>`

### 7.3 处理流程

1. 尝试将输入解析为 JSON，递归提取所有字符串值。
2. 对每个候选字符串，依次用正则匹配。
3. 返回第一个匹配到的正整数值，或 `None`。

---

## 八、审计系统 (audit.py)

文件路径: `backend/app/llm/audit.py`

### 8.1 数据结构

#### LLMContractFinding

```python
@dataclass(frozen=True, slots=True)
class LLMContractFinding:
    severity: str        # "error" 或 "warning"
    source: str          # 来源标识
    provider: str | None
    model: str | None
    message: str         # 发现描述
    model_key: str | None = None
```

#### LLMContractAuditReport

```python
@dataclass(frozen=True, slots=True)
class LLMContractAuditReport:
    findings: tuple[LLMContractFinding, ...]
```

属性: `error_count`、`warning_count`。

### 8.2 审计功能

#### audit_registry()

审计注册表本身的一致性：
- 检查 provider 别名是否重复。
- 检查 model key 是否重复。
- 检查 model 是否缺少定价合约。
- 检查 provider 别名是否与规范 key 冲突。

#### audit_rows(rows, *, mode)

审计一组 LLM 配置行：
- 检查 provider/model 是否缺失。
- 解析 LLM 合约，检查别名映射、未注册模型、base_url 缺失等。
- 检查定价合约是否存在。

#### audit_session(db, *, mode)

从数据库中加载所有 LLM 配置（`LLMProfile`、`LLMPreset`、`LLMTaskPreset`），执行完整审计。

#### audit_database_url(database_url, *, mode)

创建独立数据库连接执行审计，适用于 CLI 工具。

---

## 九、敏感信息脱敏 (redaction.py)

文件路径: `backend/app/llm/redaction.py`

### 9.1 脱敏规则

| 正则 | 目标 | 脱敏结果 |
|---|---|---|
| `_KEY_QS_RE` | URL 查询参数 `?key=xxx` / `&key=xxx` | `?key=***` |
| `_ANTHROPIC_KEY_RE` | `sk-ant-` 开头的 Anthropic Key | `sk-ant-***` |
| `_OPENAI_KEY_RE` | `sk-` 开头的 OpenAI Key | `sk-***` |
| `_GOOGLE_KEY_RE` | `AIza` 开头的 Google Key | `AIza***` |
| `_BEARER_TOKEN_RE` | Bearer 令牌 | `bearer ***` |
| `_X_LLM_API_KEY_RE` | `x-llm-api-key` 头部值 | `x-llm-api-key: ***` |

注意：仅脱敏 URL 查询参数中的 `key=`，不会误伤 prompt 内容中出现的 `key=mc_level` 等业务字段。

### 9.2 redact_text(text)

对输入文本依次应用所有脱敏规则，返回脱敏后的文本。用于日志输出和错误详情中的上游响应体处理。

---

## 十、上游错误处理 (upstream_errors.py)

文件路径: `backend/app/llm/upstream_errors.py`

### 10.1 map_upstream_error()

```python
def map_upstream_error(status_code, upstream_text=None, extra_details=None) -> AppError
```

将上游 HTTP 状态码映射为标准化的 `AppError`：

| 上游状态码 | AppError code | 客户端状态码 | 消息 |
|---|---|---|---|
| 401, 403 | `LLM_AUTH_ERROR` | 401 | "API Key 无效或已过期，请检查后重试" |
| 429 | `LLM_RATE_LIMIT` | 429 | "请求过多/额度不足，请稍后重试" |
| 400, 422 | `LLM_BAD_REQUEST` | 400 | "请求参数有误，可能是模型名称或参数不支持" |
| 408, 504 | `LLM_TIMEOUT` | 504 | "请求超时，请稍后重试" |
| 其他 | `LLM_UPSTREAM_ERROR` | 502 | "模型服务异常，请稍后重试" |

在 dev 环境下，`upstream_text` 会被截断到 500 字符并附加到 details 中。

---

## 十一、LLM 工具函数 (utils.py)

文件路径: `backend/app/llm/utils.py`

### 11.1 normalize_base_url(value)

规范化 base_url：
- 去除首尾空格和末尾 `/`。
- 验证 scheme 必须是 `http` 或 `https`。
- 验证 netloc 非空。
- 无效时抛出 `AppError(code="LLM_CONFIG_ERROR")`。

### 11.2 Token 相关工具

| 函数 | 说明 |
|---|---|
| `default_max_tokens_for_provider(provider)` | 获取 provider 的推荐 max_tokens |
| `default_max_tokens(provider, model)` | 获取 provider+model 的推荐 max_tokens |
| `is_default_like_max_tokens(provider, value)` | 判断 value 是否是该 provider 的典型默认值 |

`is_default_like_max_tokens` 的判断逻辑：
- OpenAI 系列: 值为 32000 或 8192。
- Anthropic/Gemini: 值为 8192。

---

## 十二、提供商适配器详解

### 12.1 OpenAI Chat 适配器 (providers/openai_chat.py)

文件路径: `backend/app/llm/providers/openai_chat.py`

#### 请求构建

**端点选择**: 首先尝试 `{base_url}/chat/completions`，如果返回 404 且 base_url 不以 `/v1` 结尾，自动追加 `/v1/chat/completions` 重试。

**请求头**:
```
Authorization: Bearer {api_key}
Content-Type: application/json
Accept: application/json [或 text/event-stream]
```
对 `_compatible` provider，额外添加 `x-api-key: {api_key}`。

**Payload 构建**:
```json
{
  "model": "...",
  "messages": [...],  // openai_messages_from_list 构建
  "temperature": ...,
  "top_p": ...,
  "max_tokens": ...,
  // extra 参数:
  "response_format": {...},
  "reasoning_effort": "...",
  "seed": 123,
  "logit_bias": {...},
  "max_completion_tokens": 123  // 设置时移除 max_tokens
}
```

#### 兼容性降级机制

当上游返回 400/422 时，系统执行一系列自动降级步骤：

1. **max_tokens 上限提取** - 从错误消息中正则提取上限值，clamp 到该值。
2. **逐步降级序列**（`_build_openai_compat_downgrade_steps`）：
   - 移除 `response_format`
   - 移除 `reasoning_effort`
   - 移除 `seed`
   - 移除 `logit_bias`
   - 移除 `stop`
   - 移除 `top_p`
   - 移除 `temperature`
   - 将 `max_tokens` 转为 `max_completion_tokens`
   - clamp max_tokens 到 16384 -> 8192 -> 4096 -> 1024
   - 移除 `max_tokens` / `max_completion_tokens`
   - 将 system 消息合并到 user 消息中

每次降级后重新发送请求，直到成功或所有降级步骤用尽。

3. **Responses API 回退** - 如果错误消息包含 "unsupported parameter: messages"，自动切换到 OpenAI Responses API 重试。

#### 响应解析

使用 `extract_openai_like_text()` 提取文本，`extract_openai_finish_reason()` 提取结束原因。

在 dev 环境下，如果无法解析文本，将脱敏后的上游响应体（截断 500 字符）附加到错误详情中。

#### 流式处理

流式版本 `call_openai_chat_completions_stream` 的特殊处理：

1. 使用 `httpx.Client.stream()` 打开 SSE 流。
2. 逐行解析 `data:` 前缀的 SSE 行。
3. `data: [DONE]` 标记流结束。
4. 通过 `extract_openai_stream_delta_text()` 提取增量文本。
5. 同样支持 404 端点切换、400/422 降级序列、Responses API 回退。
6. 在 `finally` 中记录延迟和合并被丢弃的参数。

### 12.2 OpenAI Responses 适配器 (providers/openai_responses.py)

文件路径: `backend/app/llm/providers/openai_responses.py`

#### 请求构建

**端点**: `{base_url}/responses`，404 时追加 `/v1/responses`。

**输入构建**:
- 默认将消息扁平化为纯文本 `input`，system 消息放入 `instructions`。
- 降级时可切换为结构化 message 列表格式。

**Payload**:
```json
{
  "model": "...",
  "input": "...",
  "instructions": "...",
  "max_output_tokens": ...,
  "temperature": ...,
  "top_p": ...,
  "stop": [...],
  "presence_penalty": ...,
  "frequency_penalty": ...,
  "stream": true/false,
  "seed": 123,
  "reasoning": {"effort": "..."},
  "text": {"format": {...}, "verbosity": "..."}
}
```

#### text 配置转换

`_coerce_text_config(extra)` 支持多种输入格式：
- 直接 `text` 字典透传。
- `text_format` 字典包装为 `{"format": ...}`。
- Chat Completions 的 `response_format`（`json_schema` 类型）转换为 Responses 的 text format。
- `text_verbosity` / `verbosity` 设置。

#### reasoning 配置转换

`_coerce_reasoning_config(extra)` 支持：
- 直接 `reasoning` 字典透传。
- `reasoning_effort` 字符串包装为 `{"effort": "..."}`。

#### 兼容性降级

`_build_openai_responses_compat_steps` 降级序列：

1. 切换输入为 message 列表格式（`switch_to_message_input`）
2. 移除 `stop`, `top_p`, `temperature`, `presence_penalty`, `frequency_penalty`, `seed`, `reasoning`
3. 移除 `text`（格式配置）
4. 将 `instructions` 合并到 `input` 中
5. clamp max_output_tokens 到 16384 -> 8192 -> 4096 -> 1024
6. 将 `max_output_tokens` 转为 `max_tokens`（兼容某些网关）
7. 移除 `max_output_tokens` / `max_tokens`

#### 特殊回退

1. **流式回退** - 如果非流式请求返回 "stream must be set to true" 或 "input must be a list" 错误，自动切换到流式模式收集完整响应。
2. **Chat API 回退** - 对 `_compatible` provider，如果 Responses API 返回 400/404/405/422，自动回退到 `call_openai_chat_completions`。
3. **反向回退保护** - 通过 `_internal_from_chat_fallback` 和 `_internal_from_responses_fallback` 标记防止无限回退循环。

#### 流式事件处理

| SSE 事件类型 | 处理方式 |
|---|---|
| `response.output_text.delta` | 提取 `data.delta` 作为增量文本 yield |
| `response.completed` | 提取 `response.status` 作为 finish_reason |
| `response.failed` | 设置 `finish_reason = "failed"` |
| `error` | 提取错误消息抛出 `AppError` |

### 12.3 Anthropic Messages 适配器 (providers/anthropic_messages.py)

文件路径: `backend/app/llm/providers/anthropic_messages.py`

#### 请求构建

**端点**: `{base_url}/v1/messages`

**请求头**:
```
x-api-key: {api_key}
anthropic-version: 2023-06-01  (可通过 extra 覆盖)
Content-Type: application/json
Accept: application/json [或 text/event-stream]
anthropic-beta: ...  (可选，支持字符串或列表)
```

**消息转换规则**:
1. 合并连续消息，提取 system 消息。
2. 非 user/assistant 角色的消息强制转为 user，并加 `[ROLE]` 前缀。
3. 消息列表不能为空，补空 user 消息。
4. 第一条消息必须是 user 角色，否则在前面插入空 user 消息。

**Payload**:
```json
{
  "model": "...",
  "max_tokens": 1500,  // 默认值
  "temperature": ...,
  "top_p": ...,
  "top_k": ...,
  "stop_sequences": [...],
  "system": "...",
  "messages": [...],
  "thinking": {...}  // 可选 thinking 模式
}
```

#### 兼容性降级

降级步骤：
1. 从错误消息提取 max_tokens 上限并 clamp。
2. clamp max_tokens 到 16384 -> 8192 -> 4096 -> 1024。
3. 移除 `thinking`。
4. 移除 `stop_sequences`。
5. 移除 `top_k`。
6. 移除 `top_p`。
7. 移除 `temperature`。

#### 响应解析

- `content` 为字符串时直接使用。
- `content` 为列表时，提取每个 `text` 类型块的文本并拼接。
- `stop_reason` 作为 finish_reason。

#### 流式事件处理

| SSE 事件类型 | 处理方式 |
|---|---|
| `content_block_delta` | 提取 `delta.text`（type=`text_delta`），yield 增量文本 |
| `message_delta` | 提取 `delta.stop_reason` 更新 finish_reason |
| `message_stop` | 流结束 |
| `error` | 提取错误消息抛出 `AppError` |

### 12.4 Gemini 适配器 (providers/gemini_generate_content.py)

文件路径: `backend/app/llm/providers/gemini_generate_content.py`

#### 请求构建

**端点**:
- 非流式: `{base_url}/v1beta/models/{model}:generateContent`
- 流式: `{base_url}/v1beta/models/{model}:streamGenerateContent?alt=sse`

**请求头**:
```
Content-Type: application/json
Accept: application/json [或 text/event-stream]
x-goog-api-key: {api_key}
```

注意 Gemini 使用 `x-goog-api-key` 头部传递 API Key，而非 Authorization Bearer。

**消息转换规则**:
1. 合并连续消息，提取 system 消息。
2. `assistant` 角色映射为 Gemini 的 `model` 角色。
3. 非 user/assistant 角色强制转为 `user`，加 `[ROLE]` 前缀。
4. 内容包装为 `parts: [{text: "..."}]` 格式。
5. system 消息放入 `systemInstruction` 顶层字段。

**generationConfig 映射**:

| 通用参数 | Gemini 参数 |
|---|---|
| `temperature` | `temperature` |
| `top_p` | `topP` |
| `max_tokens` | `maxOutputTokens` |
| `top_k` | `topK` |
| `stop` | `stopSequences` |

额外支持 `thinkingConfig` 参数（Gemini 特有）。

**安全设置**: 通过 extra 的 `safety_settings` / `safetySettings` 透传。

#### 兼容性降级

降级步骤：
1. 从错误消息提取 maxOutputTokens 上限并 clamp。
2. clamp maxOutputTokens 到 8192 -> 4096 -> 1024。
3. 移除 `thinkingConfig`。
4. 移除 `stopSequences`。
5. 移除 `topK`。
6. 移除 `topP`。
7. 移除 `temperature`。

#### 响应解析

从 `candidates[0].content.parts[].text` 提取文本并拼接。`finishReason` 作为 finish_reason。

#### 流式处理特殊逻辑

Gemini 流式响应可能发送**累积文本**而非增量文本。适配器通过维护 `full_text` 变量检测并计算增量：

```python
if chunk_text.startswith(full_text):
    delta = chunk_text[len(full_text):]
    full_text = chunk_text
else:
    delta = chunk_text
    full_text += chunk_text
```

- 如果新 chunk 是 full_text 的扩展，则只 yield 新增部分。
- 否则作为独立增量拼接。

---

## 十三、全适配器通用模式总结

### 13.1 兼容性降级框架

所有适配器共享相似的降级框架：

1. 首次发送请求。
2. 如果返回 400/422，尝试从错误消息中提取 max_tokens 上限。
3. 执行预定义的降级步骤列表，每步修改 payload 后重试。
4. 每步通过返回值 `bool` 指示是否做了实际修改。
5. 降级记录保存在 `compat_adjustments` 和 `compat_dropped_params` 列表中。

### 13.2 流式处理框架

所有流式适配器共享相似的生成器模式：

1. 使用 `httpx.Client.stream()` 打开 HTTP 流。
2. 响应状态码非 2xx 时，读取错误体，尝试降级/回退。
3. 成功后逐行解析 SSE（`data:` 前缀）。
4. 在 `finally` 块中更新 `LLMStreamState` 和关闭流连接。
5. 异常统一映射为 `AppError`。

### 13.3 错误处理一致性

所有适配器使用统一的错误处理：
- `httpx.TimeoutException` -> `LLM_TIMEOUT` (504)
- `httpx.HTTPError` -> `LLM_UPSTREAM_ERROR` (502)
- 上游 HTTP 错误 -> `map_upstream_error()` 统一映射
- 响应解析失败 -> `LLM_UPSTREAM_ERROR` (502)，dev 环境附加脱敏后的上游响应
