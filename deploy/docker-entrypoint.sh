#!/bin/sh
# =============================================================================
# Toonflow 容器入口脚本
#   1) 每次启动把镜像内的最新前端产物（/app/seed/web）刷新到数据卷 /app/data/web
#      —— 升级镜像后前端自动更新，业务数据不受影响。
#   2) 首次启动把供应商模板（seed/vendor）与提示词模板（seed/modelPrompt）
#      初始化到数据卷（之后保留运行时定制，升级不再覆盖）。
#   3) 若设置 ADMIN_PASSWORD，将内置管理员（name=admin）密码覆盖为指定值。
#      （注：首次启动时管理员由应用 initDB 创建，故首次启动后重启一次即生效，
#        也可在运营后台直接修改密码。）
# =============================================================================
set -e

DATA_DIR="${DATA_DIR:-/app/data}"
SEED_DIR="/app/seed"

# 1) 前端产物：每次启动都从镜像刷新（web 属应用资产，业务数据不在此目录）
if [ -d "$SEED_DIR/web" ] && [ -n "$(ls -A "$SEED_DIR/web" 2>/dev/null)" ]; then
  mkdir -p "$DATA_DIR/web"
  cp -a "$SEED_DIR/web/." "$DATA_DIR/web/"
  echo "[entrypoint] 前端静态资源已同步到 $DATA_DIR/web"
fi

# 2a) 供应商模板：仅首次启动时初始化（保留运行时对模板的定制）
if [ -d "$SEED_DIR/vendor" ] && [ -n "$(ls -A "$SEED_DIR/vendor" 2>/dev/null)" ]; then
  if [ ! -d "$DATA_DIR/vendor" ] || [ -z "$(ls -A "$DATA_DIR/vendor" 2>/dev/null)" ]; then
    mkdir -p "$DATA_DIR/vendor"
    cp -a "$SEED_DIR/vendor/." "$DATA_DIR/vendor/"
    echo "[entrypoint] 供应商模板已初始化到 $DATA_DIR/vendor"
  fi
fi

# 2b) 提示词模板：仅首次启动时初始化
if [ -d "$SEED_DIR/modelPrompt" ] && [ -n "$(ls -A "$SEED_DIR/modelPrompt" 2>/dev/null)" ]; then
  if [ ! -d "$DATA_DIR/modelPrompt" ] || [ -z "$(ls -A "$DATA_DIR/modelPrompt" 2>/dev/null)" ]; then
    mkdir -p "$DATA_DIR/modelPrompt"
    cp -a "$SEED_DIR/modelPrompt/." "$DATA_DIR/modelPrompt/"
    echo "[entrypoint] 提示词模板已初始化到 $DATA_DIR/modelPrompt"
  fi
fi

# 2c) Embedding ONNX 模型：仅首次启动时初始化
#     （initDB 首次建表需要 all-MiniLM-L6-v2 模型，缺失会中断建表流程）
if [ -d "$SEED_DIR/models" ] && [ -n "$(ls -A "$SEED_DIR/models" 2>/dev/null)" ]; then
  if [ ! -d "$DATA_DIR/models" ] || [ -z "$(ls -A "$DATA_DIR/models" 2>/dev/null)" ]; then
    mkdir -p "$DATA_DIR/models"
    cp -a "$SEED_DIR/models/." "$DATA_DIR/models/"
    echo "[entrypoint] Embedding 模型已初始化到 $DATA_DIR/models"
  fi
fi

# 3) ADMIN_PASSWORD：若已指定且数据库存在，则覆盖内置管理员密码
if [ -n "$ADMIN_PASSWORD" ] && [ -f "$DATA_DIR/db2.sqlite" ]; then
  if node /usr/local/bin/ensure-admin-password.cjs "$DATA_DIR/db2.sqlite" "$ADMIN_PASSWORD"; then
    echo "[entrypoint] 已按 ADMIN_PASSWORD 设置管理员密码"
  else
    echo "[entrypoint] 警告: 管理员尚不存在或密码设置失败（首次启动由应用创建，重启后生效）" >&2
  fi
fi

exec "$@"
