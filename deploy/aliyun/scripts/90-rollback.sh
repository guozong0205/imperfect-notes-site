#!/bin/bash
# Roll the independent site back. Does not start system nginx, does not delete
# releases, and does not call Cloudflare. DNS rollback is printed for the operator.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_root
managed_etc_ok
mode="${IMPERFECTNOTES_ROLLBACK:-}"
case "$mode" in
  localhost|stop) ;;
  *) die "需要 IMPERFECTNOTES_ROLLBACK=localhost 或 IMPERFECTNOTES_ROLLBACK=stop。" ;;
esac

backup_tree "$ETC_DIR" "etc-imperfectnotes"
if [ -n "$SYSROOT" ]; then
  note "SYSROOT 演练：不调用 systemctl。"
else
  if [ "$mode" = "stop" ]; then
    systemctl disable --now imperfectnotes-static || true
    note "已停止并禁用 imperfectnotes-static。系统 nginx 保持原状，没有 unmask。"
  fi
fi

if [ "$mode" = "localhost" ]; then
  [ -f "$ETC_DIR/nginx-localhost.conf" ] || die "缺少 localhost 配置，无法退回。"
  cp "$ETC_DIR/nginx-localhost.conf" "$ETC_DIR/nginx.conf.next"
  if ! nginx_test "$ETC_DIR/nginx.conf.next"; then
    rm -f "$ETC_DIR/nginx.conf.next"
    die "退回配置 nginx -t 失败，没有切换。"
  fi
  mv "$ETC_DIR/nginx.conf.next" "$ETC_DIR/nginx.conf"
  if [ -z "$SYSROOT" ]; then
    systemctl enable imperfectnotes-static
    nginx_reload_or_start
  fi
  note "已退回 127.0.0.1:${LOCAL_PORT}。公网 80/443 不再由这份配置监听。"
fi

if [ "${IMPERFECTNOTES_RESTORE_PREVIOUS:-}" = "yes" ]; then
  previous_file="$WWW_DIR/previous-target"
  [ -f "$previous_file" ] || die "没有 previous-target。"
  previous="$(tr -d '[:space:]' < "$previous_file")"
  case "$previous" in
    releases/[A-Za-z0-9]*) ;;
    *) die "previous-target 不是 releases/ 下的相对路径。" ;;
  esac
  [ -d "$WWW_DIR/$previous" ] || die "旧发布目录不存在。"
  ln -s "$previous" "$WWW_DIR/current.next"
  mv -Tf "$WWW_DIR/current.next" "$WWW_DIR/current"
  note "current 已指回 $previous。没有删除任何 release 目录。"
fi

cat <<EOF
DNS 回退要在 Cloudflare 手工做。脚本没有 API 权限，也不会改 DNS。
把下面的记录改回去，并保留邮件记录不动：
  A     ${APEX_HOST}    ${GITHUB_PAGES_A[0]}
  A     ${APEX_HOST}    ${GITHUB_PAGES_A[1]}
  A     ${APEX_HOST}    ${GITHUB_PAGES_A[2]}
  A     ${APEX_HOST}    ${GITHUB_PAGES_A[3]}
  CNAME ${WWW_HOST}     ${GITHUB_WWW_CNAME}
不要改 MX、SPF、cf2024-1._domainkey、_dmarc。
灰色云朵保持 DNS-only。
回退后用：bash 60-cutover-check.sh before
网站文件仍在 ${WWW_DIR}/releases/。/opt/imperfect-notes-staging 没有被这个脚本碰过。
EOF
