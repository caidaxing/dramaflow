# toonflow-platform

多租户短剧 AI 聚合生产平台 —— 在 Toonflow 基础上二次开发，实现「注册/多租户隔离/按量计费/运营后台/白标」全套能力，支持自营 SaaS、白标部署、本地安装包三种交付。

> ⚠️ **License 重要提示**：本项目基于 [HBAI-Ltd/Toonflow](https://github.com/HBAI-Ltd/Toonflow-app)（Apache-2.0 + 补充商业协议）。若以产品形式分发/销售给 **2 个及以上独立第三方**，须取得 HBAI-Ltd 书面商业授权（年销售额 <10 万免费）。不得删除/修改 Toonflow 标识与版权信息。详见各仓库 `LICENSE` 文件。

---

## 一、仓库结构（三个独立 git 仓库）

| 仓库 | 内容 | 说明 |
| --- | --- | --- |
| **backend/** | Toonflow 后端源码 + 我们新增的多租户/计费/运营后台/白标逻辑 | Node/Express + Knex/SQLite + TypeScript。独立 git 仓库 |
| **frontend/** | Toonflow 前端源码 + 注册/钱包/运营后台/白标页面 | Vue3 + Vite + TDesign。独立 git 仓库（源：HBAI-Ltd/Toonflow-web）|
| **本仓库（根）** | `deploy/`（Docker 一键安装包、白标打包脚本）+ `docs/`（文档）| 独立 git 仓库，管理部署产物与文档 |

> 说明：backend/ 与 frontend/ 是独立仓库（含各自完整 git 历史），本仓库通过目录引用它们，不重复包含其代码。发布时建议三个仓库分别建 GitHub repo，或合并为一个 monorepo（视你的发布策略）。

---

## 二、功能状态（Phase 0-3 全部完成 ✅）

| 阶段 | 内容 |
| --- | --- |
| **Phase 0** | 开发链路打通（monorepo、源码同步、构建闭环）|
| **Phase 1** | 注册/登录、多租户隔离（91 路由归属校验）、AI 按量计费（文本/图/视频/TTS）、前端钱包页、生成页费用预估 |
| **Phase 2** | 运营后台（用户管理/订单/用量总览）、品牌化白标（动态标题/logo/主题色/注册开关）|
| **Phase 3** | Docker 一键安装包、白标打包脚本、部署/升级/备份/迁移文档 |

**三种交付方式**：
- **自营 SaaS**：`deploy/deploy.sh` 一键部署，运营后台管理用户与价格
- **白标部署给客户**：`deploy/whitelabel/build.sh` 按客户清单产出带品牌的独立部署包
- **本地安装包**：Docker Compose 一键安装（客户 `docker compose up` 即用）

---

## 三、快速启动（本地开发 / 验证）

### 前置条件
- Docker（构建与运行容器）
- 本机**无需安装 node/yarn**（构建在 docker 容器内完成）

### 方式一：Docker 一键部署（推荐）
```bash
cd deploy
cp .env.example .env        # 按需修改端口、品牌环境变量
./deploy.sh                 # 自动补齐构建输入 + docker compose up --build
# 访问 http://localhost:10588
# 默认账号 admin / admin123（生产环境请立即修改）
```

### 方式二：手动构建后端 + 前端
```bash
# 后端（需先有 node_modules）
cd backend && yarn install
node scripts/build.ts       # 生成 data/serve/app.js

# 前端（构建产物放 backend/data/web）
cd frontend
docker run --rm -v "$PWD:/app" -w /app node:24 sh -c 'NODE_OPTIONS=--max-old-space-size=6144 yarn build-only'
cp -r dist/. ../backend/data/web/
```

---

## 四、关键账号与接口

**默认管理员**：`admin` / `admin123`（密码已 bcrypt 加密）
**普通用户**：通过注册页或 `/api/auth/register` 自助注册（受站点配置 `registerOpen` 控制）

| 模块 | 接口 |
| --- | --- |
| 认证 | `/api/login/login`、`/api/auth/register`、`/api/auth/userInfo` |
| 计费 | `/api/billing/estimate`、`balance`、`recharge`(admin)、`usage`、`usage/summary` |
| 运营后台 | `/api/admin/users`、`/api/admin/orders`、`/api/admin/usage/*`、`/api/admin/site/*`（均 admin）|
| 白标 | `/api/site/config`（公开）、`/api/admin/site/update`（admin）|
| 价格管理 | `/api/setting/priceConfig`（admin）|

---

## 五、部署与运维文档（见 docs/）

| 文档 | 内容 |
| --- | --- |
| `docs/deploy.md` | 一键安装包部署手册（环境变量、端口、ADMIN_PASSWORD）|
| `docs/whitelabel.md` | 白标打包（每客户独立部署包）|
| `docs/upgrade-backup.md` | 升级与备份恢复（卷备份、initDB/fixDB 自动迁移兼容）|
| `docs/migration-mysql.md` | SQLite → MySQL 迁移路径（注意 id/时间戳 BIGINT 差异）|
| `docs/frontend-build.md` | 前端构建（docker 构建方式、常见问题）|

---

## 六、生产上线前 Checklist

- [ ] 配置真实 AI 模型 apiKey（运营后台 → 供应商配置；当前为示例价格，需配平台 key 才能真实生成扣费）
- [ ] 修改默认管理员密码（`admin/admin123`）
- [ ] 确认 License 合规（见顶部提示 + 各仓库 LICENSE）
- [ ] 备份策略生效（`deploy/backup.sh`）
