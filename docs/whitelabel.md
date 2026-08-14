# 白标打包说明（Phase 3 / P3-2）

多租户品牌化（白标）：给**每个客户一套独立的、带品牌的部署包**。
每个客户 = 同一后端镜像（`toonflow:lan`）+ 一套 `.env`（品牌变量）+ 独立数据卷，**无需重建镜像即可换肤**。

## 品牌机制（后端已支持，勿改键名）

- 后端 `backend/src/lib/initDB.ts` 启动时读取环境变量，覆盖写入 `o_site_config` 表：

| 环境变量 | o_site_config key | 说明 |
| --- | --- | --- |
| `SITE_NAME` | `siteName` | 站点标题 |
| `LOGO_URL` | `logoUrl` | 站点 logo（完整 URL，或 `/oss/...` 相对路径） |
| `PRIMARY_COLOR` | `primaryColor` | 主题色（hex，如 `#FF6B00`） |
| `ICP_NO` | `icpNo` | 备案号 |
| `CUSTOMER_SERVICE` | `customerService` | 客服链接 |
| `REGISTER_OPEN` | `registerOpen` | 注册开关（`1` 开 / `0` 关） |
| `ANNOUNCEMENT` | `announcement` | 公告文案 |

- 前端 `frontend/src/stores/site.ts` 通过 `GET /api/site/config` 动态拉取上述配置做品牌化（标题 / logo / 主题色 / 备案 / 公告 / 注册开关），**品牌变更无需重建前端**。

## 脚本用法

```bash
cd deploy/whitelabel

./build.sh                              # 按 clients.json 打包全部客户
./build.sh --client client-a            # 只打包清单中指定客户
./build.sh --force                      # 覆盖已存在的 .env / compose / README
./build.sh <name> <siteName> [键值...]  # 临时单客户 CLI 打包（不改清单）
```

临时单客户模式可选键值：`--primary-color --logo-url --icp-no --customer-service
--announcement --register-open --host-port --image --domain`。

## 客户清单（clients.json）

首次运行若没有 `clients.json`，脚本会自动从 `clients.example.json` 复制一份供编辑。
清单字段：

```json
{
  "name": "client-a",                      // 目录名 / 容器名后缀 / 数据卷后缀（勿含空格）
  "siteName": "星澜短剧",                  // 站点名
  "primaryColor": "#FF6B00",               // 主题色
  "logoUrl": "https://.../logo.png",       // logo 完整 URL
  "icpNo": "京ICP备...号",
  "customerService": "https://t.me/...",
  "announcement": "欢迎语",
  "registerOpen": "1",                     // "1" 开 / "0" 关
  "hostPort": 10590,                       // 宿主机对外端口 -> 容器 10588
  "image": "toonflow:lan",                 // 预留：客户独立镜像 tag
  "domain": "https://client-a.example.com" // 预留：独立域名（写入 README）
}
```

> `clients.json` 与生成的 `client-*/` 目录已加入 `deploy/whitelabel/.gitignore`，不入库。

## 产出目录

```
deploy/whitelabel/<clientName>/
├── .env                  # 品牌变量 + 部署参数（后端启动读取）
├── docker-compose.yml    # 独立编排（引用同目录 .env，独立端口 / 独立数据卷）
└── README.md             # 该客户访问地址 / 账号 / 品牌注入说明
```

## 部署

```bash
cd deploy/whitelabel/<clientName>
docker compose up -d      # 首次自动初始化数据库并按 .env 注入品牌
```

- 容器内固定端口 10588（`backend/src/app.ts` 硬编码），`HOST_PORT` 仅做宿主机映射。
- 数据目录 `/app/data`（db2.sqlite、oss/、assets/、web/）持久化到命名卷 `toonflow-<clientName>-data`。

## 后续演进（预留）

- **独立镜像**：`clients.json` 的 `image` 字段传入独立 tag，compose 自动引用；对应客户如需定制代码，可在独立镜像中覆盖。
- **独立域名**：`domain` 字段写入 README 供交付，反向代理指向 `HOST_PORT` 即可。

## 注意

- `REGISTER_OPEN` 环境变量只写入 `o_site_config`（前端隐藏注册入口）；后端注册接口
  （`backend/src/routes/auth/register.ts`）的开关读 **`o_setting.registerOpen`**。若需真正关闭注册，
  请在「运营后台」关闭（会同步写 `o_setting`），或手工更新该键。
- 升级 / 备份：见 `docs/upgrade-backup.md`；SQLite→MySQL 迁移：见 `docs/migration-mysql.md`。
- 平台级一键安装包的通用编排见 `docs/deploy.md`（由部署 agent 产出）；本目录的 compose 为白标客户独立编排。
