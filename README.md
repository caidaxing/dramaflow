<div align="center">

# 🎬 DramaFlow

**短剧 AI 聚合生产平台**

基于 AI 的一站式短剧创作与分发底座 —— 小说转剧本、AI 生成分镜与视频、按量计费、多租户运营，开箱即用的白标 SaaS 方案。

</div>

---

## 这是什么

DramaFlow 是一个**面向短剧生产与运营的 AI 聚合平台**，在 [Toonflow](https://github.com/HBAI-Ltd/Toonflow-app) 开源项目基础上二次开发，补齐了「商业化」所需的全部能力：

- 从 **小说 → 剧本 → 分镜 → 图片 → 视频** 的完整 AI 创作流水线
- 可插拔聚合国内外主流文生文 / 图 / 视频 / TTS 模型供应商
- **多租户**：每位用户数据完全隔离，管理员全局可控
- **按量计费**：文本按 token、图片按张、视频按秒、配音按条，余额实时扣费
- **运营后台**：用户管理、充值订单、用量总览、价格配置
- **白标**：平台名 / Logo / 主题色 / 备案号一键定制，支持为每个客户打包独立品牌实例

## 核心特性

| 领域 | 能力 |
| --- | --- |
| 🤖 AI 创作 | 小说导入 → 剧本 → 分镜 → 视频 → 配音 全流水线；多层 Agent 编排 + RAG 记忆 |
| 🔌 模型聚合 | 可灵 / 即梦 / 豆包 / 海螺 / Vidu / OpenAI 等 11+ 供应商模板，可自定义扩展 |
| 👥 多租户 | 注册登录、用户数据隔离、角色权限（admin / user）|
| 💰 计费 | 余额钱包、按量扣费、用量明细、费用预估、余额不足拦截 |
| 🛠 运营后台 | 用户管理、充值订单、用量统计、价格管理、注册开关 |
| 🎨 白标 | 站点配置化：标题 / Logo / 主题色 / 备案 / 公告，环境变量一键注入 |
| 🚀 交付 | Docker 一键安装包、白标打包脚本、升级 / 备份 / 迁移文档 |

## 快速开始

> 前置：仅需 Docker。本机无需安装 node / yarn。

```bash
git clone https://github.com/caidaxing/dramaflow.git
cd dramaflow/deploy

cp .env.example .env        # 按需修改端口与品牌配置
./deploy.sh                 # 自动构建并启动
```

启动后访问 `http://localhost:10588`，默认管理员 `admin / admin123`（生产环境请立即修改）。

## 仓库结构

```
dramaflow/
├── backend/    # 后端：Node / Express / Knex / SQLite + TypeScript
├── frontend/   # 前端：Vue3 / Vite / TDesign
├── deploy/     # Docker 一键安装包 + 白标打包脚本
└── docs/       # 部署 / 升级备份 / 数据库迁移文档
```

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/deploy.md](docs/deploy.md) | 一键部署手册（环境变量、端口、管理员密码）|
| [docs/whitelabel.md](docs/whitelabel.md) | 白标打包（每客户独立品牌部署包）|
| [docs/upgrade-backup.md](docs/upgrade-backup.md) | 升级与备份恢复 |
| [docs/migration-mysql.md](docs/migration-mysql.md) | SQLite → MySQL 迁移路径 |
| [docs/frontend-build.md](docs/frontend-build.md) | 前端构建指南 |
