#!/usr/bin/env bash
# =============================================================================
# Toonflow 数据备份
#   将数据卷（db2.sqlite + oss/assets/skills/vendor 等全部运行时数据）打包为
#   deploy/backup/toonflow-data-<时间戳>.tar.gz
# 用法: ./backup.sh
# =============================================================================
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOLUME="${TOONFLOW_DATA_VOLUME:-toonflow_toonflow-data}"
BACKUP_DIR="$DEPLOY_DIR/backup"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="toonflow-data-${TS}.tar.gz"

mkdir -p "$BACKUP_DIR"

if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "[backup] 错误: 数据卷 ${VOLUME} 不存在。请先 docker compose up -d 启动。" >&2
  exit 1
fi

echo "[backup] 备份数据卷 ${VOLUME} -> ${BACKUP_DIR}/${OUT}"
docker run --rm -v "${VOLUME}:/data" -v "${BACKUP_DIR}:/backup" alpine \
  sh -c "tar czf /backup/${OUT} -C /data ."

echo "[backup] 完成: ${BACKUP_DIR}/${OUT}"
echo "[backup] 建议将 backup/ 目录定期同步到异地或对象存储。"
