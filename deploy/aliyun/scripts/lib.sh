#!/bin/bash
# Shared helpers for the Imperfect Notes Aliyun cutover scripts.
# These scripts prepare and switch a static copy of one pinned commit.
# They do not change DNS, firewall rules, SSH, or the masked system nginx.
# shellcheck disable=SC2034

if [ -z "${IMPERFECTNOTES_LIB_LOADED:-}" ]; then
  IMPERFECTNOTES_LIB_LOADED=1
else
  return 0
fi

set -euo pipefail

PINNED_COMMIT="082fd05c17711c8bdbdafbbf1218306e1d1a17e5"
PINNED_SHORT="082fd05c1771"
LOCAL_PORT="8870"
PUBLIC_IP="39.96.210.138"
APEX_HOST="imperfectnotes.com"
WWW_HOST="www.imperfectnotes.com"
GITHUB_WWW_CNAME="guozong0205.github.io"

# Measured 2026-11-16. Used only as the DNS rollback checklist.
GITHUB_PAGES_A=(
  185.199.108.153
  185.199.109.153
  185.199.110.153
  185.199.111.153
)

SYSROOT="${IMPERFECTNOTES_SYSROOT:-}"
if [ -n "$SYSROOT" ]; then
  case "$SYSROOT" in
    /|/etc|/var|/usr|/opt|/root) echo "拒绝：IMPERFECTNOTES_SYSROOT 不能是系统目录。" >&2; exit 2 ;;
  esac
  case "$SYSROOT" in
    /*) ;;
    *) echo "拒绝：IMPERFECTNOTES_SYSROOT 必须是绝对路径。" >&2; exit 2 ;;
  esac
fi

path_under() {
  printf '%s%s\n' "$SYSROOT" "$1"
}

ETC_DIR="$(path_under /etc/imperfectnotes)"
WWW_DIR="$(path_under /var/www/imperfectnotes)"
LOG_DIR="$(path_under /var/log/imperfectnotes)"
LIB_DIR="$(path_under /var/lib/imperfectnotes)"
NGINX_LIB="$(path_under /var/lib/imperfectnotes-nginx)"
BACKUP_ROOT="$(path_under /var/backups/imperfectnotes)"
UNIT_DIR="$(path_under /etc/systemd/system)"
LOGROTATE_DIR="$(path_under /etc/logrotate.d)"

die() {
  echo "拒绝：$*" >&2
  exit 1
}

note() {
  echo "$*"
}

# Resolve a caller-supplied path before any later cd. Relative paths are
# based on the current directory, then stored as a physical absolute path.
absolute_path() {
  local input="$1"
  local dir name
  if [ ! -e "$input" ]; then
    die "文件不存在：$input"
  fi
  dir="$(cd "$(dirname -- "$input")" && pwd -P)"
  name="$(basename -- "$input")"
  printf '%s/%s\n' "$dir" "$name"
}

require_root() {
  if [ -n "$SYSROOT" ]; then
    return 0
  fi
  if [ "$(id -u)" -ne 0 ]; then
    die "这一步需要 root。在阿里云 Workbench 里用 root 执行，不要配置 SSH。"
  fi
}

require_env() {
  local name="$1"
  local expect="$2"
  local actual="${!name:-}"
  if [ "$actual" != "$expect" ]; then
    die "需要环境变量 ${name}=${expect}（当前为 ${actual:-空}）。"
  fi
}

managed_etc_ok() {
  case "$ETC_DIR" in
    /etc/imperfectnotes) ;;
    /*/etc/imperfectnotes) ;;
    *) die "配置目录异常：$ETC_DIR" ;;
  esac
}

backup_stamp() {
  if [ -z "${BACKUP_DIR:-}" ]; then
    BACKUP_DIR="${BACKUP_ROOT}/$(date +%Y%m%d%H%M%S)-$$"
    mkdir -p "$BACKUP_DIR"
  fi
  printf '%s\n' "$BACKUP_DIR"
}

backup_tree() {
  local src="$1"
  local name="$2"
  local dest
  dest="$(backup_stamp)/$name"
  if [ -e "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -a "$src" "$dest"
    note "已备份 $src -> $dest"
  fi
}

assert_no_symlinks() {
  local dir="$1"
  local found
  found="$(find "$dir" -type l -print)"
  if [ -n "$found" ]; then
    echo "$found" >&2
    die "发布树里有符号链接，已停止。"
  fi
}

assert_tar_members() {
  local tarball="$1"
  local member
  while IFS= read -r member; do
    case "$member" in
      ""|./|. ) continue ;;
      ./*) ;;
      *) die "压缩包成员不是相对路径：$member" ;;
    esac
    case "$member" in
      *..*) die "压缩包成员含有 .. ：$member" ;;
    esac
    case "$member" in
      ./.git/*|./.git|./.gitignore|./CNAME|./.github/*) die "压缩包含有不应发布的文件：$member" ;;
    esac
  done < <(tar -tzf "$tarball")
}

nginx_test() {
  local conf="$1"
  if [ -n "$SYSROOT" ]; then
    note "SYSROOT 演练：跳过 nginx -t $conf"
    return 0
  fi
  /usr/sbin/nginx -t -c "$conf"
}

nginx_reload_or_start() {
  if [ -n "$SYSROOT" ]; then
    note "SYSROOT 演练：跳过启动 imperfectnotes-static。"
    return 0
  fi
  if systemctl is-active --quiet imperfectnotes-static; then
    systemctl reload imperfectnotes-static
  else
    systemctl start imperfectnotes-static
  fi
}

install_unit() {
  local src="$1"
  local name
  name="$(basename "$src")"
  mkdir -p "$UNIT_DIR"
  cp "$src" "$UNIT_DIR/$name"
  if [ -n "$SYSROOT" ]; then
    note "SYSROOT 演练：已放入单元文件，不调用 systemctl。"
    return 0
  fi
  systemctl daemon-reload
  systemctl enable "$name"
}

assert_port_free() {
  local port="$1"
  if [ -n "$SYSROOT" ]; then
    return 0
  fi
  if ss -ltnH "sport = :$port" | grep -q .; then
    ss -ltnp "sport = :$port" >&2 || true
    die "端口 $port 已被占用。脚本不会结束占用它的进程。"
  fi
}

assert_system_nginx_not_running() {
  if [ -n "$SYSROOT" ]; then
    return 0
  fi
  local enabled active
  enabled="$(systemctl is-enabled nginx 2>/dev/null || true)"
  active="$(systemctl is-active nginx 2>/dev/null || true)"
  note "系统 nginx.service：enabled=${enabled:-unknown} active=${active:-unknown}"
  if [ "$active" = "active" ]; then
    die "系统 nginx 正在运行。不要 unmask，也不要停掉它来给本站让路；先确认它不是旧预览再手工处理。"
  fi
}

assert_forbidden_ports_untouched() {
  local conf="$1"
  if grep -E '^[[:space:]]*listen[[:space:]]+([^;[:space:]]*:)?(22|3389|8765|8766|8767|8768)([^0-9;]|$)' "$conf" >/dev/null; then
    die "$conf 监听了禁止端口。"
  fi
  if grep -E '^[[:space:]]*include[[:space:]].*sites-enabled' "$conf" >/dev/null; then
    die "$conf 引入了系统 nginx 的 sites-enabled。"
  fi
}
