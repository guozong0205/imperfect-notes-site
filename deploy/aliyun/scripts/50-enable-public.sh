#!/bin/bash
# Switch the independent nginx from localhost:8870 to public :80 and :443.
# Refuses to run unless the operator repeats the ECS address.
# Does not open a security group, change firewall rules, or unmask system nginx.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_root
require_env IMPERFECTNOTES_ENABLE_PUBLIC yes
require_env IMPERFECTNOTES_PUBLIC_CONFIRM "$PUBLIC_IP"
[ -z "$SYSROOT" ] || die "打开公网不能在 IMPERFECTNOTES_SYSROOT 演练里执行。"
managed_etc_ok
assert_system_nginx_not_running

cert="/etc/letsencrypt/live/imperfectnotes.com/fullchain.pem"
key="/etc/letsencrypt/live/imperfectnotes.com/privkey.pem"
[ -f "$cert" ] && [ -f "$key" ] || die "没有 Let's Encrypt 证书。先完成阶段 40。不要使用自签证书对外服务。"

end_epoch="$(date -d "$(openssl x509 -enddate -noout -in "$cert" | cut -d= -f2)" +%s)"
days="$(( (end_epoch - $(date +%s)) / 86400 ))"
[ "$days" -gt 14 ] || die "证书不足 14 天。先续签，再开公网。"
sans="$(openssl x509 -in "$cert" -noout -ext subjectAltName)"
echo "$sans" | grep -q "DNS:${APEX_HOST}" || die "证书没有 ${APEX_HOST}。"
echo "$sans" | grep -q "DNS:${WWW_HOST}" || die "证书没有 ${WWW_HOST}。"

for port in 80 443; do
  assert_port_free "$port"
done

[ -f "$ETC_DIR/nginx-public.conf" ] || die "缺少 nginx-public.conf。先跑阶段 20。"
assert_forbidden_ports_untouched "$ETC_DIR/nginx-public.conf"
mkdir -p "$WWW_DIR/acme/.well-known/acme-challenge"

backup_tree "$ETC_DIR/nginx.conf" "nginx.conf"
saved_conf="$(backup_stamp)/nginx.conf"
cp "$ETC_DIR/nginx-public.conf" "$ETC_DIR/nginx.conf.next"
if ! nginx_test "$ETC_DIR/nginx.conf.next"; then
  rm -f "$ETC_DIR/nginx.conf.next"
  die "公网配置 nginx -t 失败，没有切换，也没有启动。"
fi
mv "$ETC_DIR/nginx.conf.next" "$ETC_DIR/nginx.conf"
if ! nginx_reload_or_start; then
  if [ -f "$saved_conf" ]; then
    cp -a "$saved_conf" "$ETC_DIR/nginx.conf"
    nginx_reload_or_start || true
  fi
  die "重载失败，已尝试退回上一份配置。没有改防火墙。"
fi

note "独立 nginx 已按公网配置重载。127.0.0.1:8870 会随配置关闭。"
note "安全组仍需你在阿里云控制台手工新增，脚本没有改它："
note "  入方向 TCP 80  来源 0.0.0.0/0"
note "  入方向 TCP 443 来源 0.0.0.0/0"
note "不要改 22，不要开放 3389、8870、8765-8768。"
note "在安全组放行之前，公网仍访问不到。DNS 也还没有切。"
note "本机可先检查："
note "  curl -I --resolve ${APEX_HOST}:443:127.0.0.1 https://${APEX_HOST}/"
note "证书不会因为打开了 443 就自动续签。阶段 70 完成前，到期风险仍在。"
