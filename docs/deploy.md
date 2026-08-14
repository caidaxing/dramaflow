# Toonflow 一键部署指南（Docker / Phase 3 P3-1）

> 目标：让客户 **`docker compose up` 就能把整个平台跑起来**（后端 + 前端静态 + SQLite 单容器一体），并通过环境变量注入品牌（白标）配置。
> 部署包位于 `deploy/` 目录，构建产物不依赖本机 node/yarn（全部在 Docker 内完成）。

## 1. 目录结构

```
dramaflow/
├── .dockerignore            # 镜像构建上下文忽略规则（排除 frontend/、node_modules、运行时数据）
├── backend/                 # 后端源码（构建输入；data/ 下存放前端产物、vendor、模型等种子）
│   └── data/
│       ├── web/             # 前端构建产物（部署包的前端部分）
│       ├── vendor/          # 供应商模板源码（.ts）
│       ├── modelPrompt/     # 提示词模板（首次启动初始化）
│       └── models/          # RAG Embedding ONNX 模型（initDB 首次建表必需）
└── deploy/
    ├── Dockerfile           # 生产镜像（多阶段：builder 编译后端 bundle + runtime 一体）
    ├── docker-compose.yml   # 一键编排（端口、品牌环境变量、数据卷）
    ├── .env.example         # 配置模板（复制为 .env）
    ├── deploy.sh            # 一键部署
    ├── upgrade.sh           # 升级（备份 + 重建 + 滚动更新）
    ├── backup.sh            # 数据备份
    ├── restore.sh           # 数据恢复
    ├── docker-entrypoint.sh       # 容器入口（种子初始化 + ADMIN_PASSWORD）
    └── ensure-admin-password.cjs  # ADMIN_PASSWORD 覆盖脚本
```

## 2. 前置条件

- Docker Engine（含 compose v2，`docker compose version` 可用）
- 至少 4GB 空闲磁盘（镜像约 1.1GB，另含构建中间层）
- 端口 10588 空闲（或修改 `.env` 的 `APP_PORT`）
- **前端产物已构建**：`backend/data/web/index.html` 需存在。
  - 已随仓库提供时可直接使用；
  - 若缺失，执行（本机无需 node）：
    ```bash
    cd frontend
    docker run --rm -v "$PWD":/app -w /app node:24 \
      sh -c 'NODE_OPTIONS=--max-old-space-size=6144 yarn build-only'
    cp -a dist/. ../backend/data/web/
    ```
- **运行时种子资产**：`backend/data/models/`（Embedding ONNX 模型，首次建表必需）与
  `backend/data/modelPrompt/`（视频提示词模板）建议存在。`deploy.sh` 会在缺失时自动尝试从
  运行中的 `toonflow` 容器复制；若取不到会给出警告（可用
  `docker cp <平台容器>:/app/data/models/. backend/data/models/` 补齐）。

## 3. 一键部署

```bash
cd deploy
./deploy.sh
```

脚本会自动：
1. 无 `.env` 时从 `.env.example` 生成默认配置；
2. 校验 `backend/data/web/index.html`，缺失时尝试从 `frontend/dist` 复制；
3. `docker compose build && up -d`；
4. 打印访问地址与默认账号。

**首次构建耗时**：约 3~6 分钟（下载依赖 + 编译原生模块 + esbuild 打包）。之后增量构建秒级。

### 手动方式

```bash
cd deploy
cp .env.example .env      # 按需修改
docker compose up -d --build
```

## 4. 环境变量（品牌/白标）

编辑 `deploy/.env` 后 `docker compose up -d` 生效（`initDB` 启动时自动覆盖数据库 `o_site_config`）：

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `APP_PORT` | 宿主机映射端口（容器内固定 10588） | `10588` |
| `SITE_NAME` | 站点名称 | `ToonFlow` |
| `LOGO_URL` | Logo 图片 URL | 空 |
| `PRIMARY_COLOR` | 主题色（CSS 颜色） | `#0052D9` |
| `ICP_NO` | ICP 备案号 | 空 |
| `CUSTOMER_SERVICE` | 客服联系方式 | 空 |
| `REGISTER_OPEN` | 是否开放注册（`1`/`0`） | `1` |
| `ANNOUNCEMENT` | 站点公告 | 空 |
| `ADMIN_PASSWORD` | 覆盖内置管理员密码（可选） | 空（默认 `admin123`） |

> 品牌配置**写入 SQLite**，因此在运营后台手动修改后，环境变量不再覆盖（环境变量仅在启动时执行一次覆盖）。

## 5. 默认账号

- 管理员：`admin` / `admin123`（首次登录后请在运营后台修改，或用 `ADMIN_PASSWORD` 指定）
- 普通用户：通过注册页自助注册（受 `REGISTER_OPEN` 控制）

## 6. 生产镜像说明（deploy/Dockerfile）

- **多阶段构建**：
  - `builder`：`node:24-bookworm-slim`，安装全部依赖（含编译原生模块的 gcc/make/python3），执行 `npm run build`（esbuild 打包 `src/app.ts` → `data/serve/app.js` 单文件 bundle）；
  - `runtime`：`node:24-bookworm-slim`，只拷贝 bundle、生产依赖、种子数据。
- **外部依赖（external）处理**：esbuild 将非 external 依赖内联进 `app.js`；`better-sqlite3`、`sharp`、`vm2`、`@huggingface/transformers`、`sqlite3`、`onnxruntime-node`、`mysql2`/`pg` 等 external 依赖随 `node_modules` 整体拷入 runtime，保证原生模块可用（**`better-sqlite3` 缺失会导致启动失败**）。
- **数据目录**：`/app/data` 声明为 VOLUME（compose 挂载 `toonflow-data` 命名卷），业务数据持久化；前端产物、供应商模板、提示词、Embedding 模型作为种子，由入口脚本在首次启动时写入数据卷。
- **启动命令**：`node data/serve/app.js`（`NODE_ENV=prod`），`EXPOSE 10588`。

## 7. 数据备份 / 恢复 / 升级

```bash
cd deploy
./backup.sh                     # 备份数据卷 -> backup/toonflow-data-<时间戳>.tar.gz
./restore.sh backup/toonflow-data-xxxx.tar.gz   # 恢复（会先停容器 + 二次确认）
./upgrade.sh                    # 升级：备份 -> 重建镜像 -> 滚动更新（数据卷保留）
```

- 备份内容：`db2.sqlite` + `oss/`、`assets/`、`skills/`、`vendor/`、`web/` 等全部运行时数据。
- 升级后前端随新镜像自动刷新（入口脚本每次启动同步 `seed/web` 到数据卷），业务数据不受影响。

## 8. 常见问题

### 8.1 端口被占用
原 `toonflow` 容器占用 `10588`。修改 `.env` 的 `APP_PORT=10589`（或停掉旧容器）后重启。

### 8.2 启动报错 / API 返回 500
先看日志：
```bash
cd deploy && docker compose logs -f app
```
常见原因：
- 首次建表需要 Embedding 模型：确认数据卷内有 `models/all-MiniLM-L6-v2/onnx/model_fp16.onnx`（入口脚本会自动初始化，勿手动删除数据卷）。
- 数据卷被破坏：`docker compose down -v` 后重新 `up`（会重建全部表，业务数据将丢失，慎用）。

### 8.3 ADMIN_PASSWORD 未生效
入口脚本只在**数据库已存在**（`db2.sqlite` 已生成）时执行覆盖，且管理员由应用首次启动时创建。若刚首次启动就设置了 `ADMIN_PASSWORD`，需**重启一次**容器生效：
```bash
docker compose restart
```

### 8.4 构建慢 / npm 源问题
默认使用 `https://registry.npmmirror.com`。可在 `docker-compose.yml` 的 `args.NPM_REGISTRY` 或直接 `docker compose build --build-arg NPM_REGISTRY=https://registry.npmjs.org` 切换。

## 9. 相关文档与配套

- **白标多客户打包**（每客户一套 .env + 独立数据卷，无需重建镜像换肤）：`deploy/whitelabel/build.sh` → 见 `docs/whitelabel.md`（P3-2）
- **升级 / 备份手册**（面向既有 `toonflow:lan` 容器与白标客户容器）：见 `docs/upgrade-backup.md`（P3-4）
- **SQLite → MySQL 迁移路径**：见 `docs/migration-mysql.md`（P3-4）
- 本 `docs/deploy.md` 面向**平台级一键安装包**（P3-1）：单镜像 `toonflow-prod` 一体起整站。

> 关系：P3-1 提供"一个新客户直接 `docker compose up` 跑起全平台"的标准包；P3-2 在其之上
> 按客户注入品牌生成独立部署目录；P3-4 提供备份/升级/迁移手册。三者共用同一品牌机制
> （后端 `initDB` 读环境变量覆盖 `o_site_config`）。

## 10. 遗留事项 / 已知边界

- **数据库**：生产默认 SQLite（单文件，适合中小规模）。如需 MySQL，后端已具备 knex 多方言支持（镜像已含 `mysql2`），但 `src/app.ts`/`initDB.ts` 目前固定用 SQLite 客户端，需改造连接配置（不在本次范围）。
- **默认管理员密码**：`admin123` 明文写在 `src/lib/initDB.ts`，生产建议通过 `ADMIN_PASSWORD` 或运营后台修改。
- **镜像体积**：约 1.1GB（含 transformers/onnxruntime 原生依赖），如需精简可后续裁剪。
- **多租户/计费/运营后台**：已包含于后端 bundle，部署即开。
