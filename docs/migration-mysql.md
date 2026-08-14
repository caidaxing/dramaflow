# SQLite → MySQL 迁移路径（Phase 3 / P3-4）

> 本文档说明**如何迁移**，不执行迁移。当前生产库为 SQLite，单文件
> `/app/data/db2.sqlite`，通过 Knex 封装（`backend/src/utils/db.ts`）访问。
> 目标：切换为 MySQL（Knex 原生支持），同时尽量不动业务代码。

## 1. 现状（已核实）

### 1.1 数据库访问层

`backend/src/utils/db.ts`（**只读参考，迁移时才需修改**）：

```ts
const dbPath = getPath("db2.sqlite");          // 非 Electron 下 = cwd/data/db2.sqlite
const db = knex({
  client: "better-sqlite3",
  connection: { filename: dbPath },
  useNullAsDefault: true,
});
```

- 启动流程：`initDB(db)` 建表 + 种子 → `fixDB(db)` 幂等补列/修正 → dev 环境生成 TS 类型。
- 所有业务路由通过 `u.db("表名")`（`db.ts` 导出的 `dbClient`）访问，**与具体 dialect 解耦**，
  换 MySQL 后业务代码无需改动。

### 1.2 依赖与打包

- `package.json` 已含 `knex ^3.2.5`、`better-sqlite3`、`sqlite3`。
- `scripts/build.ts` 的 esbuild `external` 已包含 `mysql`、`mysql2`、`pg`、`pg-query-stream`
  （以及 oracledb/tedious/mssql 等），说明**打包时这些驱动不会被内联进 bundle**，
  需作为容器 runtime 依赖安装。当前 `package.json` 尚未显式声明 `mysql2`，迁移前需
  `yarn add mysql2`（Dockerfile 会在镜像构建时 `yarn install` 装好）。

## 2. 表结构特点（迁移关键差异点）

### 2.1 共 29 张 `o_` 业务表（见 `backend/src/lib/initDB.ts`）

`o_user o_project o_novel o_script o_assets o_event o_eventChapter o_image
o_imageFlow o_video o_videoTrack o_assets2Storyboard o_assetsRole2Audio
o_storyboard o_scriptAssets o_prompt o_artStyle o_tasks o_agentDeploy
o_agentWorkData o_vendorConfig o_skillList o_skillAttribution o_modelPrompt
o_setting o_site_config o_usage_log o_recharge o_price`

### 2.2 差异点

| 项 | SQLite（现状） | MySQL（目标） | 说明 |
| --- | --- | --- | --- |
| **主键 id** | `table.integer("id")`，应用侧 `Date.now()` 赋值，**无自增** | **必须 `BIGINT`** | `Date.now()` 当前约 1.75e12（13 位），超过 MySQL `INT`(2^31-1≈2.1e9) 上限会**溢出报错**；SQLite 的 integer 是 64 位所以无碍。所有 `table.integer("id")` 主键应改为 `table.bigInteger("id")`，`o_` 表内**不存在 AUTO_INCREMENT**（无 `increments()`），迁移时不要加自增（或加也无害，但应用侧已显式传 id）。 |
| **时间戳** | `table.integer("createTime"/"updateTime")`，epoch 毫秒 | **必须 `BIGINT`** | 与 id 同理，13 位毫秒时间戳超 INT 上限。**项目中没有 `DATE`/`DATETIME` 列**——所有时间都是 epoch 毫秒整数（如 `o_usage_log.createTime`），因此无需处理 SQL 日期类型转换；BIGINT 即可。 |
| 金额 | `table.integer("cost"/"charge"/"balance"/"amount")`，单位分 | `INT` 或 `BIGINT` | 值较小，`INT` 够用；为统一可一并 `BIGINT`。 |
| 浮点 | `table.double("pricePerUnit")` | `DOUBLE` | Knex 原生映射，无差异。 |
| 布尔 | `table.boolean("useUserKey"/"enabled")` | `TINYINT(1)` | Knex 自动映射 0/1，业务读写 `0/1` 不变。 |
| 文本主键 | `o_setting` 主键 `text("key")` | `VARCHAR` 主键 | MySQL 支持，Knex `table.text("key").primary()` 可用，建议改 `table.string("key", 191).primary()`（utf8mb4 下 VARCHAR 主键有长度限制）。 |
| 空串/NULL | 宽松 | 较严格 | 迁移时把空串统一处理为 `''` 或 `NULL`，避免默认值/唯一约束差异。 |
| 大小写 | 不敏感 | 表名/列名在 Linux 下区分大小写 | 保持与 `initDB.ts` 中的表名完全一致。 |

## 3. 迁移路径（分 5 步）

### 3.1 建库建表（表结构以 initDB 为准）

1. MySQL 建库（utf8mb4）：

```sql
CREATE DATABASE toonflow DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. **建表建议复用 `initDB` 的建表逻辑**：因为 `initDB.ts` 用 `knex.schema.createTable`
   描述结构且与 dialect 无关，最省事的方式是直接把 `db.ts` 的 knex client 切到 mysql2，
   让 `initDB(db)` 在空库上自动建表（无需手写 29 张 DDL）。
   但注意：**`table.integer("id")` 在 MySQL 会建 `INT`，必须先全局改成
   `table.bigInteger("id")`（及时间戳列）再跑**，否则 `Date.now()` id 溢出。
   若不想改业务建表代码，可先跑一遍 initDB 建表，再对 id/时间戳列手工
   `ALTER TABLE ... MODIFY id BIGINT`。

### 3.2 数据导出（SQLite）

方案 A（推荐，可控）：写一个临时 Node 脚本，用 `better-sqlite3` 逐表读出、
按 MySQL 目标列生成 INSERT，或直接经 Knex 双连接（sqlite 源 + mysql 目标）逐表搬运：

```bash
cd backend && yarn tsx scripts/migrate-sqlite-to-mysql.ts   # 一次性脚本（自行编写）
```

方案 B：SQLite 命令行 dump 后改写：

```bash
sqlite3 /app/data/db2.sqlite .dump > dump.sql
# dump 含 SQLite 专有语法（BEGIN TRANSACTION;、PRAGMA、整数引号等），需改写后导入
mysql -h <host> -u <user> -p toonflow < dump.sql
```

> 推荐 A：`o_` 表无自增，逐表 `select *` + `insert` 顺序搬运即可（注意外键/依赖顺序：
> `o_user` → 项目/任务 → 明细/流水）。文本/JSON 字段原样搬运。

### 3.3 改连接配置（db.ts）

`backend/src/utils/db.ts` 支持双客户端，按环境变量切换（示例，**迁移时改动**）：

```ts
const client = process.env.DB_CLIENT || "better-sqlite3";
const db = client === "mysql2"
  ? knex({
      client: "mysql2",
      connection: {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "toonflow",
        charset: "utf8mb4",
      },
      pool: { min: 0, max: 10 },
    })
  : knex({
      client: "better-sqlite3",
      connection: { filename: getPath("db2.sqlite") },
      useNullAsDefault: true,
    });
```

- Knex 3.x 对 MySQL 使用 **`mysql2`** 驱动（`client: "mysql2"`）；`mysql`/`pg` 亦被 external 预留。
- 环境变量注入方式：Docker 场景用 compose `env_file`/`environment`（后端未显式加载
  `.env`，但 compose 会把变量注入进程环境，无需 dotenv）；白标打包可沿用 `deploy/whitelabel` 的 `.env` 追加 `DB_*` 键。
- **注意**：`useNullAsDefault` 只在 SQLite 需要，MySQL 下保留无副作用。

### 3.4 启动与自检

```bash
docker compose up -d          # 或 docker restart toonflow
docker compose logs -f        # 观察 initDB/fixDB 日志，确认建表/迁移无报错
```

### 3.5 验证

- `curl http://localhost:10588/api/site/config` 返回站点配置（`o_site_config` 读通）。
- 用 `admin/admin123` 登录，核对用户/余额（`o_user`）。
- 跑一次计费查询（`/api/billing/usage/summary`）确认 `o_usage_log` 汇总正常。
- 检查素材接口 `/oss`、`/assets` 是否正常（文件系统未迁移，仅 DB 切换）。

## 4. 注意事项

- **id 溢出是头号坑**：任何 `table.integer("id")` / 时间戳列在 MySQL 都必须 `BIGINT`，
  否则 `Date.now()`（13 位）插入 INT 列报 `Out of range`。
- **无 AUTO_INCREMENT**：迁移后保持"应用侧显式传 id"，不要依赖自增，
  避免与 `Date.now()` id 冲突。
- **文本主键**：`o_setting`/`o_site_config` 用文本键，注意 utf8mb4 下 VARCHAR 主键长度。
- **JSON 字段**：表内 `table.text` 存 JSON 串（如 `o_setting.modelOnnxFile`），MySQL 建议
  用 `TEXT/LONGTEXT` 保持原样，不要强转 `JSON` 类型（应用侧按字符串读写）。
- 迁移是**一次性**动作：切库后旧 SQLite 文件保留作为回滚/审计（勿删）。
- 升级兼容性见 `docs/upgrade-backup.md`；白标多客户若逐个切 MySQL，注意各客户独立库/独立连接配置。
