#!/usr/bin/env bash
# =============================================================================
# Toonflow 升级
#   1) 备份数据卷（db2.sqlite + oss/assets/skills 等）
#   2) 重新构建镜像（新代码/新前端）
#   3) 滚动更新容器（数据卷保留，前端随新镜像自动刷新）
# 回滚: 使用 restore.sh 恢复 backup/ 下的备份。
# =============================================================================
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

# 数据卷名（与 docker-compose.yml 一致；compose 项目名 toonflow -> toonflow_toonflow-data）
VOLUME="${TOONFLOW_DATA_VOLUME:-toonflow_toonflow-data}"
BACKUP_DIR="$DEPLOY_DIR/backup"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

echo "[upgrade] 1/4 备份数据卷 ${VOLUME} ..."
if docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  OUT="toonflow-data-${TS}.tar.gz"
  docker run --rm -v "${VOLUME}:/data" -v "${BACKUP_DIR}:/backup" alpine \
    sh -c "tar czf /backup/${OUT} -C /data ."
  echo "[upgrade] 备份完成: ${BACKUP_DIR}/${OUT}"
else
  echo "[upgrade] 数据卷 ${VOLUME} 不存在（首次部署？），跳过备份"
fi

echo "[upgrade] 2/4 重新构建镜像（含最新前端产物）..."
# 如后端/前端源码有更新，请先执行各自仓库的 git pull（此处默认不自动拉取）
docker compose build

echo "[upgrade] 3/4 重建并启动容器（数据卷保留）..."
docker compose up -d --force-recreate

echo "[upgrade] 4/4 清理悬空镜像..."
docker image prune -f --filter "dangling=true" || true

APP_PORT="$(grep -E '^APP_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 || true)"
APP_PORT="${APP_PORT:-10588}"
echo ""
echo "[upgrade] 完成。访问 http://localhost:${APP_PORT} 验证。"
echo "[upgrade] 如需回滚: deploy/restore.sh ${BACKUP_DIR}/${OUT}"
