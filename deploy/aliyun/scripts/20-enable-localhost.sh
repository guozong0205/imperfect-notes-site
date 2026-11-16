#!/bin/bash
# Install the independent nginx and start it on 127.0.0.1:8870 only.
# nginx -t failure restores the previous config and does not start the unit.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_root
require_env IMPERFECTNOTES_ENABLE_LOCALHOST yes
managed_etc_ok
assert_system_nginx_not_running

NGINX_SRC="$(cd "$SCRIPT_DIR/../nginx" && pwd)"
UNIT_SRC="$(cd "$SCRIPT_DIR/../systemd" && pwd)"
LOGROTATE_SRC="$(cd "$SCRIPT_DIR/../logrotate" && pwd)"

[ -L "$WWW_DIR/current" ] || die "还没有 current 发布链接。先跑 10-install-release.sh。"
[ -f "$WWW_DIR/current/index.html" ] || die "current 里没有 index.html。"

mkdir -p "$LOG_DIR" "$NGINX_LIB" "$ETC_DIR" \
  "$NGINX_LIB/client_body" "$NGINX_LIB/proxy" "$NGINX_LIB/fastcgi" \
  "$NGINX_LIB/uwsgi" "$NGINX_LIB/scgi" \
  "$WWW_DIR/acme/.well-known/acme-challenge"

backup_tree "$ETC_DIR" "etc-imperfectnotes"
saved="$(backup_stamp)/etc-imperfectnotes"
copied=0
keep_new_config=0

restore_etc() {
  managed_etc_ok
  find "$ETC_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  if [ -d "$saved" ]; then
    cp -a "$saved/." "$ETC_DIR/"
    note "已恢复 $ETC_DIR"
  else
    note "没有旧配置可恢复。已撤回刚写入的文件。"
  fi
}

cleanup_on_fail() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ] && [ "$copied" -eq 1 ] && [ "$keep_new_config" -ne 1 ]; then
    restore_etc || true
  fi
  exit "$status"
}
trap cleanup_on_fail EXIT

cp "$NGINX_SRC/http-base.conf" "$ETC_DIR/http-base.conf"
cp "$NGINX_SRC/site.conf" "$ETC_DIR/site.conf"
cp "$NGINX_SRC/404.html" "$ETC_DIR/404.html"
cp "$NGINX_SRC/nginx-localhost.conf" "$ETC_DIR/nginx-localhost.conf"
cp "$NGINX_SRC/nginx-public.conf" "$ETC_DIR/nginx-public.conf"
cp "$SCRIPT_DIR/cert-watch.sh" "$ETC_DIR/cert-watch.sh"
cp "$SCRIPT_DIR/reload-nginx.sh" "$ETC_DIR/reload-nginx.sh"
chmod 755 "$ETC_DIR/cert-watch.sh" "$ETC_DIR/reload-nginx.sh"
cp "$ETC_DIR/nginx-localhost.conf" "$ETC_DIR/nginx.conf"
mkdir -p "$LOGROTATE_DIR"
cp "$LOGROTATE_SRC/imperfectnotes" "$LOGROTATE_DIR/imperfectnotes"
copied=1

assert_forbidden_ports_untouched "$ETC_DIR/nginx.conf"
if grep -E 'listen[[:space:]]+80([^0-9]|$)|listen[[:space:]]+443([^0-9]|$)|listen[[:space:]]+\[::\]' "$ETC_DIR/nginx.conf" >/dev/null; then
  die "localhost 配置监听了公网端口，已撤回。"
fi

nginx_test "$ETC_DIR/nginx.conf"
install_unit "$UNIT_SRC/imperfectnotes-static.service"

if [ -n "$SYSROOT" ]; then
  keep_new_config=1
  note "SYSROOT 演练完成，未启动进程。"
  exit 0
fi

if ss -ltnH "sport = :$LOCAL_PORT" | grep -q .; then
  if systemctl is-active --quiet imperfectnotes-static; then
    systemctl reload imperfectnotes-static
  else
    die "127.0.0.1:$LOCAL_PORT 被其他进程占用。没有结束它，也没有启动本站。"
  fi
else
  systemctl start imperfectnotes-static
fi
keep_new_config=1

systemctl --no-pager --full status imperfectnotes-static || true
note "本机验收地址：curl -H 'Host: imperfectnotes.com' http://127.0.0.1:${LOCAL_PORT}/"
note "没有监听 80/443，没有改安全组，没有 unmask 系统 nginx。"
