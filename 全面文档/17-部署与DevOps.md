# 17 - 部署与DevOps

## 目录

1. [Docker 部署架构](#1-docker-部署架构)
2. [开发环境配置](#2-开发环境配置)
3. [质量守卫系统 (Guards)](#3-质量守卫系统-guards)
4. [交付门控与回归测试](#4-交付门控与回归测试)
5. [后端测试](#5-后端测试)
6. [端到端测试 (E2E)](#6-端到端测试-e2e)
7. [代码质量工具](#7-代码质量工具)
8. [Git 配置](#8-git-配置)
9. [AGENTS.md 说明](#9-agentsmd-说明)
10. [后端脚本工具](#10-后端脚本工具)
11. [后端资源文件](#11-后端资源文件)

---

## 1. Docker 部署架构

### 1.1 服务总览 (`docker-compose.yml`)

文件路径：`docker-compose.yml`

整个平台由 5 个容器服务 + 2 个命名卷组成：

| 服务 | 镜像 | 用途 | 端口映射 |
|------|------|------|----------|
| `postgres` | `pgvector/pgvector:pg16` | 主数据库，支持 pgvector 向量扩展 | `127.0.0.1:5432` (仅本地) |
| `redis` | `redis:7-alpine` | 任务队列后端 (RQ) | `127.0.0.1:6379` (仅本地) |
| `backend` | 自构建 (`./backend`) | FastAPI 后端 API 服务器 | `8000` |
| `rq_worker` | 自构建 (`./backend`) | RQ 异步任务消费者 | 无 |
| `frontend` | 自构建 (`./frontend`) | Nginx 静态前端 | `5173:80` |

#### 1.1.1 postgres 服务

```yaml
postgres:
  image: pgvector/pgvector:pg16
  environment:
    POSTGRES_DB: ${POSTGRES_DB:-ainovel}
    POSTGRES_USER: ${POSTGRES_USER:-ainovel}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-ainovel}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
    interval: 5s / timeout: 5s / retries: 20
  ports:
    - "127.0.0.1:${PG_PORT:-5432}:5432"
  restart: unless-stopped
```

- 使用 pgvector 扩展的 PostgreSQL 16 镜像，原生支持向量检索
- 端口绑定到 `127.0.0.1`，仅本机可访问
- 数据持久化到 `postgres_data` 命名卷
- 健康检查使用 `pg_isready` 命令

#### 1.1.2 redis 服务

```yaml
redis:
  image: redis:7-alpine
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s / timeout: 3s / retries: 20
  ports:
    - "127.0.0.1:${REDIS_PORT:-6379}:6379"
  restart: unless-stopped
```

- 轻量 Alpine 版 Redis 7
- 用于 RQ (Redis Queue) 任务队列
- 同样仅本机绑定

#### 1.1.3 backend 服务

核心环境变量分组：

| 分类 | 变量 | 默认值 | 说明 |
|------|------|--------|------|
| 基础 | `APP_ENV` | `dev` | 运行环境：dev/test/prod |
| 基础 | `LOG_LEVEL` | `INFO` | 日志级别 |
| 基础 | `WAIT_FOR_DB` | `1` | 启动时等待数据库就绪 |
| 数据库 | `DATABASE_URL` | `postgresql+psycopg2://ainovel:ainovel@postgres:5432/ainovel` | 数据库连接串 |
| 网络 | `CORS_ORIGINS` | `http://localhost:5173` | CORS 允许来源 |
| 队列 | `TASK_QUEUE_BACKEND` | `rq` | 任务队列后端类型 |
| 队列 | `REDIS_URL` | `redis://redis:6379/0` | Redis 连接地址 |
| 队列 | `RQ_QUEUE_NAME` | `default` | 队列名称 |
| 向量 | `VECTOR_CHROMA_PERSIST_DIR` | `/data/chroma` | Chroma 持久化目录 |
| 性能 | `WEB_CONCURRENCY` | `2` | uvicorn worker 数量 |
| 性能 | `DB_POOL_SIZE` | `5` | 数据库连接池大小 |
| 性能 | `DB_MAX_OVERFLOW` | `10` | 连接池溢出上限 |
| 性能 | `DB_POOL_TIMEOUT_SECONDS` | `30` | 连接池获取超时 |
| 性能 | `DB_POOL_RECYCLE_SECONDS` | `1800` | 连接回收周期 |
| 认证 | `AUTH_DEV_FALLBACK_USER_ID` | (空) | dev 模式自动登录用户 ID |
| 认证 | `AUTH_ADMIN_USER_ID` | `admin` | 管理员用户 ID |
| 认证 | `AUTH_ADMIN_PASSWORD` | `ChangeMe123!` | 管理员密码 |
| 认证 | `AUTH_ADMIN_DISPLAY_NAME` | `管理员` | 管理员显示名 |
| 认证 | `AUTH_COOKIE_SAMESITE` | `lax` | Cookie SameSite 策略 |
| 认证 | `AUTH_ACTIVITY_TOUCH_INTERVAL_SECONDS` | `30` | 活动触摸间隔 |
| 认证 | `AUTH_ONLINE_WINDOW_SECONDS` | `300` | 在线判定窗口 |
| 密钥 | `SECRET_ENCRYPTION_KEY` | (空，自动生成) | Fernet 加密密钥 |
| 密钥 | `AUTH_SESSION_SIGNING_KEY` | (空，自动生成) | 会话签名密钥 |
| OIDC | `LINUXDO_OIDC_CLIENT_ID` | (空) | LinuxDo OIDC 客户端 ID |
| OIDC | `LINUXDO_OIDC_CLIENT_SECRET` | (空) | LinuxDo OIDC 客户端密钥 |
| OIDC | `LINUXDO_OIDC_REDIRECT_URI` | (空) | LinuxDo OIDC 回调地址 |
| OIDC | `LINUXDO_OIDC_SCOPES` | `openid profile email` | OIDC 范围 |

依赖关系：`postgres (healthy)` + `redis (healthy)` 就绪后才启动。

健康检查：通过 Python urllib 访问 `http://127.0.0.1:8000/api/health`，最长等待 30 次重试 x 5 秒间隔。

数据卷：`app_data:/data`，用于存储 Chroma 向量数据和自动生成的密钥。

#### 1.1.4 rq_worker 服务

```yaml
rq_worker:
  build: { context: ./backend }
  command: ["python", "scripts/run_rq_worker.py"]
```

- 复用 backend 镜像，但入口改为 `scripts/run_rq_worker.py`
- 环境变量与 backend 基本一致（不含 CORS/Web 相关）
- 额外支持 `RQ_WORKER_PROCESSES` 变量，控制 worker 进程数（默认 1，最大 16）
- 依赖 backend（healthy）、postgres（healthy）、redis（healthy）三个服务

#### 1.1.5 frontend 服务

```yaml
frontend:
  build: { context: ./frontend }
  ports:
    - "${FRONTEND_PORT:-5173}:80"
```

- 两阶段构建：Node 20 编译 + Nginx 1.27 部署
- 无依赖关系硬限（仅 `depends_on: backend`）
- 端口 80 映射到宿主机 5173

#### 1.1.6 命名卷

| 卷名 | 用途 |
|------|------|
| `postgres_data` | PostgreSQL 数据持久化 |
| `app_data` | 应用数据（Chroma 向量库、自动生成的密钥文件） |

### 1.2 生产环境覆盖 (`docker-compose.prod.yml`)

文件路径：`docker-compose.prod.yml`

生产覆盖文件通过 `docker compose -f docker-compose.yml -f docker-compose.prod.yml` 合并使用。关键变更：

| 变更项 | 说明 |
|--------|------|
| `postgres.ports: !reset []` | **移除 Postgres 端口映射**，外部不可访问 |
| `redis.ports: !reset []` | **移除 Redis 端口映射**，外部不可访问 |
| `APP_ENV: prod` | 强制生产环境模式 |
| `AUTH_DEV_FALLBACK_USER_ID: ""` | 禁用开发模式自动登录 |
| `CORS_ORIGINS: ${CORS_ORIGINS:?...}` | **必须显式设置**，使用 `?` 语法强制校验 |
| `AUTH_ADMIN_PASSWORD: ${...?...}` | 必须设置管理员密码 |
| `SECRET_ENCRYPTION_KEY: ${...?...}` | 必须设置加密密钥（backend + rq_worker 各一次） |
| `AUTH_SESSION_SIGNING_KEY: ${...?...}` | 必须设置会话签名密钥（backend + rq_worker 各一次） |
| `backend.ports: 127.0.0.1:${BACKEND_PORT:-8000}:8000` | 后端仅本地回环访问 |

安全设计要点：
- 数据库和 Redis 端口在生产环境完全封闭
- 所有密钥类变量从可选变为必填
- backend 端口绑定到 127.0.0.1，需通过反向代理对外
- 开发模式认证回退被显式禁用

### 1.3 后端 Dockerfile (`backend/Dockerfile`)

文件路径：`backend/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# 安全：创建非 root 运行用户
RUN addgroup --system app && adduser --system --ingroup app --home /home/app app

# 依赖安装（使用锁定版本）
COPY requirements.lock.txt requirements.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt

# 应用代码
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY app ./app
COPY scripts ./scripts

# 目录权限
RUN chmod +x scripts/entrypoint.sh \
    && mkdir -p /data/chroma /data/secrets \
    && chmod 700 /data/secrets \
    && chown -R app:app /data /home/app

USER app
EXPOSE 8000
ENTRYPOINT ["scripts/entrypoint.sh"]
```

构建关键点：
- 基础镜像：Python 3.11 slim
- 非 root 运行：创建 `app` 用户和组
- `/data/secrets` 目录权限为 700（仅所有者可访问）
- 使用锁定版本文件 `requirements.lock.txt` 确保可重现构建
- 入口脚本 `scripts/entrypoint.sh` 处理密钥初始化、数据库等待和 schema 迁移

### 1.4 容器入口脚本 (`backend/scripts/entrypoint.sh`)

文件路径：`backend/scripts/entrypoint.sh`

入口脚本按顺序执行以下步骤：

**第一步：密钥初始化**
- 如果 `SECRET_ENCRYPTION_KEY` 环境变量为空
- 尝试从 `/data/secrets/secret_encryption_key` 文件读取
- 如果文件不存在，使用文件锁机制（`.lock`）安全生成新的 Fernet 密钥
- 支持多容器并发启动场景（竞争锁 + 等待 + 过期锁清理）
- 生成的密钥持久化到 `/data/secrets/` 目录

**第二步：数据库等待**
- 当 `WAIT_FOR_DB=1` 时（默认），循环尝试连接数据库
- 超时时间默认 60 秒（`DB_WAIT_TIMEOUT`）
- 使用 SQLAlchemy 执行 `SELECT 1` 验证连接

**第三步：数据库 Schema 引导**
- 仅在无额外命令参数时执行（即默认 Web 服务器模式）
- 可通过 `RUN_DB_BOOTSTRAP` 环境变量强制启用/禁用
- 调用 `ensure_db_schema()` 执行 Alembic 迁移
- 调用 `ensure_admin_user()` 创建/更新管理员用户
- dev 环境下允许密码长度不足时优雅跳过

**第四步：启动 uvicorn**
- 如果有额外命令参数（如 rq_worker），执行该命令（`exec "$@"`）
- 否则启动 uvicorn：`python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers $WORKERS`
- SQLite 模式下强制单 worker

### 1.5 前端 Dockerfile (`frontend/Dockerfile`)

文件路径：`frontend/Dockerfile`

两阶段构建：

**阶段一：构建**
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
```

**阶段二：运行**
```dockerfile
FROM nginx:1.27-alpine
# 非 root nginx 运行配置
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 80
```

- 使用 `setcap` 赋予 nginx 绑定低端口权限，而非以 root 运行
- PID 文件改写到 `/tmp/nginx.pid`
- 最终以 `nginx` 用户运行

### 1.6 .dockerignore

文件路径：`.dockerignore`

排除项：
- `.git`、`.codex`、`.vscode`、`.idea` 等开发工具目录
- `backend/.venv`、`backend/.tmp_test`、`backend/*.db*` 等开发产物
- `frontend/node_modules`、`frontend/dist` 等前端构建缓存
- `test/.artifacts`、`test/.tmp` 等测试临时文件

### 1.7 Docker 环境变量模板

**`.env.docker.example`**（完整模板）：包含所有可配置变量及默认值，涵盖 Postgres、认证、OIDC、端口映射、性能调优等。

**`.env.docker`**（最小模板）：仅包含必填项的骨架，`POSTGRES_PASSWORD` 和 `SECRET_ENCRYPTION_KEY` 留空待填写。`DATABASE_URL` 中使用 `__POSTGRES_PASSWORD__` 占位符提醒替换。

---

## 2. 开发环境配置

### 2.1 后端 `.env` 配置 (`backend/.env.example`)

文件路径：`backend/.env.example`

开发环境默认使用 SQLite 数据库：`DATABASE_URL=sqlite:///./ainovel.db`

关键配置分组：

| 分类 | 变量 | 开发默认值 |
|------|------|-----------|
| 环境 | `APP_ENV` | `dev` |
| 加密 | `SECRET_ENCRYPTION_KEY` | (空，Windows 下使用 DPAPI) |
| 认证 | `AUTH_DEV_FALLBACK_USER_ID` | `local-user` |
| 认证 | `AUTH_ADMIN_USER_ID` | `admin` |
| 认证 | `AUTH_ADMIN_PASSWORD` | `admin-pass` |
| 认证 | `AUTH_SESSION_TTL_SECONDS` | `604800` (7天) |
| 认证 | `AUTH_REFRESH_THRESHOLD_SECONDS` | `900` (15分钟) |
| 认证 | `AUTH_BCRYPT_ROUNDS` | `12` |
| 任务队列 | `TASK_QUEUE_BACKEND` | `rq` |
| 任务队列 | `REDIS_URL` | `redis://localhost:6379/0` |
| 向量 | `VECTOR_CHROMA_PERSIST_DIR` | `./.chroma` |
| 向量 | `VECTOR_EMBEDDING_BASE_URL` | `http://127.0.0.1:4010/v1` |
| 向量 | `VECTOR_BACKEND` | `auto` (自动选择 chroma/pgvector) |
| 向量 | `VECTOR_HYBRID_ENABLED` | `true` |
| 向量 | `VECTOR_RERANK_ENABLED` | `false` |
| 向量 | `VECTOR_MAX_CANDIDATES` | `20` |
| 向量 | `VECTOR_FINAL_MAX_CHUNKS` | `6` |
| 向量 | `VECTOR_CHUNK_SIZE` | `800` |
| 向量 | `VECTOR_CHUNK_OVERLAP` | `120` |

### 2.2 开发烟雾测试脚本

#### 2.2.1 启动脚本 (`scripts/dev-smoke.ps1`)

文件路径：`scripts/dev-smoke.ps1`

PowerShell 脚本，一键启动完整开发环境（Mock LLM + Backend + Frontend）。

**参数：**
- `-MockPort`（默认 4010）：Mock LLM 服务器端口
- `-BackendPort`（默认 8000）：后端 API 端口
- `-FrontendPort`（默认 5173）：前端开发服务器端口
- `-TimeoutSec`（默认 60）：等待超时秒数
- `-NoWait`：跳过等待，立即返回

**执行流程：**
1. 检查是否有残留的运行状态（`test/.artifacts/dev-smoke/pids.json`）
2. 检查端口占用
3. 检查 Python venv 和 Node.js/npm 可用性
4. 按顺序启动三个进程：
   - **Mock LLM**：`node test/mock-llm/server.js`，PORT 由参数控制
   - **Backend**：`python -m uvicorn app.main:app --reload --workers 1 --port 8000`，使用 SQLite 临时数据库
   - **Frontend**：`npm run dev`，启用 `VITE_DEV_FALLBACK_ENABLED`
5. 等待各服务健康端点返回 200
6. 将 PID 和日志路径写入状态文件
7. 启动失败时自动清理已启动的进程

**日志输出位置：** `test/.artifacts/dev-smoke/` 目录

#### 2.2.2 停止脚本 (`scripts/dev-smoke-stop.ps1`)

文件路径：`scripts/dev-smoke-stop.ps1`

**执行流程：**
1. 从 `pids.json` 读取 PID
2. 使用 `taskkill /PID /T /F` 终止进程树
3. 等待端口释放（30 秒超时）
4. 清理状态文件

---

## 3. 质量守卫系统 (Guards)

### 3.1 架构设计

质量守卫系统位于 `scripts/guards/` 目录，提供一套可扩展的代码质量检查框架。

#### 3.1.1 基类设计 (`scripts/guards/base.py`)

核心数据结构：

```
Finding         -- 单个检查发现
  .severity     -- 严重程度（"error" / "warning"）
  .path         -- 文件路径
  .message      -- 描述信息
  .line         -- 行号（可选）

GuardResult     -- 守卫执行结果
  .guard_id     -- 守卫标识
  .description  -- 描述
  .findings     -- 发现列表
  .notes        -- 附注
  .has_errors   -- 是否包含 error 级别发现

GuardContext    -- 守卫执行上下文
  .repo_root    -- 仓库根目录
  .candidate_files()  -- 惰性加载的候选文件列表
```

辅助功能：
- `build_context()`：构建上下文，自动定位仓库根目录
- `make_result()`：创建守卫结果的工厂方法
- `run_git()`：执行 git 命令并返回输出行
- `is_text_file()`：通过检查前 2048 字节中是否含 `\x00` 判断文本文件
- `read_text_lines()`：读取文件行（UTF-8，含错误容忍）
- `_collect_candidate_files()`：收集 git tracked + untracked 的所有文件

#### 3.1.2 注册表机制 (`scripts/guards/registry.py`)

使用字典注册所有守卫：

```python
REGISTRY: dict[str, tuple[str, GuardRunner]] = {
    "no-secrets-in-repo": (DESCRIPTION, run),
    "db-artifacts-guard": (DESCRIPTION, run),
    "deployment-security-guard": (DESCRIPTION, run),
    "backend-no-print-guard": (DESCRIPTION, run),
    "no-direct-llm-call-in-api": (DESCRIPTION, run),
    "file-line-count-guard": (DESCRIPTION, run),
    "prompt-preset-integrity-guard": (DESCRIPTION, run),
}
```

`GuardRunner` 类型定义为 `Callable[[GuardContext], GuardResult]`。

#### 3.1.3 守卫运行入口 (`scripts/guards/run.py`)

**CLI 用法：**
```bash
python scripts/guards/run.py               # 运行全部守卫
python scripts/guards/run.py guard-id       # 运行指定守卫
python scripts/guards/run.py --list         # 列出所有守卫
```

**输出格式：**
```
[PASS] guard-id - description
  no findings
[FAIL] guard-id - description
  - ERROR path/to/file:42 :: message
```

退出码：0 = 全部通过，1 = 存在 error 级别发现，2 = 未知守卫 ID。

### 3.2 七个守卫详解

#### 3.2.1 无密钥泄露守卫 (`no-secrets-in-repo`)

文件路径：`scripts/guards/no_secrets_in_repo.py`

**检查逻辑：**

1. **文件名检查**：扫描所有候选文件，禁止以下文件可见于 git：
   - `.env`、`.env.*`（除 `.env.example` 和 `.env.docker.example`）
   - `*.pem`、`*.key`、`*.p12`
   - `id_rsa`、`id_ed25519`

2. **内容检查**：对非排除路径的文本文件扫描以下正则模式：
   - `openai_like_key`：`sk-[A-Za-z0-9]{10,}` 格式的 OpenAI 风格密钥
   - `google_api_key`：`AIza[0-9A-Za-z_-]{20+}` 格式的 Google API Key
   - `bearer_token`：`Bearer [16+字符]` 格式的 Bearer 令牌
   - `api_key_literal`：`api_key = "value"` 格式的字面量

3. **排除范围**：
   - `backend/tests/`、`test/`、`issues/`、`plan/` 目录
   - `.md` 文件
   - 占位符值（dummy、masked、example、changeme、`<`、`***` 等）

#### 3.2.2 数据库产物守卫 (`db-artifacts-guard`)

文件路径：`scripts/guards/db_artifacts_guard.py`

**检查逻辑：** 阻止以下文件进入 git 可见路径：

- 数据库文件：`.db`、`.db-wal`、`.db-shm`、`.db-journal`、`.sqlite`/`.sqlite3` 及其 WAL/SHM/Journal 变体
- 日志文件：`.log`、`.err.log`、`.out.log`、`.trace`
- 临时文件：`tmp_*`、`.tmp_*` 前缀
- 临时目录：`test/.artifacts/`、`test/.tmp/` 路径

**特点：** 同时检查 tracked 和 untracked 文件，能在 commit 前捕获新创建的产物。

#### 3.2.3 部署安全守卫 (`deployment-security-guard`)

文件路径：`scripts/guards/deployment_security_guard.py`

**检查逻辑：** 验证生产部署配置文件和文档的一致性，通过子字符串检查确保：

对 `docker-compose.prod.yml`：
- `APP_ENV: prod` 出现 2 次（backend + rq_worker）
- `AUTH_DEV_FALLBACK_USER_ID: ""` 出现 2 次
- backend 端口绑定 `127.0.0.1`
- `SECRET_ENCRYPTION_KEY` 和 `AUTH_SESSION_SIGNING_KEY` 各使用 `?` 语法（各 2 次）
- `CORS_ORIGINS` 和 `AUTH_ADMIN_PASSWORD` 使用 `?` 语法
- Postgres/Redis 端口使用 `!reset []` 移除（各 1 次）

对文档和代码：
- `docs/deployment/security-checklist.md` 包含环境变量契约文档和守卫引用
- `docs/deployment/docker-compose-prod.md` 包含合并配置命令和回环绑定说明
- `backend/app/main.py` 包含 `settings.app_env == "prod"` 运行时检查

#### 3.2.4 后端无 print 守卫 (`backend-no-print-guard`)

文件路径：`scripts/guards/backend_no_print_guard.py`

**检查逻辑：** 扫描 `backend/app/` 下所有 `.py` 文件，检查是否包含 `print(` 调用。

- 严重级别：`error`
- 建议：使用结构化日志（loguru/logging）替代 print

**设计意图：** 生产环境中 print 输出不受日志系统控制，无法被日志聚合工具采集和过滤。

#### 3.2.5 API 层无直接 LLM 调用守卫 (`no-direct-llm-call-in-api`)

文件路径：`scripts/guards/no_direct_llm_call_in_api.py`

**检查逻辑：** 扫描 `backend/app/api/routes/` 下所有 `.py` 文件，检测三类禁止模式：

1. 直接导入 LLM 客户端：`from app.llm.client import ... call_llm/call_llm_messages/call_llm_stream_messages`
2. 直接导入生成服务 LLM 函数：`from app.services.generation_service import ... call_llm_and_record/prepare_llm_call`
3. 直接调用 LLM 步骤函数：`call_llm_messages`、`call_llm_stream_messages`、`run_*llm_step` 等

**遗留豁免：** 以下路由文件处于 warning-only 模式（Wave A 过渡期）：
- `chapter_analysis.py`
- `chapters.py`
- `llm.py`
- `memory.py`
- `outline.py`

非豁免文件中的匹配则报 error。

#### 3.2.6 文件行数守卫 (`file-line-count-guard`)

文件路径：`scripts/guards/file_line_count_guard.py`

**检查逻辑：**
- 扫描 `backend/app/` 下所有 `.py` 文件
- 超过 400 行的文件标记为 `warning`
- 仅显示前 20 个最大的文件（按行数降序）
- 当前为 warning-only 模式，不阻止提交

**设计意图：** 在强制拆分前先可视化"热点"文件，后续可提升为 error 级别。

#### 3.2.7 提示词预设完整性守卫 (`prompt-preset-integrity-guard`)

文件路径：`scripts/guards/prompt_preset_integrity_guard.py`

**检查逻辑：** 调用后端 `app.services.prompt_preset_integrity.collect_prompt_preset_integrity()` 函数，验证：

1. 预设资源文件的结构完整性
2. 模板绑定正确性
3. 高价值金丝雀检查（canary）：
   - 特定资源键/模板块的存在性
   - 必需子字符串的存在性
   - 模板渲染是否出错

输出包含：检查的资源数量、金丝雀数量、以及具体的失败详情。

---

## 4. 交付门控与回归测试

### 4.1 门控运行器 (`scripts/run_gate.py`)

文件路径：`scripts/run_gate.py`

分层交付门控系统，按风险递增顺序组织验证步骤。

**五个门控层（Layer）：**

| 层名 | 覆盖范围 | 典型耗时 | 用途 |
|------|---------|---------|------|
| `smoke` | config, prompt, route, task | 快 | 每次提交前跑 |
| `contract` | route, task, config, prompt | 中 | 合并前跑 |
| `critical` | route, task, config, prompt | 较长 | 关键路径验证 |
| `full` | route, task, config, prompt | 长 | 完整回归 |
| `perf-smoke` | route, task, config, prompt | 变化 | 性能基线 |

**smoke 层步骤：**
1. `backend-quality`：compileall + ruff + 所有 guards
2. `backend-contract-smoke`：核心契约单元测试（LLM 配置注册、审计、路由、预设完整性、环境契约、安全守卫）
3. `frontend-lint`：ESLint + Prettier
4. `frontend-unit-smoke`：路由/认证/章节/提示词烟雾测试
5. `playwright-api-smoke`：API 黑盒烟雾测试
6. `playwright-ui-smoke`：UI 导航烟雾测试

**contract 层步骤：**
1. `backend-contract-suite`：预设解析器、配置文件同步、提示词资源、认证会话等
2. `playwright-api-contracts`：章节元数据、生成运行、任务运行时、提示词预览/可达性
3. `db-schema-contract`：数据库 schema 契约检查

**critical 层步骤：**
1. `backend-full-suite`：全量 unittest discover
2. `frontend-lint-full` + `frontend-unit-full` + `frontend-build`
3. `db-snapshot`：schema 快照验证
4. `playwright-critical-ui`：任务中心、SSE、批量生成、提示词工作室、写作自动更新

**full 层步骤：**
- 包含 critical 层所有步骤 + 全量 Playwright 回归

**perf-smoke 层步骤：**
- 性能基线测试（quick 场景）

**CLI 用法：**
```bash
python scripts/run_gate.py --layer smoke              # 运行 smoke 层
python scripts/run_gate.py --layer smoke --layer contract  # 运行多层
python scripts/run_gate.py --list                      # 列出所有层和步骤
python scripts/run_gate.py --dry-run                   # 仅打印命令
```

### 4.2 回归测试运行器 (`scripts/run_regression.py`)

文件路径：`scripts/run_regression.py`

在 run_gate.py 基础上构建的回归测试配置器。

**预定义 Profile：**

| Profile | 门控层 | 用途 |
|---------|-------|------|
| `prepush` | smoke -> contract | Push 前验证 |
| `release` | critical | 发布验证 |
| `full` | full | 完整回归 |

**CLI 用法：**
```bash
python scripts/run_regression.py --profile prepush     # 默认
python scripts/run_regression.py --profile release
python scripts/run_regression.py --layers smoke,contract,critical  # 自定义层组合
python scripts/run_regression.py --list                # 列出 profile
```

### 4.3 后端质量门控 (`backend/scripts/run_quality_gate.py`)

文件路径：`backend/scripts/run_quality_gate.py`

后端内部质量门控脚本，按顺序执行：
1. `compileall -q app alembic tests scripts ..\scripts\guards` -- 编译检查
2. `ruff check app tests scripts ..\scripts\guards` -- 代码风格检查
3. `scripts\guards\run.py` -- 全部质量守卫

---

## 5. 后端测试

### 5.1 测试框架

- 框架：Python 标准库 `unittest`
- 无 conftest.py 或 __init__.py（直接 discover）
- 运行命令：`python -m unittest discover -s tests -p "test_*.py" -v`
- 测试文件位于 `backend/tests/` 目录

### 5.2 测试分类总览

后端共有约 130 个测试文件，按功能域分类如下：

#### 5.2.1 认证与用户管理

| 文件 | 测试内容 |
|------|---------|
| `test_admin_bootstrap_fail_soft.py` | 管理员引导失败时的优雅降级 |
| `test_admin_user_stats.py` | 管理员用户统计 |
| `test_auth_session.py` | 认证会话管理 |
| `test_linuxdo_oidc_endpoints.py` | LinuxDo OIDC 端点 |
| `test_rbac_project_memberships.py` | 基于角色的项目成员权限 |
| `test_user_usage_stats.py` | 用户使用统计 |
| `test_migrations_admin_user_stats.py` | 管理员统计迁移 |
| `test_migrations_idempotent_user_passwords.py` | 密码迁移幂等性 |

#### 5.2.2 LLM 提供商与客户端

| 文件 | 测试内容 |
|------|---------|
| `test_anthropic_max_tokens_retry.py` | Anthropic max_tokens 超限自动重试 |
| `test_anthropic_thinking_non_stream.py` | Anthropic 非流式思考模式 |
| `test_gemini_api_key_header.py` | Gemini API Key 请求头 |
| `test_gemini_thinking_config_non_stream.py` | Gemini 思考配置非流式 |
| `test_openai_chat_extra_params.py` | OpenAI 额外参数传递 |
| `test_openai_downgrade_retry.py` | OpenAI 降级重试 |
| `test_openai_responses_api.py` | OpenAI Responses API 兼容性 |
| `test_llm_retry.py` | LLM 通用重试逻辑 |
| `test_llm_http_client_env_proxy.py` | LLM HTTP 客户端环境代理 |
| `test_llm_client_logging.py` | LLM 客户端日志 |
| `test_llm_models_route.py` | LLM 模型列表路由 |
| `test_llm_test_app_service.py` | LLM 测试应用服务 |
| `test_llm_test_endpoint_retry_details.py` | LLM 测试端点重试详情 |

#### 5.2.3 LLM 配置与契约

| 文件 | 测试内容 |
|------|---------|
| `test_llm_config_registry.py` | LLM 配置注册表 |
| `test_llm_config_audit.py` | LLM 配置审计 |
| `test_llm_contract_routes.py` | LLM 契约路由 |
| `test_llm_profile_sync_preset_defaults.py` | LLM Profile 同步预设默认值 |
| `test_llm_task_preset_resolver.py` | LLM 任务预设解析器 |
| `test_llm_task_presets_routes.py` | LLM 任务预设路由 |

#### 5.2.4 提示词系统

| 文件 | 测试内容 |
|------|---------|
| `test_prompt_preset_integrity.py` | 提示词预设完整性 |
| `test_prompt_preset_resources.py` | 提示词预设资源加载 |
| `test_prompt_preset_reset_endpoints.py` | 提示词预设重置端点 |
| `test_prompt_block_cache.py` | 提示词块缓存 |
| `test_prompt_task_reachability_registry.py` | 提示词任务可达性注册 |
| `test_prompt_route_helpers.py` | 提示词路由辅助函数 |
| `test_prompting_safe_template.py` | 安全模板渲染 |

#### 5.2.5 章节生成与分析

| 文件 | 测试内容 |
|------|---------|
| `test_chapter_generation_app_service.py` | 章节生成应用服务 |
| `test_chapter_generation_stream_service.py` | 章节流式生成服务 |
| `test_chapter_generate_stream_keepalive.py` | 流式生成保活 |
| `test_chapter_analysis_app_service.py` | 章节分析应用服务 |
| `test_chapter_bulk_create_schema_limits.py` | 批量创建 schema 限制 |
| `test_chapter_trigger_auto_updates_endpoint.py` | 章节触发自动更新端点 |
| `test_chapters_meta_contract.py` | 章节元数据契约 |
| `test_content_optimize_contract.py` | 内容优化契约 |
| `test_post_edit_validation.py` | 后编辑验证 |
| `test_plot_analysis_apply.py` | 剧情分析应用 |

#### 5.2.6 记忆系统

| 文件 | 测试内容 |
|------|---------|
| `test_memory_auto_update_app_service.py` | 记忆自动更新服务 |
| `test_memory_preview_endpoints.py` | 记忆预览端点 |
| `test_memory_query_service.py` | 记忆查询服务 |
| `test_memory_update_v1_endpoints.py` | 记忆更新 v1 端点 |
| `test_memory_task_retry_endpoint.py` | 记忆任务重试端点 |
| `test_memory_task_status_compat.py` | 记忆任务状态兼容性 |
| `test_memory_task_worker_app_error.py` | 记忆任务 worker 错误处理 |
| `test_memory_route_helpers.py` | 记忆路由辅助 |
| `test_memory_route_story_helpers.py` | 情节记忆路由辅助 |
| `test_memory_route_structured_helpers.py` | 结构化记忆路由辅助 |
| `test_structured_memory_restore_on_create.py` | 结构化记忆创建时恢复 |
| `test_fractal_memory_service.py` | 分形记忆服务 |
| `test_output_contract_memory_update_ops_empty.py` | 记忆更新空操作契约 |
| `test_output_contract_memory_update_validation_details.py` | 记忆更新验证详情 |

#### 5.2.7 世界书系统

| 文件 | 测试内容 |
|------|---------|
| `test_worldbook_auto_update_apply_ops.py` | 世界书自动更新操作应用 |
| `test_worldbook_auto_update_chapter_input.py` | 世界书自动更新章节输入 |
| `test_worldbook_auto_update_contract.py` | 世界书自动更新契约 |
| `test_worldbook_auto_update_existing_entries_preview.py` | 现有条目预览 |
| `test_worldbook_auto_update_service_repair.py` | 世界书自动更新修复 |
| `test_worldbook_auto_update_task_error_details.py` | 世界书任务错误详情 |
| `test_worldbook_auto_update_task_scheduling.py` | 世界书任务调度 |
| `test_worldbook_route_import_export.py` | 世界书导入导出路由 |
| `test_worldbook_route_preview_mutations.py` | 世界书预览变更路由 |
| `test_worldbook_service_trigger.py` | 世界书服务触发 |
| `test_output_contract_worldbook_auto_update_validation_details.py` | 世界书验证详情 |

#### 5.2.8 图谱系统

| 文件 | 测试内容 |
|------|---------|
| `test_graph_auto_update_service.py` | 图谱自动更新服务 |
| `test_graph_auto_update_task_error_details.py` | 图谱任务错误详情 |
| `test_graph_auto_update_trigger_endpoint.py` | 图谱更新触发端点 |
| `test_graph_context_deterministic_order.py` | 图谱上下文确定性排序 |
| `test_graph_context_error_sanitization.py` | 图谱上下文错误净化 |
| `test_graph_context_perf_matching.py` | 图谱上下文性能匹配 |
| `test_graph_context_prompt_block_limits.py` | 图谱上下文提示词块限制 |
| `test_characters_auto_update_service.py` | 角色自动更新服务 |

#### 5.2.9 表格系统

| 文件 | 测试内容 |
|------|---------|
| `test_table_ai_update_service.py` | 表格 AI 更新服务 |
| `test_table_ai_update_service_repair.py` | 表格 AI 更新修复 |
| `test_table_ai_update_llm_error_run_id.py` | 表格 AI 更新 LLM 错误运行 ID |
| `test_table_ai_update_prompt_numeric_focus.py` | 表格数值焦点提示 |
| `test_table_ai_update_task_error_details.py` | 表格任务错误详情 |
| `test_table_ai_update_timeout_retry.py` | 表格更新超时重试 |
| `test_table_auto_update_task_scheduling.py` | 表格自动更新调度 |
| `test_table_update_v1_ops_empty.py` | 表格更新空操作 |
| `test_table_route_helpers.py` | 表格路由辅助 |
| `test_tables_schema_alias.py` | 表格 schema 别名 |

#### 5.2.10 向量检索 (RAG)

| 文件 | 测试内容 |
|------|---------|
| `test_vector_chroma_collection_naming.py` | Chroma 集合命名 |
| `test_vector_embedding_dry_run_endpoint.py` | 嵌入空跑端点 |
| `test_vector_hybrid_rrf.py` | 混合 RRF 检索 |
| `test_vector_pgvector_integration.py` | pgvector 集成 |
| `test_vector_priority_retrieval.py` | 优先级检索 |
| `test_vector_rag_failsoft.py` | RAG 失败软降级 |
| `test_vector_rerank.py` | 重排序 |
| `test_vector_rerank_dry_run_endpoint.py` | 重排序空跑端点 |
| `test_vector_routes_rerank_overrides.py` | 重排序路由覆盖 |
| `test_vector_super_sort_override.py` | 超级排序覆盖 |
| `test_embedding_service.py` | 嵌入服务 |
| `test_rerank_service_external_project_config.py` | 外部项目重排序配置 |

#### 5.2.11 任务队列与批量生成

| 文件 | 测试内容 |
|------|---------|
| `test_task_queue_rq.py` | RQ 任务队列 |
| `test_task_queue_dev_fallback.py` | 开发模式任务队列回退 |
| `test_task_queue_inline_concurrency.py` | 内联队列并发 |
| `test_batch_generation_runtime_linkage.py` | 批量生成运行时关联 |
| `test_batch_generation_worker_pause_recovery.py` | 批量生成暂停恢复 |
| `test_batch_generation_worker_terminal_noop.py` | 批量生成终端空操作 |
| `test_project_task_dedupe_chapter_done.py` | 项目任务去重 |
| `test_project_task_events_service.py` | 项目任务事件服务 |
| `test_project_task_events_sse_endpoint.py` | 项目任务 SSE 端点 |
| `test_project_task_runtime_reconcile.py` | 项目任务运行时协调 |
| `test_project_task_runtime_view.py` | 项目任务运行时视图 |
| `test_project_task_worker_app_error.py` | 项目任务 worker 错误 |
| `test_project_task_worker_noop.py` | 项目任务 worker 空操作 |
| `test_project_tasks_endpoints.py` | 项目任务端点 |

#### 5.2.12 安全与加密

| 文件 | 测试内容 |
|------|---------|
| `test_secrets_crypto.py` | Fernet/DPAPI 加密解密 |
| `test_secrets_redaction.py` | 密钥脱敏 |
| `test_settings_api_key_redaction.py` | API Key 脱敏 |
| `test_logging_redaction.py` | 日志脱敏 |
| `test_security_guard_runner.py` | 安全守卫运行器 |

#### 5.2.13 配置与基础设施

| 文件 | 测试内容 |
|------|---------|
| `test_config_cors_origins_prod_guard.py` | 生产 CORS 来源校验 |
| `test_config_database_url.py` | 数据库 URL 配置 |
| `test_config_env_contract.py` | 环境变量契约 |
| `test_app_error_str.py` | 应用错误字符串表示 |
| `test_request_id_context_reset.py` | 请求 ID 上下文重置 |
| `test_request_schema_fail_closed_phase1.py` | 请求 schema 失败关闭 |
| `test_request_size_limits.py` | 请求大小限制 |
| `test_logging_setup.py` | 日志设置 |
| `test_streaming_support.py` | 流式支持 |
| `test_gate_runner.py` | 门控运行器自测 |
| `test_real_llm_failure_fixtures.py` | 真实 LLM 失败 fixture |
| `test_sqlite_datetime_compat.py` | SQLite 日期兼容性 |
| `test_run_store_retry.py` | 运行存储重试 |

#### 5.2.14 其他功能

| 文件 | 测试内容 |
|------|---------|
| `test_outline_generation_guidance.py` | 大纲生成引导 |
| `test_outline_large_payload_endpoints.py` | 大纲大 payload 端点 |
| `test_outline_manual_json_parse_endpoints.py` | 大纲手动 JSON 解析 |
| `test_outline_schema_limits.py` | 大纲 schema 限制 |
| `test_outline_stream_helpers.py` | 大纲流式辅助 |
| `test_plot_auto_update_service.py` | 剧情自动更新服务 |
| `test_plot_auto_update_task_error_details.py` | 剧情更新任务错误 |
| `test_project_bundle_roundtrip.py` | 项目导入导出往返 |
| `test_project_seed_service_numeric_tables.py` | 项目种子数据表 |
| `test_search_fuzzy_query.py` | 模糊搜索查询 |
| `test_search_index_service.py` | 搜索索引服务 |
| `test_search_query_endpoint.py` | 搜索查询端点 |
| `test_glossary_query_expand.py` | 术语查询展开 |
| `test_json_repair_service.py` | JSON 修复服务 |
| `test_annotations_service.py` | 批注服务 |
| `test_mcp_research_step.py` | MCP 研究步骤 |

---

## 6. 端到端测试 (E2E)

### 6.1 测试基础设施

#### 6.1.1 Playwright 配置 (`test/playwright.config.ts`)

文件路径：`test/playwright.config.ts`

```typescript
{
  testDir: "./specs",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,         // 2 分钟
  expect: { timeout: 15_000 },
  projects: [
    { name: "ui-chromium", testDir: "specs/ui", use: devices["Desktop Chrome"] },
    { name: "api", testDir: "specs/api", use: { baseURL: backendUrl } },
    { name: "db", testDir: "specs/db", use: { baseURL: backendUrl } },
  ],
}
```

三个测试项目：
- **ui-chromium**：UI 测试，使用 Chromium 桌面浏览器
- **api**：API 契约测试，直接请求后端
- **db**：数据库契约测试

配置特点：
- 单 worker 串行执行（避免数据竞争）
- 失败时保留 trace/截图/录制
- HTML 报告输出到 `.artifacts/playwright-report`

#### 6.1.2 性能测试配置 (`test/playwright.perf.config.ts`)

文件路径：`test/playwright.perf.config.ts`

```typescript
{
  testDir: "./perf",
  timeout: 600_000,     // 10 分钟
  trace: "off",
  screenshot: "off",
  video: "off",
}
```

性能测试关闭所有调试产物以减少干扰。

#### 6.1.3 全局 Setup (`test/global-setup.ts`)

文件路径：`test/global-setup.ts`

**启动顺序：**
1. 清理上次运行残留（读取 `.tmp/state.json`，kill 旧 PID）
2. 检查端口可用性（Mock LLM、Backend、Frontend），端口冲突时自动分配
3. 启动 Mock LLM 服务器（Node.js）
4. 启动 Backend（uvicorn，使用临时 SQLite 数据库 `ainovel.e2e.<timestamp>.db`）
5. 启动 Frontend 开发服务器（npm run dev）
6. 等待各服务健康端点就绪
7. 保存运行状态到 `.tmp/state.json`

后端 E2E 环境变量：
- `APP_ENV=dev`
- `TASK_QUEUE_BACKEND=inline`（内联执行，不需要 Redis）
- `DATABASE_URL=sqlite:///./.tmp_test/ainovel.e2e.<ts>.db`
- `AUTH_ADMIN_USER_ID=admin / AUTH_ADMIN_PASSWORD=admin-pass`

#### 6.1.4 全局 Teardown (`test/global-teardown.ts`)

文件路径：`test/global-teardown.ts`

读取 `.tmp/state.json`，终止所有进程（Windows 用 `taskkill /T /F`，Unix 用 `SIGTERM`）。

#### 6.1.5 Mock LLM 服务器 (`test/mock-llm/server.js`)

文件路径：`test/mock-llm/server.js`

纯 Node.js HTTP 服务器，模拟多种 LLM 提供商 API：

| 端点 | 模拟目标 |
|------|---------|
| `POST /v1/chat/completions` | OpenAI Chat Completions（支持流式） |
| `POST /v1/messages` | Anthropic Messages API |
| `POST /v1beta/models/:model:generateContent` | Google Gemini API |
| `POST /v1/embeddings` | OpenAI Embeddings API |
| `POST /v1/rerank` | Rerank API |
| `GET /health` | 健康检查 |
| `GET /debug/stats` | 调试统计（嵌入/重排序调用次数） |
| `POST /debug/reset` | 重置统计 |

**智能响应路由：** 根据 prompt 内容关键词选择不同的输出：
- 含"润色器" -> 润色后内容（`<rewrite>` 标签）
- 含"优化器" -> 优化后内容（`<content>` 标签）
- 含"outline_md" -> 大纲 JSON
- 含"<<<content" -> 流式章节内容（含 `<<<CONTENT>>>` 和 `<<<SUMMARY>>>` 分隔符）
- 含"chapter_summary" -> 章节分析 JSON
- 含"memory_update_v1" -> 记忆更新 JSON
- 含"table_update_v1" -> 表格更新 JSON
- 含"worldbook_auto_update_v1" -> 世界书更新 JSON
- 含"<plan>" -> 规划内容
- 默认 -> "E2E mock response."

嵌入向量使用 SHA-256 哈希生成 64 维确定性向量。重排序使用哈希生成确定性分数，支持 `E2E_RERANK_REVERSE` 标记反转排序。

### 6.2 测试库

#### 6.2.1 状态管理 (`test/lib/state.ts`)

定义 `E2EState` 类型，管理运行时状态（URL、PID、数据库路径）的序列化/反序列化。

#### 6.2.2 路径工具 (`test/lib/paths.ts`)

`findRepoRoot()`：从测试目录向上搜索包含 `backend/` 和 `frontend/` 的根目录。

#### 6.2.3 进程工具 (`test/lib/proc.ts`)

`spawnLogged()`：启动子进程并将 stdout/stderr 重定向到日志文件。处理 Windows/Unix 平台差异。

#### 6.2.4 网络工具 (`test/lib/net.ts`)

- `getFreePort()`：获取空闲端口
- `assertPortFree()`：断言端口可用（支持重试和友好提示）
- `waitForHttpOk()`：轮询 HTTP 端点直到返回 200

#### 6.2.5 网络出口守卫 (`test/lib/network-guard.ts`)

`installNetworkEgressGuard()`：拦截所有浏览器网络请求，仅允许 `127.0.0.1`、`localhost`、`::1` 和 `data:`/`blob:`/`about:` 协议。阻止 UI 测试意外访问外部网络。

#### 6.2.6 引导工具 (`test/lib/bootstrap.ts`)

`bootstrapProject()`：通过 API 创建 LLM Profile + Project + 绑定，返回 `projectId` 和 `profileId`。用于测试前快速准备数据。

#### 6.2.7 UI 测试基类 (`test/lib/ui-test.ts`)

扩展 Playwright test fixture，自动在每个测试前安装网络出口守卫。提供世界书相关的辅助函数（等待页面就绪、获取条目卡片、等待批量选中计数）。

### 6.3 测试规格文件

#### 6.3.1 API 契约测试 (`test/specs/api/`)

| 文件 | 测试内容 |
|------|---------|
| `api-smoke.spec.ts` | API 烟雾测试 |
| `auth-rbac.contract.spec.ts` | RBAC 权限契约 |
| `admin-users-stats.contract.spec.ts` | 管理员统计契约 |
| `batch-generation-cancel.contract.spec.ts` | 批量生成取消 |
| `batch-generation-sequential-gap.contract.spec.ts` | 批量生成序列间隙 |
| `bulk-create-replace.contract.spec.ts` | 批量创建替换 |
| `chapter-analyze-auto-memory-update.contract.spec.ts` | 章节分析自动更新 |
| `chapter-analysis.contract.spec.ts` | 章节分析 |
| `chapter-generate-precheck.contract.spec.ts` | 章节生成预检查 |
| `chapter-generate-stream-prereq.contract.spec.ts` | 章节流式生成前置条件 |
| `chapters-meta.contract.spec.ts` | 章节元数据 |
| `embedding-provider-failsoft.contract.spec.ts` | 嵌入提供商失败软降级 |
| `export.contract.spec.ts` | 导出功能 |
| `fractal-v2.contract.spec.ts` | 分形记忆 v2 |
| `generation-runs.contract.spec.ts` | 生成运行记录 |
| `generation-runs-prompt-inspector.contract.spec.ts` | 提示词检查器 |
| `graph-query.contract.spec.ts` | 图谱查询 |
| `memory-preview.contract.spec.ts` | 记忆预览 |
| `memory-retrieve.contract.spec.ts` | 记忆检索 |
| `multikb.contract.spec.ts` | 多知识库 |
| `outline-missing-preset.contract.spec.ts` | 大纲缺失预设 |
| `plan-chapter.contract.spec.ts` | 章节规划 |
| `prompt-preview.contract.spec.ts` | 提示词预览 |
| `prompt-presets-export-all.contract.spec.ts` | 提示词预设全量导出 |
| `prompt-task-reachability.contract.spec.ts` | 提示词任务可达性 |
| `project-task-runtime.contract.spec.ts` | 项目任务运行时 |
| `style-profiles.contract.spec.ts` | 风格配置 |
| `tables.contract.spec.ts` | 表格系统 |
| `taskcenter-structured-memory.contract.spec.ts` | 任务中心结构化记忆 |
| `vector-datalifecycle.contract.spec.ts` | 向量数据生命周期 |
| `vector-multichunk.contract.spec.ts` | 向量多分片 |
| `vector-status.contract.spec.ts` | 向量状态 |
| `worldbook-bulk.contract.spec.ts` | 世界书批量操作 |
| `worldbook-import-export.contract.spec.ts` | 世界书导入导出 |
| `worldbook-preview.contract.spec.ts` | 世界书预览 |

#### 6.3.2 数据库契约测试 (`test/specs/db/`)

| 文件 | 测试内容 |
|------|---------|
| `db-schema.spec.ts` | 数据库 Schema 结构契约 |

#### 6.3.3 UI 测试 (`test/specs/ui/`)

| 文件 | 测试内容 |
|------|---------|
| `a11y-form-fields.spec.ts` | 无障碍表单字段 |
| `admin-users.spec.ts` | 管理员用户管理 |
| `auth-form-submit.spec.ts` | 认证表单提交 |
| `blocker-warning.spec.ts` | 阻断警告 |
| `chapter-analysis-annotations-grouping.spec.ts` | 章节分析批注分组 |
| `chapter-analysis-apply.spec.ts` | 章节分析应用 |
| `chapter-analysis-rewrite.spec.ts` | 章节分析重写 |
| `chapter-analysis-story-memory-crud.spec.ts` | 情节记忆 CRUD |
| `chapter-analysis-story-memory-merge.spec.ts` | 情节记忆合并 |
| `chapter-create-conflict.spec.ts` | 章节创建冲突 |
| `chapter-fallback.spec.ts` | 章节回退 |
| `chapter-reader.spec.ts` | 章节阅读器 |
| `chapter-stream.spec.ts` | 章节流式生成 |
| `chapter-stream-cancel.spec.ts` | 章节流式取消 |
| `chapter-stream-unsupported-provider.spec.ts` | 不支持的提供商 |
| `context-optimizer-toggle.spec.ts` | 上下文优化器切换 |
| `context-preview-sync.spec.ts` | 上下文预览同步 |
| `export-download.spec.ts` | 导出下载 |
| `foreshadow-drawer.spec.ts` | 伏笔抽屉 |
| `foreshadows-page.spec.ts` | 伏笔页面 |
| `fractal-page.spec.ts` | 分形页面 |
| `graph-auto-update-manual.spec.ts` | 图谱手动更新 |
| `graph-character-relations-editor.spec.ts` | 角色关系编辑器 |
| `graph-character-relations-rollback.spec.ts` | 角色关系回滚 |
| `graph-page.spec.ts` | 图谱页面 |
| `memory-context-preview.spec.ts` | 记忆上下文预览 |
| `memory-update.spec.ts` | 记忆更新 |
| `navigation.spec.ts` | 导航 |
| `outline-fallback.spec.ts` | 大纲回退 |
| `outline-stream.spec.ts` | 大纲流式生成 |
| `preview-navigation.spec.ts` | 预览导航 |
| `project-create.spec.ts` | 项目创建 |
| `prompt-inspector.spec.ts` | 提示词检查器 |
| `prompt-studio-import-export.spec.ts` | 提示词工作室导入导出 |
| `prompt-studio-import-export-all.spec.ts` | 提示词工作室全量导入导出 |
| `prompt-studio-preview.spec.ts` | 提示词工作室预览 |
| `prompt-studio-reorder.spec.ts` | 提示词工作室重排序 |
| `prompt-templates.spec.ts` | 提示词模板 |
| `prompts-rag-config.spec.ts` | 提示词 RAG 配置 |
| `rag-page.spec.ts` | RAG 页面 |
| `rag-rerank-external.spec.ts` | RAG 外部重排序 |
| `rag-story-memory-source.spec.ts` | RAG 情节记忆来源 |
| `search-page.spec.ts` | 搜索页面 |
| `settings-query-preprocess.spec.ts` | 设置查询预处理 |
| `settings-rerank-config.spec.ts` | 设置重排序配置 |
| `structured-memory.spec.ts` | 结构化记忆 |
| `style-global-selection-scrollbar.spec.ts` | 全局样式选择滚动条 |
| `style-profiles.spec.ts` | 风格配置 |
| `tables-injection.spec.ts` | 表格注入 |
| `tables-panel.spec.ts` | 表格面板 |
| `task-center.spec.ts` | 任务中心 |
| `taskcenter-projecttasks.spec.ts` | 任务中心项目任务 |
| `taskcenter-projecttasks-sse.spec.ts` | 任务中心 SSE |
| `toast-overflow.spec.ts` | Toast 溢出 |
| `batch-generation-runtime-sync.spec.ts` | 批量生成运行时同步 |
| `worldbook.spec.ts` | 世界书 |
| `worldbook-auto-update-failsoft.spec.ts` | 世界书自动更新失败软降级 |
| `worldbook-auto-update-success.spec.ts` | 世界书自动更新成功 |
| `worldbook-bulk-disable.spec.ts` | 世界书批量禁用 |
| `worldbook-import-export.spec.ts` | 世界书导入导出 |
| `worldbook-large-list-pagination.spec.ts` | 世界书大列表分页 |
| `writing-auto-updates-after-generate.spec.ts` | 写作后自动更新 |
| `writing-done-status.spec.ts` | 写作完成状态 |
| `writing-generate-validation-error.spec.ts` | 写作生成验证错误 |
| `writing-save-status.spec.ts` | 写作保存状态 |
| `writing-unsaved-confirm.spec.ts` | 未保存确认 |
| `xss-markdown.spec.ts` | XSS Markdown 防护 |

### 6.4 测试脚本

#### 6.4.1 数据库 Schema 快照 (`test/scripts/snapshot-db.ps1`)

文件路径：`test/scripts/snapshot-db.ps1`

1. 在 `backend/.tmp_test/` 创建全新 SQLite 数据库
2. 运行 `ensure_db_schema()` 创建当前版本 schema
3. 调用 `db_schema_snapshot.py snapshot` 生成 JSON 快照
4. 保存到 `test/contracts/db_schema.json`

#### 6.4.2 Schema 快照工具 (`test/scripts/db_schema_snapshot.py`)

文件路径：`test/scripts/db_schema_snapshot.py`

两个子命令：
- `snapshot --db X --out Y`：从数据库生成 schema JSON（表结构、外键、索引、CHECK 约束、触发器）
- `check --db X --baseline Y`：对比当前 schema 与基线 JSON，输出 unified diff

#### 6.4.3 性能基线脚本 (`test/scripts/run-perf-baseline.ps1`)

文件路径：`test/scripts/run-perf-baseline.ps1`

- 自动分配空闲端口避免冲突
- 支持 `quick` 和 `full` 两种场景
- 使用独立 `playwright.perf.config.ts` 配置

---

## 7. 代码质量工具

### 7.1 Ruff 配置 (`backend/ruff.toml`)

文件路径：`backend/ruff.toml`

```toml
line-length = 120
target-version = "py311"

[lint]
select = ["E9", "F63", "F7", "F82"]
```

启用的规则集：
- **E9**：运行时错误（语法错误等）
- **F63**：无效的 `assert` 字面量
- **F7**：非法语句位置
- **F82**：未定义名称

这是一个偏保守的规则集，仅捕获严重语法和导入错误，不涉及代码风格。

### 7.2 ESLint 配置 (`frontend/eslint.config.js`)

文件路径：`frontend/eslint.config.js`

使用 flat config 格式，应用于 `**/*.{ts,tsx}` 文件：

- `@eslint/js` recommended 规则
- `typescript-eslint` recommended 规则
- `eslint-plugin-react-hooks` 推荐配置
- `eslint-plugin-react-refresh` Vite 配置
- 忽略 `dist` 目录
- ECMAScript 2020 语法，浏览器全局变量

### 7.3 Prettier 配置 (`frontend/.prettierrc.json`)

文件路径：`frontend/.prettierrc.json`

```json
{
  "printWidth": 120,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all"
}
```

- 行宽 120 字符
- 使用分号
- 使用双引号
- 尾随逗号（所有位置）

### 7.4 Alembic 配置 (`backend/alembic.ini`)

文件路径：`backend/alembic.ini`

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = sqlite:///./ainovel.db
```

- 迁移脚本位于 `backend/alembic/` 目录
- 默认连接 SQLite（运行时通过环境变量覆盖为 Postgres）
- 日志级别：root=WARN，alembic=INFO，sqlalchemy.engine=WARN

### 7.5 依赖管理

#### 7.5.1 运行时依赖 (`backend/requirements.txt`)

| 包 | 版本范围 | 用途 |
|----|---------|------|
| `alembic` | >=1.13,<2.0 | 数据库迁移 |
| `bcrypt` | >=4.0,<5.0 | 密码哈希 |
| `cryptography` | >=42.0,<47.0 | 加密（Fernet） |
| `fastapi` | >=0.115,<1.0 | Web 框架 |
| `httpx` | >=0.27,<1.0 | HTTP 客户端（LLM 调用） |
| `loguru` | >=0.7.3,<1.0 | 结构化日志 |
| `pydantic` | >=2.8,<3.0 | 数据验证 |
| `pydantic-settings` | >=2.4,<3.0 | 配置管理 |
| `pypinyin` | >=0.52,<1.0 | 拼音转换 |
| `python-dotenv` | >=1.0,<2.0 | 环境变量加载 |
| `redis` | >=6.0,<8.0 | Redis 客户端 |
| `rq` | >=2.0,<3.0 | 任务队列 |
| `psycopg2-binary` | >=2.9,<3.0 | PostgreSQL 驱动 |
| `sqlalchemy` | >=2.0,<3.0 | ORM |
| `uvicorn` | >=0.30,<1.0 | ASGI 服务器 |

#### 7.5.2 开发依赖 (`backend/requirements-dev.txt`)

```
-r requirements.txt
ruff>=0.11.11,<0.12.0
```

仅额外添加 Ruff 代码检查工具。

#### 7.5.3 锁定版本 (`backend/requirements.lock.txt`)

Docker 构建使用的精确版本锁定文件，例如：
- `FastAPI==0.127.1`
- `SQLAlchemy==2.0.45`
- `pydantic==2.12.5`
- `uvicorn==0.40.0`
- `redis==7.1.0`

---

## 8. Git 配置

### 8.1 .gitignore

文件路径：`.gitignore`

排除规则按类别组织：

| 类别 | 排除项 |
|------|-------|
| Python | `__pycache__/`、`*.py[cod]`、`.pytest_cache/`、`.mypy_cache/`、`.ruff_cache/`、`.venv/` |
| Node | `node_modules/`、`dist/`、`.vite/` |
| 数据库 | `*.db`、`*.db-*`、`*.sqlite*` 全系列（含 WAL/SHM/Journal） |
| 环境 | `backend/.env`、`frontend/.env`、`.env.docker`、`.env` |
| 日志 | `*.log`、`*.err.log`、`*.out.log` |
| 临时 | `tmp_*`、`.tmp_*`、`backend/.tmp*/`、`frontend/.tmp*/` |
| 测试产物 | `test/.artifacts/`、`test/.tmp/`、`test-results/`、`playwright-report/`、`*.trace` |
| IDE/OS | `.DS_Store`、`Thumbs.db`、`.idea/`、`.vscode/` |
| 特殊 | `/nul`（Windows PowerShell `> nul` 可能创建） |

### 8.2 .gitattributes

文件路径：`.gitattributes`

```
* text=auto eol=lf                    # 默认 LF
*.bat/*.cmd/*.ps1/*.psm1 text eol=crlf  # Windows 脚本 CRLF
*.png/*.jpg/... binary                 # 二进制文件
```

- 全仓库默认使用 LF 换行符
- Windows 脚本保持 CRLF
- 常见二进制格式标记为 binary（图片、字体、压缩包、音视频等）

---

## 9. AGENTS.md 说明

文件路径：`AGENTS.md`

为 AI 编码代理（如 Codex CLI）提供的开发约束和工作流规范。

### 9.1 核心约束

- **分支**：所有代码变更必须在 `test`（或 `test/*`）分支进行，禁止直接向 `dev`/`main` 提交
- **粒度**：Issue CSV 一行 = 一个 commit，代码变更与 CSV 状态更新同一 commit
- **范围**：KISS/YAGNI，不做无关重构
- **事实**：不假想测试通过/命令结果
- **安全**：不泄露密钥/令牌/个人数据，日志脱敏
- **SQLite**：单 worker，LLM 调用不持有长事务

### 9.2 技术栈

- **Frontend**：React + TypeScript + Vite + Tailwind
- **Backend**：FastAPI + SQLite/PostgreSQL + Alembic
- **E2E**：Playwright（`test/` 目录独立）

### 9.3 工作流

**E2E Loop**：plan -> issues -> implement -> test -> review -> commit -> regression

**Issue CSV 规范**：
- 位于 `issues/` 目录
- 状态枚举：`TODO | DOING | DONE`
- Test_Method 必须可执行/可复现
- ID 前缀约定：`LMEM-###`（长期记忆）、`MVP-###`（MVP 迭代）

**Git 工作流**：
- Commit message：`[<ID>] <Title>`
- 提交前自检：`git status / git diff`
- 必须同时提交代码和 CSV

**测试策略**：
- Backend：`compileall -q` + `unittest discover`
- Frontend：`npm run lint` + `npm test` + `npm run build`
- E2E：`cd test && npm test`

### 9.4 E2E 编写规则

- UI spec 从 `test/lib/ui-test` 导入（默认外网阻断）
- 选择器优先 `getByRole/getByLabel` 且 `exact: true`
- 不改业务代码做"测试专用逻辑"
- 不真实调用 LLM，统一走 Mock LLM

---

## 10. 后端脚本工具

### 10.1 RQ Worker 启动器 (`backend/scripts/run_rq_worker.py`)

文件路径：`backend/scripts/run_rq_worker.py`

- 从环境变量读取 Redis URL、队列名称、worker 名称
- 支持多进程模式：`RQ_WORKER_PROCESSES`（1-16）
- 单进程直接运行，多进程使用 `multiprocessing.Process` 分叉
- 自动导入 `app.services.project_task_service` 确保 RQ 能找到任务入口

### 10.2 质量门控 (`backend/scripts/run_quality_gate.py`)

文件路径：`backend/scripts/run_quality_gate.py`

三步串行执行：
1. `compileall -q app alembic tests scripts ..\scripts\guards`
2. `ruff check app tests scripts ..\scripts\guards`
3. `scripts\guards\run.py`（全部守卫）

### 10.3 LLM 契约审计 (`backend/scripts/audit_llm_contracts.py`)

文件路径：`backend/scripts/audit_llm_contracts.py`

审计 LLM 提供商/模型/能力/定价契约的一致性。支持 `--mode audit`（仅报告）和 `--mode enforce`（发现问题返回非零）。可选连接数据库审计已存储的 LLM Profile/Preset。

### 10.4 SQLite 到 Postgres 迁移 (`backend/scripts/migrate_sqlite_to_postgres.py`)

文件路径：`backend/scripts/migrate_sqlite_to_postgres.py`

功能完备的数据迁移脚本：

- 按固定表顺序迁移（18 张表），处理外键依赖
- 特殊处理 `projects.active_outline_id` 循环外键（先置空，outlines 迁移后回填）
- 安全检查：默认要求目标 DB 为空
- `--resume` 模式：ON CONFLICT DO NOTHING（幂等重试）
- `--dry-run` 模式：仅打印计划
- 迁移后验证：对比源/目标行数、样本哈希、外键一致性
- 生成 JSON 报告文件

### 10.5 LLM Profile 密钥迁移 (`backend/scripts/migrate_llm_profile_secrets.py`)

文件路径：`backend/scripts/migrate_llm_profile_secrets.py`

将 `llm_profiles.api_key_ciphertext` 从旧格式（plain/dpapi）迁移到 `enc:` 格式（Fernet 加密）：
- 跳过已是 `enc:` 格式的条目
- 解密 -> 重新加密 -> 更新 masked key
- 支持 `--dry-run`

### 10.6 OpenAI Responses API 验证 (`backend/scripts/verify_openai_responses_compatible.py`)

文件路径：`backend/scripts/verify_openai_responses_compatible.py`

端到端验证 OpenAI Responses 兼容提供商的连接性：
- 需要设置 `VERIFY_LLM_BASE_URL`、`VERIFY_LLM_MODEL`、`VERIFY_LLM_API_KEY`
- 测试 `call_llm`（同步）和 `call_llm_stream`（流式）两种模式
- 输出详细的错误信息和 dropped params

### 10.7 Anthropic max_tokens 重试验证 (`backend/scripts/verify_anthropic_max_tokens_retry.py`)

文件路径：`backend/scripts/verify_anthropic_max_tokens_retry.py`

使用 `httpx.MockTransport` 模拟 Anthropic 拒绝超大 max_tokens 的场景，验证客户端自动夹紧（clamp）到上游允许的最大值并重试。

### 10.8 项目任务摘要 (`backend/scripts/summarize_project_tasks.py`)

文件路径：`backend/scripts/summarize_project_tasks.py`

从 SQLite 数据库读取 `project_tasks` 表，生成统计报告：
- 按 kind 分组的状态计数
- 排队等待时间统计（avg/p50/p95/max）
- 运行时间统计
- 失败原因 Top 10
- 缺失 run_id 的失败任务计数

### 10.9 项目只读检查 (`backend/scripts/inspect_projects_readonly.py`)

文件路径：`backend/scripts/inspect_projects_readonly.py`

以只读模式连接 SQLite 数据库，列出项目表的基本信息（仅用于调试/排查）。

---

## 11. 后端资源文件

### 11.1 资源目录结构

```
backend/app/resources/
  prompt_presets/
    chapter_generate_v3/        # 章节生成 v3 预设
    chapter_generate_v4/        # 章节生成 v4 预设（推荐）
    chapter_analyze_v1/         # 章节分析预设
    chapter_rewrite_v1/         # 章节重写预设
    content_optimize_v1/        # 内容优化预设
    fractal_v2_v1/              # 分形记忆 v2 预设
    memory_update_v1/           # 记忆更新预设
    outline_generate_v3/        # 大纲生成 v3 预设
    plan_chapter_v1/            # 章节规划预设
    post_edit_v1/               # 后编辑（润色）预设
```

### 11.2 预设结构 (preset.json)

每个预设目录包含一个 `preset.json` 和 `templates/` 子目录。以 `chapter_generate_v4` 为例：

**preset.json 核心字段：**
- `schema_version`：Schema 版本号
- `name`：预设显示名（中文），如"默认 章节生成 v4（推荐）"
- `category`：分类（"正文"）
- `scope`：作用域（"project"）
- `version`：预设版本号
- `activation_tasks`：激活任务列表，如 `["chapter_generate"]`
- `upgrade_add_identifiers`：升级时自动添加的块标识符列表
- `blocks`：提示词块数组

**单个 Block 结构：**
```json
{
  "identifier": "sys.chapter.core_role",
  "name": "章节：核心角色与写作规则",
  "role": "system",
  "enabled": true,
  "template_file": "templates/sys.chapter.core_role.md",
  "marker_key": null,
  "injection_position": "relative",
  "injection_order": 10,
  "triggers": ["chapter_generate"],
  "forbid_overrides": false,
  "budget": { "priority": "must", "maxTokens": 1200 }
}
```

**budget.priority 等级：**
- `must`：必须包含，不可裁剪
- `important`：重要，可在 token 紧张时部分裁剪
- `optional`：可选，token 不足时优先丢弃

### 11.3 模板文件

模板文件位于各预设的 `templates/` 目录，命名约定：`{role}.{domain}.{block_name}.md`

常见分类：
- `sys.chapter.*`：章节生成核心规则（角色、契约、剧情工具）
- `sys.project.*`：项目素材（元信息、风格、约束、世界观、角色卡）
- `sys.story.*`：故事上下文（大纲、章节信息、前章、防重复、追加规则、智能上下文）
- `sys.memory.*`：记忆系统（世界书、情节记忆、结构化记忆、表格、向量、图谱、分形）
- `user.*`：用户指令块
- `doc.*`：文档块（disabled，不发送给 LLM）

### 11.4 预设覆盖的 LLM 任务类型

| 预设 | 任务类型 |
|------|---------|
| `chapter_generate_v3/v4` | 章节生成 |
| `chapter_analyze_v1` | 章节分析 |
| `chapter_rewrite_v1` | 章节重写 |
| `content_optimize_v1` | 内容优化 |
| `outline_generate_v3` | 大纲生成 |
| `plan_chapter_v1` | 章节规划 |
| `post_edit_v1` | 后编辑（润色） |
| `memory_update_v1` | 记忆更新 |
| `fractal_v2_v1` | 分形摘要 |
