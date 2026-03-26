# 03 - 后端 API 路由完整文档

## 一、路由注册机制

### 1.1 总入口 (`backend/app/api/router.py`)

所有 API 路由统一注册在 `api_router` 上，前缀为 `/api`。每个功能模块对应一个独立的路由文件，通过 `include_router` 挂载并指定 `tags` 标签。

```
api_router = APIRouter(prefix="/api")
```

路由注册顺序（按 `router.py` 中声明顺序）：

| 序号 | 模块 | 标签 | 说明 |
|------|------|------|------|
| 1 | health | health | 健康检查 |
| 2 | auth | auth | 认证/用户管理 |
| 3 | projects | projects | 项目管理 |
| 4 | memory | memory | 记忆系统 |
| 5 | tasks | tasks | 任务队列 |
| 6 | mcp | mcp | MCP 工具调用 |
| 7 | glossary | glossary | 术语表 |
| 8 | search | search | 全文搜索 |
| 9 | tables | tables | 数值表格 |
| 10 | vector | vector | 向量 RAG |
| 11 | graph | graph | 知识图谱 |
| 12 | fractal | fractal | 分形记忆 |
| 13 | settings | settings | 项目设置 |
| 14 | characters | characters | 角色卡 |
| 15 | outline | outline | 大纲（单大纲） |
| 16 | chapters | chapters | 章节 |
| 17 | chapter_analysis | chapter_analysis | 章节分析/改写 |
| 18 | batch_generation | batch_generation | 批量生成 |
| 19 | prompts | prompts | 提示词预设 |
| 20 | llm_preset | llm_preset | LLM 参数预设 |
| 21 | llm_task_presets | llm_task_presets | LLM 任务预设 |
| 22 | llm_capabilities | llm_capabilities | LLM 能力查询 |
| 23 | llm_models | llm_models | LLM 模型列表 |
| 24 | llm | llm | LLM 测试 |
| 25 | llm_profiles | llm_profiles | LLM 配置文件 |
| 26 | outlines | outlines | 大纲（多大纲 CRUD） |
| 27 | export | export | 导出 |
| 28 | import_export | import_export | 导入/导出 |
| 29 | generation_runs | generation_runs | 生成记录 |
| 30 | worldbook | worldbook | 世界书 |
| 31 | story_memory | story_memory | 故事记忆 |
| 32 | writing_styles | writing_styles | 写作风格 |

### 1.2 `__init__.py`

空文件，仅作为 Python 包标识。

---

## 二、依赖注入系统 (`backend/app/api/deps.py`)

### 2.1 核心类型别名

| 依赖别名 | 类型 | 说明 |
|----------|------|------|
| `DbDep` | `Annotated[Session, Depends(get_db)]` | SQLAlchemy 数据库会话 |
| `UserIdDep` | `Annotated[str, Depends(get_current_user_id)]` | 当前用户 ID（从 `request.state.user_id` 获取） |
| `AuthenticatedUserIdDep` | `Annotated[str, Depends(get_authenticated_user_id)]` | 已认证用户 ID（从 `request.state.authenticated_user_id` 获取） |

**区别**：`UserIdDep` 用于一般路由（可能包含本地用户），`AuthenticatedUserIdDep` 用于需要严格认证的路由（如认证相关端点）。

### 2.2 角色权限体系

项目角色分三级（从低到高）：`viewer` < `editor` < `owner`。

| 函数 | 最低角色 | 说明 |
|------|----------|------|
| `require_project_viewer` | viewer | 查看权限 |
| `require_project_editor` | editor | 编辑权限 |
| `require_project_owner` | owner | 所有者权限 |

角色判定逻辑：
1. 如果 `project.owner_user_id == user_id`，角色为 `owner`
2. 否则查找 `ProjectMembership` 表，获取角色
3. 角色不存在或不匹配时返回 `404`（防止泄露资源存在），角色不足时返回 `403`

### 2.3 资源访问控制函数

| 函数 | 资源类型 | 说明 |
|------|----------|------|
| `require_character_viewer/editor` | Character | 通过角色检查项目权限 |
| `require_chapter_viewer/editor` | Chapter | 通过角色检查项目权限 |
| `require_outline_viewer/editor` | Outline | 通过角色检查项目权限 |
| `require_owned_llm_profile` | LLMProfile | 必须是配置文件所有者 |
| `require_generation_run_viewer/editor` | GenerationRun | 通过角色检查项目权限 |
| `require_worldbook_entry_viewer/editor` | WorldBookEntry | 通过角色检查项目权限 |

### 2.4 向后兼容别名

`require_owned_project` / `require_owned_character` / `require_owned_chapter` / `require_owned_outline` / `require_owned_generation_run` / `require_owned_worldbook_entry` 均为向后兼容包装器，内部转发到对应的 editor 权限函数。

---

## 三、按功能模块分类的 API 端点

### 3.1 健康检查 (`health.py`)

| 方法 | 路径 | 功能 | 认证 | 请求参数 | 响应 |
|------|------|------|------|----------|------|
| GET | `/api/health` | 健康检查 | 无 | 无 | `{status, version, ...queue_status}` |

**实现逻辑**：返回应用版本号和任务队列状态。

---

### 3.2 认证与用户管理 (`auth.py`)

#### 3.2.1 通用认证端点

| 方法 | 路径 | 功能 | 认证 | 请求体/参数 | 响应 |
|------|------|------|------|-------------|------|
| GET | `/api/auth/user` | 获取当前用户信息 | AuthenticatedUserIdDep | 无 | `{user: {id, display_name, is_admin}, session: {expire_at}}` |
| GET | `/api/auth/providers` | 获取可用认证方式 | 无 | 无 | `{local: {enabled}, linuxdo: {enabled}}` |
| POST | `/api/auth/refresh` | 刷新会话 | AuthenticatedUserIdDep | 无 | `{refreshed, session: {expire_at}}` |
| POST | `/api/auth/logout` | 登出 | 无 | 无 | `{}` |

#### 3.2.2 本地认证

| 方法 | 路径 | 功能 | 认证 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| POST | `/api/auth/local/login` | 本地登录 | 无 | `{user_id, password}` | `{user, session}` + Set-Cookie |
| POST | `/api/auth/local/register` | 本地注册 | 无 | `{user_id, password, display_name?, email?}` | `{user, session}` + Set-Cookie |
| POST | `/api/auth/password/change` | 修改密码 | AuthenticatedUserIdDep | `{old_password, new_password}` | `{}` |

**关键逻辑**：
- 登录/注册成功后通过 Cookie 设置 Session
- 管理员保留用户名不可注册
- 密码使用 `hash_password` 加密存储

#### 3.2.3 LinuxDo OIDC 认证

| 方法 | 路径 | 功能 | 认证 | 请求参数 | 响应 |
|------|------|------|------|----------|------|
| GET | `/api/auth/oidc/linuxdo/start` | 发起 OIDC 登录 | 无 | `next?` | 302 重定向到 LinuxDo |
| GET | `/api/auth/oidc/linuxdo/callback` | OIDC 回调 | 无 | `code, state` | 302 重定向 + Set-Cookie |

**关键逻辑**：
- 使用 PKCE (S256) 安全流程
- 支持自动创建用户和关联外部账号
- 处理并发注册冲突（最多重试 3 次）

#### 3.2.4 管理员端点

| 方法 | 路径 | 功能 | 认证 | 请求体/参数 | 响应 |
|------|------|------|------|-------------|------|
| GET | `/api/auth/admin/users` | 列出所有用户 | Admin | `limit, cursor, q?, online_only?` | `{users, pagination, summary}` |
| POST | `/api/auth/admin/users` | 创建用户 | Admin | `{user_id, display_name?, email?, is_admin?, password?}` | `{user, temp_password?}` |
| POST | `/api/auth/admin/users/{target_user_id}/disable` | 禁用/启用用户 | Admin | `{disabled}` | `{}` |
| POST | `/api/auth/admin/users/{target_user_id}/password/reset` | 重置密码 | Admin | `{new_password?}` | `{temp_password}` |

**关键逻辑**：
- 用户列表支持游标分页、搜索、在线过滤
- 返回用户活动统计（最后活跃时间、使用统计等）
- 不提供密码时自动生成临时密码

---

### 3.3 项目管理 (`projects.py`)

#### 3.3.1 项目 CRUD

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| GET | `/api/projects` | 项目列表 | UserIdDep | 无 | `{projects: [...]}` |
| GET | `/api/projects/summary` | 项目摘要列表 | UserIdDep | 无 | `{items: [...]}` |
| POST | `/api/projects` | 创建项目 | UserIdDep | `{name, genre?, logline?}` | `{project}` |
| GET | `/api/projects/{project_id}` | 获取项目 | viewer | 无 | `{project}` |
| PUT | `/api/projects/{project_id}` | 更新项目 | owner | `{name?, genre?, logline?, active_outline_id?, llm_profile_id?}` | `{project}` |
| DELETE | `/api/projects/{project_id}` | 删除项目 | owner | 无 | `{}` |
| POST | `/api/projects/import_bundle` | 导入项目包 | UserIdDep | `{bundle, rebuild_vectors?}` | `{result}` |

**关键逻辑**：
- 项目列表返回用户拥有的和被邀请加入的项目
- 摘要列表包含角色数、章节统计、大纲预览等聚合信息
- 创建项目时自动创建默认提示词预设、知识库和数值表
- 更新项目可关联 LLM Profile，并同步 LLM Preset
- 删除项目时清除向量索引

#### 3.3.2 项目成员管理

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| GET | `/api/projects/{project_id}/memberships` | 成员列表 | owner | 无 | `{memberships: [...]}` |
| POST | `/api/projects/{project_id}/memberships` | 添加成员 | owner | `{user_id, role}` | `{membership}` |
| PUT | `/api/projects/{project_id}/memberships/{target_user_id}` | 更新成员角色 | owner | `{role}` | `{membership}` |
| DELETE | `/api/projects/{project_id}/memberships/{target_user_id}` | 移除成员 | owner | 无 | `{}` |

**关键逻辑**：
- 角色限 `viewer` 或 `editor`
- 不可修改/移除 owner 的 membership

---

### 3.4 章节管理 (`chapters.py`)

#### 3.4.1 章节 CRUD

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| GET | `/api/projects/{project_id}/chapters/meta` | 章节元数据分页 | viewer | `outline_id?, cursor?, limit?` | `{chapters, next_cursor, has_more, returned, total}` |
| GET | `/api/projects/{project_id}/chapters` | 章节完整列表 | viewer | `outline_id?` | `{chapters}` |
| POST | `/api/projects/{project_id}/chapters` | 创建章节 | editor | `{number, title, plan?, status?}`, `outline_id?` | `{chapter}` |
| POST | `/api/projects/{project_id}/chapters/bulk_create` | 批量创建章节 | editor | `{chapters: [...]}`, `replace?, outline_id?` | `{chapters}` |
| GET | `/api/chapters/{chapter_id}` | 获取章节详情 | viewer | 无 | `{chapter}` |
| PUT | `/api/chapters/{chapter_id}` | 更新章节 | editor | `{title?, plan?, content_md?, summary?, status?}` | `{chapter}` |
| DELETE | `/api/chapters/{chapter_id}` | 删除章节 | editor | 无 | `{}` |

**关键逻辑**：
- 章节绑定到大纲（outline_id），默认使用项目活跃大纲
- 章节号不可重复（IntegrityError -> 409）
- 批量创建支持 `replace` 模式（先删除现有章节再创建）
- 状态变为 `done` 时触发自动更新任务链
- 每次修改标记向量索引为 dirty 并调度重建

#### 3.4.2 章节生成与规划

| 方法 | 路径 | 功能 | 认证/权限 | 请求头 | 请求体 | 响应 |
|------|------|------|-----------|--------|--------|------|
| POST | `/api/chapters/{chapter_id}/plan` | 生成章节计划 | UserIdDep | X-LLM-Provider?, X-LLM-API-Key? | ChapterPlanRequest | `{plan, ...}` |
| POST | `/api/chapters/{chapter_id}/generate-precheck` | 生成预检查 | UserIdDep | X-LLM-Provider?, X-LLM-API-Key? | ChapterGenerateRequest | 预检查结果 |
| POST | `/api/chapters/{chapter_id}/generate` | 生成章节内容 | UserIdDep | X-LLM-Provider?, X-LLM-API-Key? | ChapterGenerateRequest | 生成结果 |
| POST | `/api/chapters/{chapter_id}/generate-stream` | 流式生成章节 | UserIdDep | X-LLM-Provider?, X-LLM-API-Key? | ChapterGenerateRequest | SSE 事件流 |

#### 3.4.3 章节后处理

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| POST | `/api/chapters/{chapter_id}/trigger_auto_updates` | 触发自动更新 | editor | `{generation_run_id?}` | `{tasks, chapter_token}` |
| POST | `/api/chapters/{chapter_id}/post_edit_adoption` | 记录后编辑采纳 | editor | `{generation_run_id, post_edit_run_id?, choice}` | `{ok}` |

---

### 3.5 角色管理 (`characters.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/projects/{project_id}/characters` | 角色列表 | viewer | 无 | `{characters}` |
| POST | `/api/projects/{project_id}/characters` | 创建角色 | editor | `{name, role?, profile?, notes?}` | `{character}` |
| PUT | `/api/characters/{character_id}` | 更新角色 | editor | `{name?, role?, profile?, notes?}` | `{character}` |
| DELETE | `/api/characters/{character_id}` | 删除角色 | editor | 无 | `{}` |

**关键逻辑**：修改后调度搜索索引重建。

---

### 3.6 大纲管理

#### 3.6.1 活跃大纲操作 (`outline.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/projects/{project_id}/outline` | 获取活跃大纲 | viewer | 无 | `{outline}` |
| PUT | `/api/projects/{project_id}/outline` | 更新活跃大纲 | editor | `{title?, content_md?, structure?}` | `{outline}` |
| POST | `/api/projects/{project_id}/outline/generate` | 生成大纲 | UserIdDep | OutlineGenerateRequest + X-LLM-* 头 | 生成结果 |
| POST | `/api/projects/{project_id}/outline/generate-stream` | 流式生成大纲 | UserIdDep | OutlineGenerateRequest + X-LLM-* 头 | SSE 事件流 |

**关键逻辑**：
- 大纲内容同时维护 `content_md`（Markdown 文本）和 `structure`（结构化 JSON）
- 自动执行内容和结构的标准化处理

#### 3.6.2 多大纲 CRUD (`outlines.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/projects/{project_id}/outlines` | 大纲列表 | viewer | 无 | `{outlines}` |
| POST | `/api/projects/{project_id}/outlines` | 创建大纲 | editor | `{title, content_md?, structure?}` | `{outline}` |
| GET | `/api/projects/{project_id}/outlines/{outline_id}` | 获取大纲 | viewer | 无 | `{outline}` |
| PUT | `/api/projects/{project_id}/outlines/{outline_id}` | 更新大纲 | editor | `{title?, content_md?, structure?}` | `{outline}` |
| DELETE | `/api/projects/{project_id}/outlines/{outline_id}` | 删除大纲 | editor | 无 | `{}` |

**关键逻辑**：
- 创建新大纲时自动设为活跃大纲
- 删除大纲时级联删除关联章节
- 删除活跃大纲后自动切换到最新的其他大纲

#### 3.6.3 大纲辅助文件

| 文件 | 职责 |
|------|------|
| `outline_route_chapter_helpers.py` | 大纲章节处理：提取章节号、构建缺失邻居上下文、分段合并、评分等 |
| `outline_route_policy.py` | 大纲生成策略参数：批次大小、最大尝试次数、分段阈值、进度信息等 |
| `outline_route_prompt_helpers.py` | 大纲生成提示词构建：缺失章节补全提示、分段提示、间隙修复提示、输出解析等 |

---

### 3.7 记忆系统 (`memory.py`)

#### 3.7.1 记忆检索与预览

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| GET | `/api/projects/{project_id}/memory/retrieve` | 检索项目记忆 | viewer | `query_text?, include_deleted?` | 记忆上下文包 |
| POST | `/api/projects/{project_id}/memory/preview` | 预览记忆注入 | viewer | `{query_text, section_enabled?, budget_overrides?}` | 记忆上下文包 |

#### 3.7.2 结构化记忆

| 方法 | 路径 | 功能 | 认证/权限 | 请求参数 | 响应 |
|------|------|------|-----------|----------|------|
| GET | `/api/projects/{project_id}/memory/structured` | 列出结构化记忆 | viewer | `include_deleted?, table?, q?, before?, limit?` | 结构化记忆数据 |

#### 3.7.3 故事记忆（伏笔）

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| POST | `/api/projects/{project_id}/story_memories/import_all` | 批量导入故事记忆 | editor | StoryMemoryImportV1Request | 导入结果 |
| GET | `/api/projects/{project_id}/story_memories/foreshadows/open_loops` | 未解决的伏笔 | viewer | `limit?, q?, order?` | `{items}` |
| POST | `/api/projects/{project_id}/story_memories/foreshadows/{story_memory_id}/resolve` | 解决伏笔 | editor | `{resolved_at_chapter_id}` | 伏笔数据 |

#### 3.7.4 记忆更新提议

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| POST | `/api/chapters/{chapter_id}/memory/propose` | 提议章节记忆更新 | editor | MemoryUpdateV1Request, `allow_draft?` | 变更集 |
| POST | `/api/chapters/{chapter_id}/memory/propose/auto` | 自动提议章节记忆更新 | UserIdDep | MemoryAutoProposeRequest + X-LLM-* 头, `allow_draft?` | 变更集 |
| POST | `/api/projects/{project_id}/tables/change_sets/propose` | 提议表格更新 | editor | TableUpdateV1Request | 变更集 |

#### 3.7.5 变更集管理

| 方法 | 路径 | 功能 | 认证/权限 | 请求参数 | 响应 |
|------|------|------|-----------|----------|------|
| POST | `/api/memory_change_sets/{change_set_id}/apply` | 应用变更集 | editor | `allow_draft?` | 应用结果 |
| POST | `/api/memory_change_sets/{change_set_id}/rollback` | 回滚变更集 | editor | 无 | 回滚结果 |
| GET | `/api/projects/{project_id}/memory_change_sets` | 变更集列表 | viewer | `status?, before?, limit?` | `{change_sets, ...}` |

#### 3.7.6 记忆任务

| 方法 | 路径 | 功能 | 认证/权限 | 请求参数 | 响应 |
|------|------|------|-----------|----------|------|
| GET | `/api/projects/{project_id}/memory_tasks` | 记忆任务列表 | viewer | `status?, before?, limit?` | `{tasks, ...}` |
| GET | `/api/memory_tasks/{task_id}` | 获取记忆任务 | viewer | 无 | 任务详情 |
| POST | `/api/memory_tasks/{task_id}/retry` | 重试记忆任务 | editor | 无 | 任务详情 |

#### 3.7.7 记忆辅助文件

| 文件 | 职责 |
|------|------|
| `memory_route_helpers.py` | 构建记忆上下文包 payload、标准化自动提议参数 |
| `memory_route_models.py` | 路由级别 Pydantic 模型（MemoryAutoProposeRequest 等） |
| `memory_route_story_helpers.py` | 故事记忆的 open_loops 构建、导入、伏笔解决等核心逻辑 |
| `memory_route_story_mappers.py` | 故事记忆的数据映射（伏笔 payload、open_loop item、导入行构建） |
| `memory_route_structured_helpers.py` | 结构化记忆列表查询与 payload 构建 |
| `memory_route_structured_mappers.py` | 结构化记忆的数据格式映射 |
| `memory_route_structured_models.py` | 结构化记忆的路由级别数据模型 |

---

### 3.8 故事记忆 CRUD (`story_memory.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| GET | `/api/projects/{project_id}/story_memories` | 故事记忆列表 | viewer | `chapter_id?, limit?, offset?` | `{items, next_offset}` |
| POST | `/api/projects/{project_id}/story_memories` | 创建故事记忆 | editor | StoryMemoryCreateRequest | `{story_memory}` |
| PUT | `/api/projects/{project_id}/story_memories/{story_memory_id}` | 更新故事记忆 | editor | StoryMemoryUpdateRequest | `{story_memory}` |
| DELETE | `/api/projects/{project_id}/story_memories/{story_memory_id}` | 删除故事记忆 | editor | 无 | `{deleted_id}` |
| POST | `/api/projects/{project_id}/story_memories/merge` | 合并故事记忆 | editor | `{target_id, source_ids}` | `{story_memory, deleted_ids}` |
| POST | `/api/projects/{project_id}/story_memories/{story_memory_id}/mark_done` | 标记完成 | editor | `{done?}` | `{story_memory}` |

**StoryMemory 字段**：`chapter_id`, `memory_type`, `title`, `content`, `full_context_md`, `importance_score`, `tags`, `story_timeline`, `text_position`, `text_length`, `is_foreshadow`

**关键逻辑**：
- 合并操作将 source 的内容拼接到 target，合并标签、保留最高重要性分数
- 标记完成通过 `metadata_json` 的 `done` 字段实现
- 所有 CRUD 操作后调度向量和搜索索引重建

---

### 3.9 提示词预设 (`prompts.py`)

#### 3.9.1 预设管理

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/projects/{project_id}/prompt_presets` | 预设列表 | editor | 无 | `{presets}` |
| GET | `/api/projects/{project_id}/prompt_preset_resources` | 预设资源信息 | editor | 无 | 资源数据 |
| POST | `/api/projects/{project_id}/prompt_presets` | 创建预设 | editor | PromptPresetCreate | `{preset}` |
| GET | `/api/prompt_presets/{preset_id}` | 获取预设详情 | editor | 无 | `{preset, blocks}` |
| PUT | `/api/prompt_presets/{preset_id}` | 更新预设 | editor | PromptPresetUpdate | `{preset}` |
| POST | `/api/prompt_presets/{preset_id}/reset_to_default` | 重置为默认 | editor | 无 | `{preset}` |
| DELETE | `/api/prompt_presets/{preset_id}` | 删除预设 | editor | 无 | `{}` |

#### 3.9.2 提示词块管理

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| POST | `/api/prompt_presets/{preset_id}/blocks` | 创建提示词块 | editor | PromptBlockCreate | `{block}` |
| PUT | `/api/prompt_blocks/{block_id}` | 更新提示词块 | editor | PromptBlockUpdate | `{block}` |
| POST | `/api/prompt_blocks/{block_id}/reset_to_default` | 重置块为默认 | editor | 无 | `{block}` |
| DELETE | `/api/prompt_blocks/{block_id}` | 删除提示词块 | editor | 无 | `{}` |
| POST | `/api/prompt_presets/{preset_id}/blocks/reorder` | 重排序提示词块 | editor | `{ordered_block_ids}` | `{blocks}` |

#### 3.9.3 导入导出与预览

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/prompt_presets/{preset_id}/export` | 导出预设 | editor | 无 | 导出 JSON |
| POST | `/api/projects/{project_id}/prompt_presets/import` | 导入预设 | editor | PromptPresetImportRequest | 导入结果 |
| GET | `/api/projects/{project_id}/prompt_presets/export_all` | 全量导出 | editor | 无 | 全部预设 JSON |
| POST | `/api/projects/{project_id}/prompt_presets/import_all` | 全量导入 | editor | PromptPresetImportAllRequest | 导入结果 |
| POST | `/api/projects/{project_id}/prompt_preview` | 提示词预览 | editor | PromptPreviewRequest | 渲染后的提示词 |

#### 3.9.4 提示词辅助文件

| 文件 | 职责 |
|------|------|
| `prompt_route_helpers.py` | 预设/块的 CRUD 核心逻辑，payload 构建，预设详情组装 |
| `prompt_route_import_export.py` | 预设导入导出的序列化/反序列化逻辑 |
| `prompt_route_mappers.py` | 数据库模型到 API 响应的映射函数 |
| `prompt_route_models.py` | 路由级别 Pydantic 数据模型 |
| `prompt_route_preview.py` | 提示词预览渲染逻辑 |

---

### 3.10 LLM 配置与管理

#### 3.10.1 LLM 测试 (`llm.py`)

| 方法 | 路径 | 功能 | 认证 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| POST | `/api/llm/test` | 测试 LLM 连接 | UserIdDep | LLMTestRequest + X-LLM-* 头 | 测试结果 |

#### 3.10.2 LLM 能力查询 (`llm_capabilities.py`)

| 方法 | 路径 | 功能 | 认证 | 请求参数 | 响应 |
|------|------|------|------|----------|------|
| GET | `/api/llm_capabilities` | 查询 LLM 能力合约 | 无 | `provider, model` | `{capabilities}` |

#### 3.10.3 LLM 模型列表 (`llm_models.py`)

| 方法 | 路径 | 功能 | 认证 | 请求参数 | 响应 |
|------|------|------|------|----------|------|
| GET | `/api/llm_models` | 列出可用模型 | UserIdDep | `provider, base_url?, project_id?, profile_id?` + X-LLM-API-Key? | `{provider, base_url, models, warning?}` |

**支持的 Provider**：
- `openai` / `openai_responses` / `openai_compatible` / `openai_responses_compatible` -- OpenAI 兼容 API
- `anthropic` -- Anthropic Claude API
- `gemini` -- Google Gemini API

#### 3.10.4 LLM 参数预设 (`llm_preset.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/projects/{project_id}/llm_preset` | 获取 LLM 预设 | editor | 无 | `{llm_preset}` |
| PUT | `/api/projects/{project_id}/llm_preset` | 更新 LLM 预设 | editor | LLMPresetPutRequest | `{llm_preset}` |

**预设字段**：`provider, base_url, model, temperature, top_p, max_tokens, presence_penalty, frequency_penalty, top_k, stop, timeout_seconds, extra`

**响应增强字段**：`provider_key, model_key, known_model, contract_mode, pricing, max_tokens_limit, max_tokens_recommended, context_window_limit`

#### 3.10.5 LLM 配置文件 (`llm_profiles.py`)

| 方法 | 路径 | 功能 | 认证 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| GET | `/api/llm_profiles` | 列出用户配置文件 | UserIdDep | 无 | `{profiles}` |
| POST | `/api/llm_profiles` | 创建配置文件 | UserIdDep | LLMProfileCreate | `{profile}` |
| PUT | `/api/llm_profiles/{profile_id}` | 更新配置文件 | owner | LLMProfileUpdate | `{profile}` |
| DELETE | `/api/llm_profiles/{profile_id}` | 删除配置文件 | owner | 无 | `{}` |

**关键逻辑**：
- API Key 使用加密存储（`encrypt_secret`），返回脱敏掩码
- 更新 Profile 时同步更新所有关联项目的 LLM Preset 和 Task Preset
- 删除 Profile 时断开所有项目和任务预设的关联

#### 3.10.6 LLM 任务预设 (`llm_task_presets.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/projects/{project_id}/llm_task_presets` | 列出任务预设 | editor | 无 | `{catalog, task_presets}` |
| PUT | `/api/projects/{project_id}/llm_task_presets/{task_key}` | 设置任务预设 | editor | LLMTaskPresetPutRequest | `{task_preset}` |
| DELETE | `/api/projects/{project_id}/llm_task_presets/{task_key}` | 删除任务预设 | editor | 无 | `{}` |

**关键逻辑**：
- `catalog` 返回所有支持的任务类型及其描述
- 任务预设允许为不同任务（如大纲生成、章节生成等）使用不同的 LLM 配置

---

### 3.11 世界书管理 (`worldbook.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| GET | `/api/projects/{project_id}/worldbook_entries` | 世界书条目列表 | viewer | 无 | `{entries}` |
| POST | `/api/projects/{project_id}/worldbook_entries` | 创建条目 | editor | WorldBookEntryCreate | `{entry}` |
| PUT | `/api/worldbook_entries/{entry_id}` | 更新条目 | editor | WorldBookEntryUpdate | `{entry}` |
| DELETE | `/api/worldbook_entries/{entry_id}` | 删除条目 | editor | 无 | 删除结果 |
| POST | `/api/projects/{project_id}/worldbook_entries/auto_update` | 触发自动更新 | editor | `chapter_id?` | 更新结果 |
| POST | `/api/projects/{project_id}/worldbook_entries/bulk_update` | 批量更新 | editor | WorldBookBulkUpdateRequest | 批量结果 |
| POST | `/api/projects/{project_id}/worldbook_entries/bulk_delete` | 批量删除 | editor | WorldBookBulkDeleteRequest | 批量结果 |
| POST | `/api/projects/{project_id}/worldbook_entries/duplicate` | 复制条目 | editor | WorldBookDuplicateRequest | 复制结果 |
| GET | `/api/projects/{project_id}/worldbook_entries/export_all` | 全量导出 | editor | 无 | 导出 JSON |
| POST | `/api/projects/{project_id}/worldbook_entries/import_all` | 全量导入 | editor | WorldBookImportAllRequest | 导入结果 |
| POST | `/api/projects/{project_id}/worldbook_entries/preview_trigger` | 预览触发条件 | viewer | WorldBookPreviewTriggerRequest | 匹配的条目 |

**辅助文件**：

| 文件 | 职责 |
|------|------|
| `worldbook_route_helpers.py` | 条目列表查询与 payload 构建 |
| `worldbook_route_import_export.py` | 导入导出的序列化逻辑 |
| `worldbook_route_mappers.py` | 数据库行到 API 响应的映射 |
| `worldbook_route_models.py` | 路由级别数据模型 |
| `worldbook_route_mutations.py` | CRUD 变更核心逻辑（创建、更新、删除、批量操作、复制） |
| `worldbook_route_preview.py` | 触发条件预览和自动更新逻辑 |

---

### 3.12 数值表格 (`tables.py`)

#### 3.12.1 表格 CRUD

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| GET | `/api/projects/{project_id}/tables` | 表格列表 | viewer | `include_schema?` | `{tables}` |
| POST | `/api/projects/{project_id}/tables` | 创建表格 | editor | TableCreateRequest | `{table}` |
| GET | `/api/projects/{project_id}/tables/{table_id}` | 获取表格 | viewer | `include_schema?` | `{table}` |
| PUT | `/api/projects/{project_id}/tables/{table_id}` | 更新表格 | editor | TableUpdateRequest | `{table}` |
| DELETE | `/api/projects/{project_id}/tables/{table_id}` | 删除表格 | editor | 无 | 删除结果 |
| POST | `/api/projects/{project_id}/tables/seed_defaults` | 初始化默认表 | editor | 无 | `{result}` |

#### 3.12.2 表格行 CRUD

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| GET | `/api/projects/{project_id}/tables/{table_id}/rows` | 行列表 | viewer | `offset?, limit?` | `{rows}` |
| POST | `/api/projects/{project_id}/tables/{table_id}/rows` | 创建行 | editor | TableRowCreateRequest | `{row}` |
| PUT | `/api/projects/{project_id}/tables/{table_id}/rows/{row_id}` | 更新行 | editor | TableRowUpdateRequest | `{row}` |
| DELETE | `/api/projects/{project_id}/tables/{table_id}/rows/{row_id}` | 删除行 | editor | 无 | 删除结果 |

#### 3.12.3 AI 更新

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| POST | `/api/projects/{project_id}/tables/{table_id}/ai_update` | 调度 AI 更新 | editor | TableAiUpdateRequest, `chapter_id?` | 调度结果 |

**辅助文件**：

| 文件 | 职责 |
|------|------|
| `table_route_helpers.py` | 表格/行的 CRUD 核心逻辑，AI 更新调度 |
| `table_route_mappers.py` | 数据行到 API 响应的映射 |
| `table_route_models.py` | 路由级别数据模型 |

---

### 3.13 生成记录 (`generation_runs.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求参数 | 响应 |
|------|------|------|-----------|----------|------|
| GET | `/api/projects/{project_id}/generation_runs` | 生成记录列表 | viewer | `limit?, chapter_id?, request_id?` | `{runs}` |
| GET | `/api/generation_runs/{run_id}` | 获取生成记录 | viewer | 无 | `{run}` |
| GET | `/api/generation_runs/{run_id}/debug_bundle` | 下载调试包 | viewer | `include_prompt_inspector?` | JSON 文件下载 |

**关键逻辑**：
- 提示词内容经过 `redact_text` 脱敏处理
- 调试包包含完整的提示词、参数、向量 RAG 状态、记忆检索日志等
- API Key 在调试包中自动脱敏

---

### 3.14 批量生成 (`batch_generation.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| POST | `/api/projects/{project_id}/batch_generation_tasks` | 创建批量任务 | editor | BatchGenerationCreateRequest | `{task, items}` |
| GET | `/api/projects/{project_id}/batch_generation_tasks/active` | 获取活跃任务 | viewer | 无 | `{task, items}` |
| GET | `/api/batch_generation_tasks/{task_id}` | 获取任务详情 | viewer | 无 | `{task, items}` |
| POST | `/api/batch_generation_tasks/{task_id}/pause` | 暂停任务 | editor | 无 | `{task, paused}` |
| POST | `/api/batch_generation_tasks/{task_id}/resume` | 恢复任务 | editor | 无 | `{task, items, resumed}` |
| POST | `/api/batch_generation_tasks/{task_id}/retry_failed` | 重试失败项 | editor | 无 | `{task, items, retried}` |
| POST | `/api/batch_generation_tasks/{task_id}/skip_failed` | 跳过失败项 | editor | 无 | `{task, items, skipped}` |
| POST | `/api/batch_generation_tasks/{task_id}/cancel` | 取消任务 | editor | 无 | `{task, canceled}` |

**关键逻辑**：
- 配额控制：项目级（默认 1）、用户级（默认 3）、提供方级（默认 3）
- 支持增量生成（`include_existing` 控制是否覆盖已有内容）
- 顺序模式（`require_sequential`）要求前置章节必须有内容
- 支持暂停/恢复/取消/重试/跳过等生命周期管理
- 恢复前必须处理所有失败项（重试或跳过）

---

### 3.15 章节分析 (`chapter_analysis.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| POST | `/api/chapters/{chapter_id}/analyze` | 分析章节 | UserIdDep | ChapterAnalyzeRequest + X-LLM-* 头 | 分析结果 |
| POST | `/api/chapters/{chapter_id}/rewrite` | 改写章节 | UserIdDep | ChapterRewriteRequest + X-LLM-* 头 | 改写结果 |
| POST | `/api/chapters/{chapter_id}/analysis/apply` | 应用分析结果 | editor | `{analysis, draft_content_md?}` | 应用结果 |
| GET | `/api/chapters/{chapter_id}/annotations` | 获取章节标注 | viewer | 无 | `{annotations}` |

**关键逻辑**：
- 标注系统从故事记忆构建，标注包含位置、类型、内容等信息

---

### 3.16 导出 (`export.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求参数 | 响应 |
|------|------|------|-----------|----------|------|
| GET | `/api/projects/{project_id}/export/markdown` | 导出 Markdown | viewer | `include_settings?, include_characters?, include_outline?, chapters?` | Markdown 文件下载 |
| GET | `/api/projects/{project_id}/export/bundle` | 导出项目包 | editor | 无 | JSON 文件下载 |

**关键逻辑**：
- Markdown 导出包含设定、角色卡、大纲、正文，可选择性包含
- `chapters` 参数支持 `all` 或 `done`（仅定稿章节）
- 文件名使用 UTF-8 编码，兼容中文文件名

---

### 3.17 导入 (`import_export.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| GET | `/api/projects/{project_id}/imports` | 导入文档列表 | viewer | 无 | `{documents}` |
| POST | `/api/projects/{project_id}/imports` | 创建导入任务 | editor | `{filename, content_text, content_type?}` | `{document, job_id}` |
| GET | `/api/projects/{project_id}/imports/{document_id}` | 获取导入详情 | viewer | 无 | `{document, content_preview, vector_ingest_result, worldbook_proposal, story_memory_proposal}` |
| GET | `/api/projects/{project_id}/imports/{document_id}/chunks` | 导入文档分块 | viewer | `limit?` | `{chunks, returned}` |
| POST | `/api/projects/{project_id}/imports/{document_id}/retry` | 重试导入 | editor | 无 | `{document, cleanup, job_id, enqueue_error}` |

**关键逻辑**：
- 导入任务异步执行，通过任务队列调度
- 自动识别文件类型（md/txt）
- 导入过程包含向量知识库创建和分块
- 支持查看世界书和故事记忆的提议

---

### 3.18 搜索 (`search.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| POST | `/api/projects/{project_id}/search/query` | 全文搜索 | viewer | `{q, sources?, limit?, offset?}` | 搜索结果 |

---

### 3.19 项目设置 (`settings.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/projects/{project_id}/settings` | 获取项目设置 | viewer | 无 | `{settings}` |
| PUT | `/api/projects/{project_id}/settings` | 更新项目设置 | editor | ProjectSettingsUpdate | `{settings}` |

**设置字段**：
- **基础设置**：`world_setting`（世界观）, `style_guide`（风格指南）, `constraints`（约束）
- **上下文优化器**：`context_optimizer_enabled`
- **自动更新开关**：worldbook / characters / story_memory / graph / vector / search / fractal / tables（8 个独立开关）
- **查询预处理**：`query_preprocessing`（包含预处理策略配置）
- **向量嵌入配置**：provider / base_url / model / api_key / Azure 配置 / sentence_transformers 配置
- **向量重排序配置**：enabled / method / top_k / provider / base_url / model / api_key / timeout_seconds / hybrid_alpha

**关键逻辑**：
- 设置分为项目级覆盖和环境级默认，返回有效值和来源
- API Key 加密存储，返回时脱敏
- 向量禁用原因自动检测（缺少 base_url / model / api_key 等）

---

### 3.20 任务管理 (`tasks.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求参数 | 响应 |
|------|------|------|-----------|----------|------|
| GET | `/api/projects/{project_id}/task-events/stream` | SSE 任务事件流 | viewer | `lastEventId?, stream_timeout_seconds?` | SSE 事件流 |
| GET | `/api/projects/{project_id}/tasks` | 任务列表 | viewer | `status?, kind?, before?, limit?` | `{tasks}` |
| GET | `/api/tasks/{task_id}` | 获取任务 | viewer | 无 | 任务详情 |
| GET | `/api/tasks/{task_id}/runtime` | 获取任务运行时视图 | viewer | 无 | 运行时视图 |
| POST | `/api/tasks/{task_id}/retry` | 重试任务 | editor | 无 | 任务详情 |
| POST | `/api/tasks/{task_id}/cancel` | 取消任务 | editor | 无 | 任务详情 |

**关键逻辑**：
- SSE 流支持心跳（10秒间隔）和超时（默认25秒）
- 初始连接返回活跃任务快照
- 轮询间隔 1 秒

---

### 3.21 向量 RAG (`vector.py`)

#### 3.21.1 索引管理

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| POST | `/api/projects/{project_id}/vector/status` | 向量索引状态 | viewer | `{kb_id?, sources?}` | `{result}` |
| POST | `/api/projects/{project_id}/vector/ingest` | 摄入向量 | editor | `{kb_id?, kb_ids?, sources?}` | `{result}` |
| POST | `/api/projects/{project_id}/vector/rebuild` | 重建索引 | editor | `{kb_id?, kb_ids?, sources?}` | `{result}` |
| POST | `/api/projects/{project_id}/vector/purge` | 清除索引 | owner | 无 | `{result}` |
| POST | `/api/projects/{project_id}/vector/query` | 向量查询 | viewer | `{query_text, kb_id?, kb_ids?, sources?, rerank_hybrid_alpha?, super_sort?}` | `{result, raw_query_text, normalized_query_text, preprocess_obs}` |

#### 3.21.2 Dry Run 测试

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| POST | `/api/projects/{project_id}/vector/embeddings/dry-run` | 嵌入测试 | editor | `{text}` | `{result}` |
| POST | `/api/projects/{project_id}/vector/rerank/dry-run` | 重排序测试 | editor | `{query_text, documents, method?, top_k?, hybrid_alpha?}` | `{result}` |

#### 3.21.3 知识库管理

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/projects/{project_id}/vector/kbs` | 知识库列表 | viewer | 无 | `{kbs}` |
| POST | `/api/projects/{project_id}/vector/kbs` | 创建知识库 | editor | `{name, kb_id?, enabled?, weight?, priority_group?}` | `{kb}` |
| PUT | `/api/projects/{project_id}/vector/kbs/{kb_id}` | 更新知识库 | editor | `{name?, enabled?, weight?, priority_group?}` | `{kb}` |
| POST | `/api/projects/{project_id}/vector/kbs/reorder` | 重排序知识库 | editor | `{kb_ids}` | `{kbs}` |
| DELETE | `/api/projects/{project_id}/vector/kbs/{kb_id}` | 删除知识库 | owner | 无 | `{deleted, vector_purge}` |

**关键逻辑**：
- 支持多知识库，每个知识库有独立的权重和优先级分组
- 向量来源包括：worldbook, outline, chapter, story_memory
- 查询支持查询预处理（标准化文本）和重排序

---

### 3.22 知识图谱 (`graph.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| POST | `/api/projects/{project_id}/graph/query` | 图谱查询 | viewer | `{query_text, hop?, max_nodes?, max_edges?, enabled?}` | `{result, raw_query_text, normalized_query_text, preprocess_obs}` |
| POST | `/api/projects/{project_id}/graph/auto_update` | 触发图谱自动更新 | editor | `{chapter_id, focus?}` | `{task_id}` |

**关键逻辑**：
- 仅定稿（done）章节可触发图谱自动更新
- 支持查询文本预处理

---

### 3.23 分形记忆 (`fractal.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/projects/{project_id}/fractal` | 获取分形上下文 | viewer | 无 | `{result}` |
| POST | `/api/projects/{project_id}/fractal/rebuild` | 重建分形记忆 | editor | `{reason?, mode?}` + X-LLM-API-Key? | `{result}` |

**模式**：
- `deterministic`：确定性重建（默认）
- `llm_v2`：使用 LLM 辅助重建（需要 API Key）

---

### 3.24 MCP 工具 (`mcp.py`)

| 方法 | 路径 | 功能 | 认证 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| GET | `/api/mcp/tools` | 列出 MCP 工具 | UserIdDep | 无 | `{tools: [{name, description, args_schema}]}` |
| POST | `/api/mcp/runs/{run_id}/replay` | 回放 MCP 工具调用 | viewer | `{allowlist}` | `{original_run_id, replay_run_id, tool_name, ok, error_code, error_message, latency_ms, truncated}` |

**关键逻辑**：
- 仅支持回放 `mcp_tool` 类型的 GenerationRun
- `allowlist` 限制允许回放的工具名称

---

### 3.25 术语表 (`glossary.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体/参数 | 响应 |
|------|------|------|-----------|-------------|------|
| GET | `/api/projects/{project_id}/glossary_terms` | 术语列表 | viewer | `q?, limit?, include_disabled?` | `{terms, returned}` |
| GET | `/api/projects/{project_id}/glossary_terms/export_all` | 全量导出 | viewer | 无 | `{export}` |
| POST | `/api/projects/{project_id}/glossary_terms` | 创建术语 | editor | `{term, aliases?, enabled?}` | `{term}` |
| PUT | `/api/projects/{project_id}/glossary_terms/{term_id}` | 更新术语 | editor | `{term?, aliases?, enabled?}` | `{term}` |
| DELETE | `/api/projects/{project_id}/glossary_terms/{term_id}` | 删除术语 | editor | 无 | `{deleted, id}` |
| POST | `/api/projects/{project_id}/glossary_terms/rebuild` | 重建术语表 | editor | `{include_chapters?, include_imports?, max_terms_per_source?}` | 重建结果 |

**关键逻辑**：
- 术语支持别名列表（最多 50 个）
- 术语不可重复
- 重建从章节和导入文档中自动提取术语

---

### 3.26 写作风格 (`writing_styles.py`)

| 方法 | 路径 | 功能 | 认证/权限 | 请求体 | 响应 |
|------|------|------|-----------|--------|------|
| GET | `/api/writing_styles/presets` | 系统预设列表 | UserIdDep | 无 | `{styles}` |
| GET | `/api/writing_styles` | 用户风格列表 | UserIdDep | 无 | `{styles}` |
| POST | `/api/writing_styles` | 创建风格 | UserIdDep | `{name, description?, prompt_content}` | `{style}` |
| PUT | `/api/writing_styles/{style_id}` | 更新风格 | owner | `{name?, description?, prompt_content?}` | `{style}` |
| DELETE | `/api/writing_styles/{style_id}` | 删除风格 | owner | 无 | `{}` |
| GET | `/api/projects/{project_id}/writing_style_default` | 获取项目默认风格 | editor | 无 | `{default}` |
| PUT | `/api/projects/{project_id}/writing_style_default` | 设置项目默认风格 | editor | `{style_id}` | `{default}` |

**关键逻辑**：
- 系统预设（`is_preset=True`）所有用户可见
- 用户自定义风格仅限本人访问
- 删除风格时自动断开项目默认风格关联

---

## 四、API 设计模式与规范

### 4.1 统一响应格式

所有 API 使用 `ok_payload(request_id, data)` 统一封装响应：

```json
{
  "ok": true,
  "request_id": "<uuid>",
  "data": { ... }
}
```

### 4.2 错误处理

统一使用 `AppError` 异常类：

| 工厂方法 | 状态码 | 含义 |
|----------|--------|------|
| `AppError.unauthorized()` | 401 | 未认证 |
| `AppError.forbidden()` | 403 | 无权限 |
| `AppError.not_found()` | 404 | 资源不存在 |
| `AppError.validation()` | 400 | 请求参数验证失败 |
| `AppError.conflict()` | 409 | 资源冲突 |
| 自定义 `AppError(...)` | 自定义 | 自定义错误码和信息 |

### 4.3 认证机制

- **Cookie-based Session**：通过 `build_session` + `set_session_cookies` 实现
- **请求拦截器**：中间件将用户信息设置到 `request.state`
- **LLM API Key**：通过请求头 `X-LLM-Provider` 和 `X-LLM-API-Key` 传递

### 4.4 URL 路径规范

- **资源嵌套**：`/projects/{project_id}/chapters`, `/projects/{project_id}/worldbook_entries`
- **顶级资源**：`/chapters/{chapter_id}`, `/worldbook_entries/{entry_id}`（更新/删除等操作）
- **动作端点**：`/chapters/{chapter_id}/generate`, `/batch_generation_tasks/{task_id}/pause`
- **前缀**：所有 API 路径以 `/api` 开头

### 4.5 分页模式

- **游标分页**（推荐）：`cursor` + `limit` + `has_more` + `next_cursor`
- **偏移分页**：`offset` + `limit` + `next_offset`
- **简单限制**：`limit` + `before`（按时间戳筛选）

### 4.6 路由辅助文件命名规范

| 后缀 | 职责 |
|------|------|
| `_helpers.py` | 核心业务逻辑、payload 构建、数据组装 |
| `_mappers.py` | 数据库模型到 API 响应的映射转换 |
| `_models.py` | 路由级别的 Pydantic 请求/响应模型 |
| `_import_export.py` | 导入导出相关的序列化/反序列化逻辑 |
| `_preview.py` | 预览功能的渲染和数据组装 |
| `_mutations.py` | 数据变更操作（CRUD 的核心实现） |
| `_policy.py` | 策略参数和决策逻辑（阈值、批次大小等） |
| `_prompt_helpers.py` | 提示词构建和解析 |
| `_chapter_helpers.py` | 章节相关的处理逻辑 |

### 4.7 副作用触发模式

大多数数据变更操作会触发以下副作用：
1. **标记向量索引 dirty**：`_mark_vector_index_dirty(db, project_id=...)`
2. **调度向量重建任务**：`schedule_vector_rebuild_task(...)`
3. **调度搜索索引重建**：`schedule_search_rebuild_task(...)`
4. **章节定稿触发**：`schedule_chapter_done_tasks(...)` -- 触发世界书更新、记忆更新、图谱更新等自动化任务链

### 4.8 完整端点统计

| 模块 | 端点数 |
|------|--------|
| health | 1 |
| auth | 12 |
| projects | 10 |
| chapters | 12 |
| characters | 4 |
| outline | 4 |
| outlines | 5 |
| memory | 13 |
| story_memory | 7 |
| prompts | 16 |
| llm | 1 |
| llm_capabilities | 1 |
| llm_models | 1 |
| llm_preset | 2 |
| llm_profiles | 4 |
| llm_task_presets | 3 |
| worldbook | 12 |
| tables | 12 |
| generation_runs | 3 |
| batch_generation | 8 |
| chapter_analysis | 4 |
| export | 2 |
| import_export | 5 |
| search | 1 |
| settings | 2 |
| tasks | 6 |
| vector | 12 |
| graph | 2 |
| fractal | 2 |
| mcp | 2 |
| glossary | 6 |
| writing_styles | 7 |
| **总计** | **~180** |
