#!/usr/bin/env bash
# =============================================================================
# Toonflow 数据恢复
#   从备份 tar.gz 恢复数据卷（危险操作，需二次确认；恢复前会停止应用容器）
# 用法: ./restore.sh deploy/backup/toonflow-data-<时间戳>.tar.gz
# =============================================================================
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOLUME="${TOONFLOW_DATA_VOLUME:-toonflow_toonflow-data}"
BACKUP_DIR="$DEPLOY_DIR/backup"

if [ "$#" -lt 1 ]; then
  echo "用法: $0 <备份文件.tar.gz>"
  echo "可用备份:"
  ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "  （backup/ 目录暂无备份）"
  exit 1
fi

BACKUP_FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] 错误: 备份文件不存在: ${BACKUP_FILE}" >&2
  exit 1
fi

if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "[restore] 数据卷 ${VOLUME} 不存在，将先创建。"
  docker volume create "$VOLUME"
fi

echo "[restore] 警告: 即将用 ${BACKUP_FILE} 覆盖数据卷 ${VOLUME} 的现有数据！"
read -r -p "确认继续? （输入 yes 继续）: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "[restore] 已取消。"
  exit 1
fi

# 先停止应用容器，避免写库冲突
if docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps -q >/dev/null 2>&1; then
  echo "[restore] 停止应用容器 ..."
  docker compose -f "$DEPLOY_DIR/docker-compose.yml" stop
fi

echo "[restore] 清空并恢复数据卷 ..."
docker run --rm -v "${VOLUME}:/data" -v "$(dirname "$BACKUP_FILE"):/backup" alpine \
  sh -c "find /data -mindepth 1 -delete 2>/dev/null || true; tar xzf /backup/$(basename "$BACKUP_FILE") -C /data"

echo "[restore] 恢复完成。重新启动应用:"
echo "  cd ${DEPLOY_DIR} && docker compose up -d"
