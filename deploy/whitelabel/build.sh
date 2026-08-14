#!/usr/bin/env bash
# =============================================================================
# Toonflow 白标打包脚本（Phase 3 / P3-2）
#
# 为每个客户生成一套独立的、带品牌的部署目录：
#   deploy/whitelabel/<clientName>/
#     ├── .env                  # 客户品牌 + 部署参数（后端 initDB 启动时读取）
#     ├── docker-compose.yml    # 独立编排，引用同目录 .env
#     └── README.md             # 客户访问地址 / 账号 / 品牌注入说明
#
# 品牌机制（与后端 src/lib/initDB.ts 的 siteEnvMap 一一对应，勿改键名）：
#   SITE_NAME / LOGO_URL / PRIMARY_COLOR / ICP_NO / CUSTOMER_SERVICE /
#   REGISTER_OPEN / ANNOUNCEMENT
# 后端启动时把这些环境变量覆盖写入 o_site_config，前端经 GET /api/site/config
# 动态读取做品牌化（标题 / logo / 主题色 / 备案 / 公告 / 注册开关）。
#
# 用法：
#   ./build.sh                            # 按 clients.json 打包全部客户
#   ./build.sh --client <name>            # 只打包清单中指定客户
#   ./build.sh --force                    # 覆盖已存在的 .env / compose / README
#   ./build.sh <name> <siteName> [键值...] # 临时单客户 CLI 打包（不改清单）
#       可选键值：--primary-color --logo-url --icp-no --customer-service
#                 --announcement --register-open --host-port --image --domain
#
# 说明：本脚本只做"品牌变量注入 .env"的机制；同一镜像 toonflow:lan 无需重建即可
#       换肤。若后续要"每个客户独立镜像 / 独立域名"，预留字段 image / domain，
#       传入即可（image 会写入 compose，domain 会写入 README）。
# =============================================================================
set -euo pipefail

# ---- 路径 ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WL_DIR="$SCRIPT_DIR"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

CLIENTS_FILE="${CLIENTS_FILE:-$WL_DIR/clients.json}"
FORCE=0
SINGLE_CLIENT=""

# ---- 后端容器内部固定端口（src/app.ts 硬编码 10588，勿改） ----
CONTAINER_PORT=10588

# ---- 默认值 ----
DEFAULT_IMAGE="toonflow:lan"
DEFAULT_REGISTER_OPEN="1"
DEFAULT_HOST_PORT="$CONTAINER_PORT"

# =============================================================================
# 工具函数
# =============================================================================
die() { echo "[错误] $*" >&2; exit 1; }
info() { echo "[打包] $*"; }

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

# 生成 .env（品牌变量名必须与后端 siteEnvMap 完全一致）
write_env() {
  local client_name="$1" site_name="$2" primary_color="$3" logo_url="$4" icp_no="$5" \
        customer_service="$6" announcement="$7" register_open="$8" host_port="$9" image="${10}"
  local dir="$WL_DIR/$client_name"

  cat > "$dir/.env" <<EOF
# ============================================================
# 客户：${site_name}（clientName: ${client_name}）
# 本文件由 deploy/whitelabel/build.sh 自动生成，可直接修改后重建容器生效
# 品牌变量与后端 src/lib/initDB.ts 的 siteEnvMap 一一对应
# ============================================================
# 客户标识（用于 compose 容器名 / 数据卷隔离，勿含空格）
CLIENT_NAME=${client_name}

# ---- 品牌（后端启动时覆盖写入 o_site_config） ----
SITE_NAME=${site_name}
LOGO_URL=${logo_url}
PRIMARY_COLOR=${primary_color}
ICP_NO=${icp_no}
CUSTOMER_SERVICE=${customer_service}
REGISTER_OPEN=${register_open}
ANNOUNCEMENT=${announcement}

# ---- 部署参数 ----
# 镜像：默认 toonflow:lan；如需客户独立镜像，改为独立 tag 后 docker compose up -d --build
TOONFLOW_IMAGE=${image}
# 宿主机对外端口 -> 容器 10588（app.ts 硬编码 10588）
HOST_PORT=${host_port}
EOF
}

# 生成 docker-compose.yml（引用同目录 .env；compose 自动从 .env 取变量做替换）
write_compose() {
  local client_name="$1" host_port="$2" image="$3"
  local dir="$WL_DIR/$client_name"

  cat > "$dir/docker-compose.yml" <<'COMPOSE_EOF'
version: "3.8"

# Toonflow 白标部署（客户：{{CLIENT_NAME}}）
# 部署说明见 docs/whitelabel.md；升级 / 备份见 docs/upgrade-backup.md
# 若平台级一键安装包已提供公共 deploy/docker-compose.yml，可复用公共编排并仅替换 .env
services:
  toonflow:
    image: {{IMAGE}}
    container_name: toonflow-{{CLIENT_NAME}}
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "{{HOST_PORT}}:10588"
    volumes:
      # /app/data 存放 db2.sqlite、oss/、assets/、web/ 等全部运行时数据
      - toonflow-{{CLIENT_NAME}}-data:/app/data

volumes:
  toonflow-{{CLIENT_NAME}}-data:
COMPOSE_EOF

  # 用 sed 把 {{TOKEN}} 替换为实际值（compose 自己的 ${VAR} 保持原样，由 compose 读取 .env）
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' \
      -e "s|{{CLIENT_NAME}}|$client_name|g" \
      -e "s|{{HOST_PORT}}|$host_port|g" \
      -e "s|{{IMAGE}}|$image|g" \
      "$dir/docker-compose.yml"
  else
    sed -i \
      -e "s|{{CLIENT_NAME}}|$client_name|g" \
      -e "s|{{HOST_PORT}}|$host_port|g" \
      -e "s|{{IMAGE}}|$image|g" \
      "$dir/docker-compose.yml"
  fi
}

# 生成 README.md
write_readme() {
  local client_name="$1" site_name="$2" primary_color="$3" logo_url="$4" icp_no="$5" \
        customer_service="$6" announcement="$7" register_open="$8" host_port="$9" domain="${10}"
  local dir="$WL_DIR/$client_name"
  local access="${domain:-http://<宿主机IP>:$host_port}"
  local reg_text; [[ "$register_open" == "0" ]] && reg_text="关闭（仅隐藏前端注册入口）" || reg_text="开放"

  cat > "$dir/README.md" <<EOF
# ${site_name} —— Toonflow 白标部署包

> 由 \`deploy/whitelabel/build.sh\` 自动生成（客户：\`${client_name}\`）

## 访问地址

- **前端 + API**：${access}
- 容器内部端口：10588（应用固定，见 \`backend/src/app.ts\`）

## 账号

- 默认管理员：\`admin\` / \`admin123\`（首次登录后请立即修改密码）
- 普通用户：注册开关 ${reg_text}；若需关闭后台注册，请在「运营后台」关闭或将
  \`.env\` 中 \`REGISTER_OPEN=0\` 后重建容器。

## 已注入的品牌（.env -> o_site_config -> /api/site/config）

| 配置项 | 值 |
| --- | --- |
| 站点名 SITE_NAME | ${site_name} |
| 主题色 PRIMARY_COLOR | ${primary_color} |
| Logo LOGO_URL | ${logo_url} |
| 备案 ICP_NO | ${icp_no} |
| 客服 CUSTOMER_SERVICE | ${customer_service} |
| 公告 ANNOUNCEMENT | ${announcement} |
| 注册开关 REGISTER_OPEN | ${register_open}（${reg_text}） |

> 前端通过 \`GET /api/site/config\` 动态读取品牌配置，**无需重建前端/镜像即可换肤**。

## 启动 / 停止

\`\`\`bash
cd deploy/whitelabel/${client_name}
docker compose up -d      # 启动（首次会自动拉取/构建镜像并初始化数据库）
docker compose down       # 停止（数据保留在卷 toonflow_${client_name}_data）
docker compose logs -f    # 查看日志
\`\`\`

## 数据与备份

- 容器内数据目录：\`/app/data\`（db2.sqlite、oss/、assets/、web/ 等）
- 宿主持久化：命名卷 \`toonflow_${client_name}_data\`
- 备份 / 恢复 / 升级步骤：见 \`docs/upgrade-backup.md\`

## 注意

- \`REGISTER_OPEN\` 环境变量只写入 \`o_site_config\`（前端隐藏注册入口）；后端注册接口
  的开关读 \`o_setting.registerOpen\`，需在运营后台关闭注册后才会同步到该键。
EOF
}

# 生成单客户三件套（目录不存在则创建）
generate_client() {
  local client_name="$1" site_name="$2" primary_color="$3" logo_url="$4" icp_no="$5" \
        customer_service="$6" announcement="$7" register_open="$8" host_port="$9" image="${10}" domain="${11}"
  local dir="$WL_DIR/$client_name"

  [[ -n "$client_name" && "$client_name" != "null" ]] || die "客户 name 不能为空"
  [[ -n "$site_name" && "$site_name" != "null" ]] || die "客户 ${client_name} 的 siteName 不能为空"
  [[ "$register_open" == "0" || "$register_open" == "1" ]] || register_open="$DEFAULT_REGISTER_OPEN"
  [[ "$host_port" =~ ^[0-9]+$ ]] || host_port="$DEFAULT_HOST_PORT"
  [[ -n "$image" && "$image" != "null" ]] || image="$DEFAULT_IMAGE"
  [[ -n "$domain" && "$domain" != "null" ]] || domain=""

  if [[ -d "$dir" && "$FORCE" != "1" && -f "$dir/.env" ]]; then
    info "跳过 ${client_name}（已存在，使用 --force 覆盖）"
    return 0
  fi

  mkdir -p "$dir"
  write_env "$client_name" "$site_name" "$primary_color" "$logo_url" "$icp_no" \
            "$customer_service" "$announcement" "$register_open" "$host_port" "$image"
  write_compose "$client_name" "$host_port" "$image"
  write_readme "$client_name" "$site_name" "$primary_color" "$logo_url" "$icp_no" \
               "$customer_service" "$announcement" "$register_open" "$host_port" "$domain"
  info "已生成 $client_name -> deploy/whitelabel/$client_name/"
}

# =============================================================================
# 参数解析
# =============================================================================
if [[ $# -gt 0 && ( "$1" == "-h" || "$1" == "--help" ) ]]; then usage; fi

CLI_NAME="" CLI_SITE=""
# 手工解析长选项（getopts 不支持长选项，且要支持位置参数在前的临时单客户模式）
args=("$@")
i=0
while [[ $i -lt ${#args[@]} ]]; do
  case "${args[$i]}" in
    --force) FORCE=1 ;;
    --client) i=$((i+1)); SINGLE_CLIENT="${args[$i]:-}" ;;
    --clients) i=$((i+1)); CLIENTS_FILE="${args[$i]:-}" ;;
    --primary-color) i=$((i+1)); CLI_PRIMARY="${args[$i]:-}" ;;
    --logo-url)     i=$((i+1)); CLI_LOGO="${args[$i]:-}" ;;
    --icp-no)       i=$((i+1)); CLI_ICP="${args[$i]:-}" ;;
    --customer-service) i=$((i+1)); CLI_CS="${args[$i]:-}" ;;
    --announcement) i=$((i+1)); CLI_ANN="${args[$i]:-}" ;;
    --register-open) i=$((i+1)); CLI_REG="${args[$i]:-}" ;;
    --host-port)    i=$((i+1)); CLI_PORT="${args[$i]:-}" ;;
    --image)        i=$((i+1)); CLI_IMAGE="${args[$i]:-}" ;;
    --domain)       i=$((i+1)); CLI_DOMAIN="${args[$i]:-}" ;;
    --) i=$((i+1)); break ;;
    -*) die "未知参数：${args[$i]}（见 --help）" ;;
    *)
      # 位置参数：临时单客户模式 <name> <siteName>
      if [[ -z "$CLI_NAME" ]]; then CLI_NAME="${args[$i]}"
      elif [[ -z "$CLI_SITE" ]]; then CLI_SITE="${args[$i]}"
      else die "多余的位置参数：${args[$i]}"
      fi
      ;;
  esac
  i=$((i+1))
done

# ---- 模式一：临时单客户 CLI 打包 ----
if [[ -n "$CLI_NAME" ]]; then
  [[ -n "$CLI_SITE" ]] || die "单客户模式需要 <siteName>：./build.sh <name> <siteName> [键值...]"
  generate_client "$CLI_NAME" "$CLI_SITE" "${CLI_PRIMARY:-#0052D9}" "${CLI_LOGO:-}" \
                  "${CLI_ICP:-}" "${CLI_CS:-}" "${CLI_ANN:-}" "${CLI_REG:-$DEFAULT_REGISTER_OPEN}" \
                  "${CLI_PORT:-$DEFAULT_HOST_PORT}" "${CLI_IMAGE:-$DEFAULT_IMAGE}" "${CLI_DOMAIN:-}"
  echo "完成。部署说明见 deploy/whitelabel/$CLI_NAME/README.md"
  exit 0
fi

# ---- 模式二：清单打包（clients.json） ----
if [[ ! -f "$CLIENTS_FILE" ]]; then
  if [[ -f "$WL_DIR/clients.example.json" ]]; then
    cp "$WL_DIR/clients.example.json" "$CLIENTS_FILE"
    info "未找到 $CLIENTS_FILE，已从 clients.example.json 复制，请编辑后重跑"
  else
    die "找不到客户清单：$CLIENTS_FILE（可先按 clients.example.json 创建）"
  fi
  exit 0
fi

command -v jq >/dev/null 2>&1 || die "清单模式需要 jq（macOS: brew install jq）"

count=$(jq 'length' "$CLIENTS_FILE")
[[ "$count" -gt 0 ]] || die "客户清单为空：$CLIENTS_FILE"
info "从 $CLIENTS_FILE 读取到 $count 个客户"

jq -c '.[]' "$CLIENTS_FILE" | while read -r c; do
  name=$(jq -r '.name // empty' <<<"$c")
  if [[ -n "$SINGLE_CLIENT" && "$name" != "$SINGLE_CLIENT" ]]; then
    continue
  fi
  generate_client \
    "$name" \
    "$(jq -r '.siteName // empty' <<<"$c")" \
    "$(jq -r '.primaryColor // "#0052D9"' <<<"$c")" \
    "$(jq -r '.logoUrl // empty' <<<"$c")" \
    "$(jq -r '.icpNo // empty' <<<"$c")" \
    "$(jq -r '.customerService // empty' <<<"$c")" \
    "$(jq -r '.announcement // empty' <<<"$c")" \
    "$(jq -r '.registerOpen // "'"$DEFAULT_REGISTER_OPEN"'"' <<<"$c")" \
    "$(jq -r '.hostPort // "'"$DEFAULT_HOST_PORT"'"' <<<"$c")" \
    "$(jq -r '.image // "'"$DEFAULT_IMAGE"'"' <<<"$c")" \
    "$(jq -r '.domain // empty' <<<"$c")"
done

echo "全部完成。各客户部署包见 deploy/whitelabel/<clientName>/，部署说明见 docs/whitelabel.md"
