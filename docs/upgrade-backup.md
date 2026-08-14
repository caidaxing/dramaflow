# 升级与备份手册（Phase 3 / P3-4）

> 适用：Toonflow 后端 Docker 部署（`toonflow:lan` 镜像 / `toonflow` 容器）。
> 白标多客户场景：每个客户是独立容器 + 独立数据卷，备份 / 升级按客户逐一执行即可。
> 部署 / 一键安装见 `docs/deploy.md`（由部署 agent 产出）；白标打包见 `docs/whitelabel.md`。

## 1. 数据在哪里

| 内容 | 容器内路径 | 宿主机（白标 compose） | 说明 |
| --- | --- | --- | --- |
| 数据库 | `/app/data/db2.sqlite` | 数据卷 `toonflow-<client>-data` | SQLite 单文件，**核心业务数据** |
| 素材/附件 | `/app/data/oss/` | 同上 | 用户上传 / 生成图片视频，通过 `/oss` 提供 |
| 素材资产 | `/app/data/assets/` | 同上 | 通过 `/assets` 提供 |
| 技能图片 | `/app/data/skills/` | 同上 | 通过 `/skills` 提供 |
| 前端静态站 | `/app/data/web/` | 同上 | 构建产物（`index.html` 等） |
| 模型/提示词 | `/app/data/models/` `modelPrompt/` | 同上 | 随镜像或首次启动生成 |
| 版本号 | `/app/data/version.txt` | 同上 | 启动时写入 |

> 数据目录计算逻辑：`backend/src/utils/getPath.ts` —— 非 Electron 环境下为
> `process.cwd()/data`（容器内即 `/app/data`）。**升级/备份只需处理整个 `/app/data` 即可覆盖全部数据。**

## 2. 备份

### 2.1 推荐：命名卷 + 数据库文件双保险

```bash
# a) 停止业务写入（避免备份期间产生增量）
docker compose -f deploy/whitelabel/<client>/docker-compose.yml down

# b) 备份整个数据卷（覆盖 db2.sqlite + oss + assets + web 等全部）
#    命名卷名称：toonflow-<client>-data
docker run --rm -v toonflow-<client>-data:/data -v "$PWD/backups":/backup \
  alpine sh -c 'cd /data && tar czf /backup/toonflow-<client>-<date>.tar.gz .'

# c) 额外再导出一份数据库逻辑备份（可选，便于细粒度恢复/迁移）
docker run --rm -v toonflow-<client>-data:/data -v "$PWD/backups":/backup \
  alpine cp /data/db2.sqlite /backup/db2.sqlite-<date>.bak
```

单容器（无 compose，如现有 `toonflow` 容器）等价写法：

```bash
docker exec toonflow sh -c 'cd /app/data && tar czf - .' > backups/toonflow-<date>.tar.gz
```

> 若用 bind mount 挂载宿主目录而非命名卷，直接用 `tar` 打包挂载目录即可，无需 `docker run`。

### 2.2 备份清单核对

- 压缩包应包含：`db2.sqlite`、`oss/`、`assets/`、`skills/`、`web/`、`modelPrompt/`、`version.txt`。
- 备份文件放到**容器外部**（宿主机或对象存储），不要放进 `/app/data` 本身。

## 3. 恢复

```bash
# a) 停止容器
docker compose -f deploy/whitelabel/<client>/docker-compose.yml down

# b) 恢复数据卷：先清空再解包（卷内是 /data 根目录）
docker run --rm -v toonflow-<client>-data:/data -v "$PWD/backups":/backup \
  alpine sh -c 'rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf /backup/toonflow-<client>-<date>.tar.gz -C /data'

# c) 重启并验证
docker compose -f deploy/whitelabel/<client>/docker-compose.yml up -d
```

> 恢复后首次启动会跑 `initDB` + `fixDB`，自动补齐缺失表 / 列、修正异常状态，正常情况幂等无害。

## 4. 升级

### 4.1 升级流程（先备份 → 拉新版本 → 重建容器 → 启动 → 验证）

```bash
# 0) 升级前必须先备份（见第 2 节）
# 1) 拉取 / 构建新镜像
docker pull toonflow:lan                        # 或构建：docker build -t toonflow:lan backend/

# 2) 停旧容器（保留数据卷）
docker compose -f deploy/whitelabel/<client>/docker-compose.yml down

# 3) 用新镜像重建容器（数据卷 toonflow-<client>-data 不动，数据保留）
docker compose -f deploy/whitelabel/<client>/docker-compose.yml up -d --force-recreate

# 4) 验证
docker compose -f deploy/whitelabel/<client>/docker-compose.yml logs -f   # 看启动日志
curl -s http://localhost:<HOST_PORT>/api/site/config                      # 接口通、品牌配置在
```

### 4.2 升级兼容性说明

- 表结构变更由 **`initDB` + `fixDB` 自动迁移**：
  - `initDB`（`backend/src/lib/initDB.ts`）：启动时 `hasTable` 检查，缺表自动建表；
    新版本新增的列/键（如 `o_site_config` 品牌键）在启动时写入默认值。
  - `fixDB`（`backend/src/lib/fixDB.ts`）：`addColumn / dropColumn / alterColumnType`
    幂等补列 / 删列 / 改列类型，旧数据兼容；同时把异常退出遗留的"生成中"任务修正为失败态。
- **旧数据兼容**：升级不会清库、不删表；`o_user` 等既有数据原样保留。管理员账号、余额、
  项目、素材均不受影响。
- **品牌环境变量幂等**：每次启动都会把 `.env` 中的品牌变量重新覆盖写入 `o_site_config`
  （改 `.env` 后重建容器即生效；运营后台手工改的值会在下次带品牌环境变量启动时被环境变量覆盖回去）。
- **回滚**：保留旧镜像 tag，`docker compose up -d` 改回旧镜像 tag 并 `--force-recreate` 即可；
  若数据已升级到新结构，建议按备份包做完整恢复而非简单回滚。
- 前后端版本配套：前端构建产物放进 `/app/data/web/`，升级后端不强制重建前端；
  但前端版本差异过大时按 `docs/frontend-build.md` 重建并 `docker cp` 进数据卷。
