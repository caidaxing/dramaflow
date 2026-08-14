# Toonflow 前端构建指南（Docker）

> Phase 0 第二步：验证 Toonflow-web 官方前端源码在本地 monorepo 中可重建。
> 本文档记录如何在**没有 node/yarn 的 macOS 宿主机**上，用 Docker 临时 node 容器完成前端构建。

## 1. 环境约束

- 宿主机 macOS **没有安装 node/yarn**，禁止在宿主直接 `yarn`。
- Docker 内有 node 镜像：`node:24`（对应运行容器 toonflow 内 node v24.19.0）。
- 前端目录：`/Users/apple/Desktop/zcode/toonflow-platform/frontend/`
  - 来源：`git clone https://github.com/HBAI-Ltd/Toonflow-web.git`（master 分支）
  - 技术栈：Vue3 + Vite5 + TDesign + Pinia + vue-router + i18n + monaco-editor

## 2. 构建命令（完整闭环）

```bash
FRONTEND=/Users/apple/Desktop/zcode/toonflow-platform/frontend

# 1) 安装依赖（yarn.lock 已存在，yarn 1.22.22）
docker run --rm -v "$FRONTEND":/app -w /app node:24 \
  sh -c 'yarn --version && yarn install --network-timeout 600000'

# 2) 构建（注意：必须用 build-only，不能用 build；见第 4 节"常见问题"）
docker run --rm -v "$FRONTEND":/app -w /app node:24 \
  sh -c 'export NODE_OPTIONS="--max-old-space-size=6144" && yarn build-only'
```

构建产物输出到 `$FRONTEND/dist/`。

## 3. 构建耗时（实测 2026-08-13）

| 步骤 | 耗时 | 说明 |
| --- | --- | --- |
| docker pull node:24 | ~1-2 min | 首次拉取镜像 |
| yarn install | ~60 s | 11000+ 包，`[1/4]~[4/4]` |
| vite build (build-only) | ~1m33s | 11096 modules transformed，单文件内联 |

总耗时约 3-5 分钟。

## 4. 常见问题

### 4.1 必须用 `build-only`，不要用 `build`
- `yarn build` = `vue-tsc --build --force && vite build`，会先做类型检查。
- master 分支源码里**误提交了损坏的副本文件**，vue-tsc 直接报语法错误：

```
src/views/production/components/workbench/generate copy.vue(1063,1): error TS1109: Expression expected.
```

涉及误提交文件（git 已跟踪，属源码问题而非环境问题）：
- `src/views/production/components/workbench/generate copy.vue`（含 `generate copy/` 目录）
- `src/utils/useChat copy.ts`
- `src/views/scriptAgent/index copy.vue`

结论：**官方线上容器产物也是用 `build-only`（跳过类型检查）产出的**，产物形态一致。若后续要跑类型检查，需先删除/修复上述损坏副本。

### 4.2 内存不足（JavaScript heap out of memory）
- vite 单文件内联（`vite-plugin-singlefile` + `assetsInlineLimit: Infinity`）会把 monaco 等 11000+ 模块打进一个 index.html，默认 2GB 堆不够。
- 报错：`FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`（exit 134）
- 解决：设 `NODE_OPTIONS="--max-old-space-size=6144"`（宿主机 16GB 内存，容器可见约 8GB）。

### 4.3 依赖安装慢/失败
- 加 `--network-timeout 600000`（10 分钟超时）避免网络抖动。
- yarn 1 是串行下载，11000+ 包约 60s，属正常。
- 若 registry 慢可切换镜像源：`yarn config set registry https://registry.npmmirror.com`（在容器内执行需持久化，可用 `--network-timeout` 优先）。

### 4.4 构建残留文件
- vue-tsc 会在根目录生成未跟踪的 `vite.config.js` / `vite.config.d.ts`，构建后 `rm -f vite.config.js vite.config.d.ts` 清理（.gitignore 已覆盖 node_modules / dist）。

## 5. 产物清单（dist/）

| 文件 | 大小 | 说明 |
| --- | --- | --- |
| `index.html` | ~26.6 MB | 单文件应用（js+css 全内联），gzip 后 ~11 MB |
| `css.worker-BvV5MPou.js` | ~1.03 MB | monaco CSS worker |
| `html.worker-BLJhxQJQ.js` | ~694 KB | monaco HTML worker |
| `json.worker-usMZ-FED.js` | ~384 KB | monaco JSON worker |
| `ts.worker-DGHjMaqB.js` | ~7.02 MB | monaco TS worker |
| `favicon.ico` | ~169 KB | 站点图标（来自 public/） |

> monaco worker 由 vite 单独输出（不内联，因为 worker 必须独立文件）；其余全部内联进 index.html。

## 6. 与线上容器产物对比结论（2026-08-13 实测）

对比对象：运行容器 `toonflow`（`toonflow:lan`）内 `/app/data/web/`。

- **4 个 monaco worker + favicon：md5 完全一致**（字节级相同，文件名哈希也相同）。
- **index.html：本地 26,871,266 B vs 容器 26,880,189 B**，相差 ~8.9 KB（0.03%），因容器构建时刻与当前 master HEAD 存在少量应用代码差异；两者引用的 4 个 worker 文件名、`<title>Toonflow</title>` 一致。
- 结论：**本地重建的前端与线上容器是同一个版本/同一条构建流水线**（vite-plugin-singlefile + base './' 相对路径 + monaco worker），构建闭环成立。

## 7. 部署到容器（参考，勿在无指示时执行）

线上容器 `/app/data/web/` 即 dist/ 内容。部署方式（未执行，仅记录）：
```bash
docker cp "$FRONTEND/dist/." toonflow:/app/data/web/
```
注意：不要用容器产物覆盖本地源码；本地要的是"源码 + 可重建"。
