# toonflow-platform

Toonflow 二次开发 Monorepo：在 Toonflow v1.1.8 基础上进行多租户（Multi-tenant）与计费（Billing）能力扩展。

## Monorepo 结构

```
toonflow-platform/
├── backend/   # Toonflow v1.1.8 后端源码（Node/Express + Knex/SQLite + TypeScript）
├── frontend/  # 前端（独立 repo，Vue 3 + Vite + TDesign，源: HBAI-Ltd/Toonflow-web）
└── docs/      # 项目文档（架构、方案、进度等）
```

## 当前进度（2026-08-13）

### Phase 0 ✅ 开发链路打通
- 后端源码从容器 `toonflow` 同步至 `backend/` 并纳入 git（v1.1.8，211 个 TS 文件 + 11 个供应商模板）
- 前端源码 `frontend/`（HBAI-Ltd/Toonflow-web）clone 完成，`yarn build-only` 构建闭环验证通过
- 构建方法见 `docs/frontend-build.md`（**本机无 node，须用 docker 跑 `node:24` 构建**）

### Phase 1 ✅ 多租户 + 计费 MVP（已完成并验证）
- **用户体系**：注册/登录/用户信息接口（`/api/auth/*`）；密码 bcrypt 加密；JWT 带 role；禁用账号拦截；注册开关（`o_setting.registerOpen`）预留
- **多租户隔离**：91 个业务路由加 `assertProjectOwner` 归属校验；admin 可见全部项目；`o_tasks` 加 userId；RAG 记忆按 `userId:projectId` 隔离
- **计费**：`o_usage_log` / `o_recharge` / `o_price` 三张表；AI 调用统一埋点（文本按 token、图按张、视频按秒、TTS 按条）；余额不足前置拦截；`/api/billing/*`（estimate/balance/recharge/usage/summary）；`/api/setting/priceConfig` 价格管理；24 条示例种子价
- **前端**：注册页、登录改造（role/余额入库）、我的钱包页、生成页费用预估（视频/图片）+ 余额不足拦截
- **冒烟验证**：浏览器实测注册→登录→钱包全流程通过；后端集成测试"注册→充值→生成→扣费"通过

### Phase 2（待开始）
- 运营后台、品牌化/白标、BYOK、支付对接、安全加固

## 关键账号
- 默认管理员：`admin` / `admin123`（密码已 bcrypt 加密，登录时校验）
- 普通用户：通过 `/api/auth/register` 或前端注册页自助注册

## 关键接口速览（后端）

| 模块 | 接口 |
| --- | --- |
| 认证 | `/api/login/login`、`/api/auth/register`、`/api/auth/userInfo` |
| 计费 | `/api/billing/estimate`、`/api/billing/balance`、`/api/billing/recharge`(admin)、`/api/billing/recharge/list`、`/api/billing/usage`、`/api/billing/usage/summary` |
| 价格管理 | `/api/setting/priceConfig`(admin) |

## backend/ 来源

- 版本：Toonflow **v1.1.8**（`package.json` version 字段）
- 来源：运行中的 Docker 容器 **`toonflow`**（镜像 `toonflow:lan`），源码位于容器 `/app`
- 导入方式：`docker exec toonflow sh -c 'cd /app && tar czf - ...' | tar xzf -` 只读复制，未对容器做任何写入
- 首次提交：`chore: import Toonflow v1.1.8 backend source from container`
- 上游信息：`https://github.com/HBAI-Ltd/Toonflow-app`（Apache-2.0，作者 HBAI-Ltd）

## 目录说明

### backend/ 源码（需要版本管理）

| 路径 | 说明 |
| --- | --- |
| `src/` | 全部 TypeScript 源码。入口 `src/app.ts`（Express + Socket.IO），`src/router.ts` 为 HTTP 路由聚合，`src/routes/` 为各业务模块路由，`src/agents/`、`src/socket/` 为智能体与 WebSocket 逻辑，`src/lib/`、`src/utils/` 为基础库与工具 |
| `data/vendor/` | **供应商适配模板源码**（`.ts`），含 AtlasCloud / DeepSeek / GRSai / KlingAI / MiniMax / Openai / Toonflow / Vidu / Volcengine 等。商业价值较高，属于需要版本管理的模板源码。其中哪些归入“平台模板”后续再细分 |
| `scripts/` | 构建与工具脚本（`build.ts`、`main.ts`、`vendor2json.ts`、`license.ts` 及打包图标等） |
| `package.json` / `yarn.lock` | 依赖清单（锁定 yarn.lock，安装用 `yarn`） |
| `tsconfig.json` / `nodemon.json` | 编译与开发运行配置 |
| `Dockerfile` | 容器构建配置 |
| `.github/workflows/` | CI/CD 工作流（debug / release） |
| `.gitignore` | 本地新增：排除 node_modules、build、运行时 data 目录 |

### 未复制的内容（容器运行时数据，不做版本管理）

以下均保留在容器内，**未**导入本地：

- `node_modules/` — 体积大，可随时用 `yarn install` 重新生成
- `data/db2.sqlite` — SQLite 运行时数据库（含用户业务数据）
- `data/serve/app.js` — 编译产物（9.9MB 单文件 bundle，`npm start` 使用的生产入口）
- `data/web/` — 前端构建产物
- `data/oss/`、`data/assets/`、`data/skills/`、`data/models/`、`data/modelPrompt/`、`data/version.txt` — 运行时资源

## 本地开发

```bash
cd backend
yarn install                 # 安装依赖（需先安装 yarn 1.x）
yarn dev                     # 开发模式：nodemon + tsx 运行 src/app.ts
```

> 说明：开发模式 `yarn dev` 会运行 `src/app.ts`，首次运行可能需要容器内的 `data/serve/app.js` 或特定数据目录；完整联调仍需以容器 `toonflow` 为准。

## 二次开发方向（Phase 0 之后）

- **多租户（Multi-tenant）**：在现有单用户数据模型基础上引入租户隔离
- **计费（Billing）**：接入用量统计、配额与计费体系
