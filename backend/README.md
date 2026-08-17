# dramaflow-backend

短剧 AI 聚合生产平台后端：多租户/计费/运营后台/白标扩展。

> ⚠️ License：Apache-2.0 + 补充商业协议（见 `LICENSE`）。产品化分发给 ≥2 个独立第三方须获 HBAI-Ltd 书面授权（<10 万年销售额免费）。

## 技术栈
Node.js + Express + Knex(SQLite) + Socket.IO + TypeScript（上游 v1.1.8 基础上二次开发）

## 我们新增的能力
- **认证**：注册/登录/用户信息（`src/routes/auth/*`）、密码 bcrypt、JWT 带 role
- **多租户隔离**：91 个业务路由归属校验（`src/utils/tenant.ts`）、admin 全量、任务/记忆隔离
- **计费**：AI 调用统一埋点（`src/utils/ai.ts`）、余额扣费（`src/utils/billing.ts`）、`o_usage_log/o_recharge/o_price` 表、`/api/billing/*`、价格管理
- **运营后台**：`/api/admin/*`（用户管理/订单/用量总览，admin only）
- **白标**：`o_site_config` 表 + `/api/site/config` 公开接口 + 环境变量品牌注入（`SITE_NAME/PRIMARY_COLOR/REGISTER_OPEN` 等）

## 快速开始
```bash
yarn install
yarn dev        # 开发模式（nodemon + tsx 跑 src/app.ts，端口 10588）
# 或生产构建
node scripts/build.ts   # 生成 data/serve/app.js
yarn start              # 生产模式
```

## 目录说明
- `src/routes/` — 业务路由（自动注册到 `/api/**`）
- `src/utils/` — 工具（ai 计费埋点、billing/tenant/auth）
- `src/lib/initDB.ts` — 表结构与种子数据
- `data/vendor/` — 供应商适配模板（11 家，运行时沙箱加载）

## 部署
一键部署见根仓库 `deploy/`（本仓库不含前端产物 `data/web`，需另行构建）。
