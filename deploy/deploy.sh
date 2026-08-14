#!/usr/bin/env bash
# =============================================================================
# Toonflow 一键部署
#   1) 首次运行自动从 .env.example 生成 .env
#   2) 校验前端产物（backend/data/web 缺失时自动从 frontend/dist 复制）
#   3) docker compose build && up -d
#   4) 打印访问地址与默认账号提示
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

# 1) 准备 .env
if [ ! -f .env ]; then
  echo "[deploy] 未发现 .env，从 .env.example 生成默认配置"
  cp .env.example .env
fi

# 2) 校验前端产物（backend/data/web 是镜像构建输入；缺失时从 frontend/dist 复制）
if [ ! -f "$ROOT_DIR/backend/data/web/index.html" ]; then
  if [ -f "$ROOT_DIR/frontend/dist/index.html" ]; then
    echo "[deploy] backend/data/web 缺失，从 frontend/dist 复制前端产物"
    mkdir -p "$ROOT_DIR/backend/data/web"
    cp -a "$ROOT_DIR/frontend/dist/." "$ROOT_DIR/backend/data/web/"
  else
    echo "[deploy] 错误: 缺少前端产物 backend/data/web/index.html（frontend/dist 也不存在）。" >&2
    echo "[deploy] 请先构建前端：cd frontend && docker run --rm -v \$PWD:/app -w /app node:24 sh -c 'NODE_OPTIONS=--max-old-space-size=6144 yarn build-only'" >&2
    exit 1
  fi
fi

# 2b) 校验运行时种子资产（Embedding 模型 / 提示词模板，首次建表必需）
#     缺失时尝试从运行中的 toonflow 容器（平台源容器）复制；若无法获取则给出明确提示
copy_seed_from_container() {
  local src="$1" dst="$2" what="$3"
  if docker exec toonflow sh -c "[ -d /app/data/$src ] && [ -n \"\$(ls -A /app/data/$src)\" ]" 2>/dev/null; then
    echo "[deploy] $what 缺失，从运行中的 toonflow 容器复制（$src）"
    mkdir -p "$dst"
    docker cp "toonflow:/app/data/$src/." "$dst/"
  else
    echo "[deploy] 警告: 缺少 $what（$dst）。首次启动建表/视频提示词可能失败。" >&2
    echo "[deploy] 可从任一已运行平台容器复制：docker cp <容器>:/app/data/$src/. $dst" >&2
  fi
}
if [ ! -d "$ROOT_DIR/backend/data/models" ] || [ -z "$(ls -A "$ROOT_DIR/backend/data/models" 2>/dev/null)" ]; then
  copy_seed_from_container models "$ROOT_DIR/backend/data/models" "Embedding ONNX 模型"
fi
if [ ! -d "$ROOT_DIR/backend/data/modelPrompt" ] || [ -z "$(ls -A "$ROOT_DIR/backend/data/modelPrompt" 2>/dev/null)" ]; then
  copy_seed_from_container modelPrompt "$ROOT_DIR/backend/data/modelPrompt" "提示词模板"
fi

# 3) 构建并启动
echo "[deploy] docker compose build && up -d ..."
docker compose build
docker compose up -d

# 4) 打印访问信息
APP_PORT="$(grep -E '^APP_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 || true)"
APP_PORT="${APP_PORT:-10588}"

echo ""
echo "=============================================="
echo " Toonflow 已启动"
echo " 访问地址 : http://localhost:${APP_PORT}"
echo " 默认管理员: admin / admin123"
echo " （首次登录后请及时修改密码；如需用环境变量指定密码，见 .env 的 ADMIN_PASSWORD）"
echo " 查看日志 : cd deploy && docker compose logs -f app"
echo "=============================================="
