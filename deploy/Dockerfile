# syntax=docker/dockerfile:1
# =============================================================================
# Toonflow 生产镜像（单容器一体：后端 bundle + 前端静态 + SQLite）
#
# 构建上下文 = monorepo 根目录（/Users/apple/Desktop/zcode/toonflow-platform）
# 前提：backend/data/web 已包含前端构建产物（deploy.sh 会在缺失时从 frontend/dist 复制）
#
# 设计要点：
#   1) 多阶段构建：builder 阶段编译后端 bundle（esbuild 单文件 data/serve/app.js），
#      runtime 阶段只拷贝产物 + 生产依赖，不在容器内现场构建，镜像体积可控。
#   2) external 原生/运行时依赖（better-sqlite3、sharp、vm2、@huggingface/transformers、
#      sqlite3、onnxruntime-node 等）在 builder 阶段编译后随 node_modules 拷入 runtime，
#      保证生产镜像具备这些原生模块（better-sqlite3 缺失会导致启动失败）。
#   3) /app/data 声明为 VOLUME（数据卷），由 docker-compose 挂载持久化；
#      前端 web / 供应商 vendor / 提示词 modelPrompt 作为 seed 由入口脚本写入数据卷。
# =============================================================================

# ---------- Stage 1: builder（编译后端 bundle） ----------
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# npm 镜像源，可按需通过 --build-arg 覆盖（如 npmjs）
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY}

# 原生模块（better-sqlite3 / sharp 等）编译所需工具；预编译产物下载失败时兜底编译
# 国内部署：apt 源切换为阿里云镜像（debian 官方源在国内访问极慢）
RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g; s|http://security.debian.org|http://mirrors.aliyun.com|g' \
      /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list 2>/dev/null || true \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 后端源码作为构建输入（含 data/vendor、data/web 前端产物、data/modelPrompt、data/models）
COPY backend/ ./
# 种子目录可能未随源码提供（运行时资产）；确保存在，避免下方 COPY 因缺失失败
RUN mkdir -p data/models data/modelPrompt data/web

# 去除 Electron 专用包，避免安装桌面二进制；然后安装全部依赖并编译后端 bundle
# 原生模块（better-sqlite3/sqlite3/sharp）的预编译二进制默认从 GitHub 下载，
# 国内网络超时（ETIMEDOUT 到 20.205.243.166）。这里用环境变量把它们全部指向 npmmirror 镜像。
ENV npm_config_registry=https://registry.npmmirror.com \
    npm_config_better_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/better-sqlite3 \
    npm_config_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/sqlite3 \
    npm_config_sharp_binary_host=https://npmmirror.com/mirrors/sharp \
    npm_config_sharp_libvips_binary_host=https://npmmirror.com/mirrors/sharp-libvips
RUN node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));for(const section of ['dependencies','devDependencies']){if(!pkg[section]) continue;for(const name of ['custom-electron-titlebar','electron','electron-builder','electron-rebuild','electronmon']) delete pkg[section][name];}fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2)+'\n');" \
    && npm install --no-audit --no-fund --legacy-peer-deps \
    && npm run build \
    && ls -la data/serve/app.js

# ---------- Stage 2: runtime（仅 node runtime + 产物） ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=prod
ENV PORT=10588

# 出站 HTTPS（调用 AI 供应商）所需根证书；apt 源同样切换为阿里云镜像
RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g; s|http://security.debian.org|http://mirrors.aliyun.com|g' \
      /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list 2>/dev/null || true \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 后端 bundle（esbuild 单文件，非 external 依赖已内联）
COPY --from=builder /app/data/serve/app.js ./data/serve/app.js

# external 原生/运行时依赖（better-sqlite3、sharp、vm2、@huggingface/transformers、
# sqlite3、onnxruntime-node 以及 knex 的各数据库驱动 mysql2/pg 等）
COPY --from=builder /app/node_modules ./node_modules

# 种子数据：由入口脚本写入数据卷 /app/data
COPY --from=builder /app/data/web ./seed/web/
COPY --from=builder /app/data/vendor ./seed/vendor/
COPY --from=builder /app/data/modelPrompt ./seed/modelPrompt/
# RAG 记忆检索用 Embedding ONNX 模型（initDB 首次初始化依赖，缺失会导致建表中断）
COPY --from=builder /app/data/models ./seed/models/

# 入口脚本 + 管理员密码注入脚本
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY deploy/ensure-admin-password.cjs /usr/local/bin/ensure-admin-password.cjs
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 版本元数据
COPY backend/package.json ./

EXPOSE 10588

VOLUME ["/app/data"]

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "data/serve/app.js"]
