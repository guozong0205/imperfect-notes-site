#!/bin/bash
# After DNS points at this ECS and port 80 is reachable, switch renewal from
# manual DNS-01 to HTTP-01 webroot. A failed dry-run restores the old renewal file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_root
require_env IMPERFECTNOTES_ENABLE_HTTP01_RENEW yes
[ -z "$SYSROOT" ] || die "切换续签不能在 IMPERFECTNOTES_SYSROOT 演练里执行。"
command -v dig >/dev/null 2>&1 || die "需要 dig。"
command -v certbot >/dev/null 2>&1 || die "需要 certbot。"

a_records="$(dig +short "$APEX_HOST" A | tr '\n' ' ')"
echo " $a_records " | grep -q " $PUBLIC_IP " || die "A 记录还不是 $PUBLIC_IP。HTTP-01 现在会验证到 GitHub Pages，不能切换续签。"
for ip in "${GITHUB_PAGES_A[@]}"; do
  echo " $a_records " | grep -q " $ip " && die "A 记录仍包含 GitHub Pages 地址 $ip。"
done
www_ips="$(dig +short "$WWW_HOST" A | tr '\n' ' ')"
echo " $www_ips " | grep -q " $PUBLIC_IP " || die "www 还没解析到 $PUBLIC_IP。两个域名都要能完成 HTTP-01。"

renewal="/etc/letsencrypt/renewal/imperfectnotes.com.conf"
[ -f "$renewal" ] || die "没有 renewal 配置。先完成阶段 40。"
backup_tree "$renewal" "renewal.conf"
saved="$(backup_stamp)/renewal.conf"

webroot="$WWW_DIR/acme"
mkdir -p "$webroot/.well-known/acme-challenge"
token="imperfectnotes-ping-$$"
trap 'rm -f "$webroot/.well-known/acme-challenge/$token"' EXIT
printf '%s' "$token" > "$webroot/.well-known/acme-challenge/$token"
chmod a+r "$webroot/.well-known/acme-challenge/$token"

for host in "$APEX_HOST" "$WWW_HOST"; do
  body="$(curl -fsS --max-time 20 "http://${host}/.well-known/acme-challenge/${token}")"
  [ "$body" = "$token" ] || die "$host 的 HTTP-01 目录没有返回探测文件。没有修改续签配置。"
  note "通过 $host 探测文件"
done
rm -f "$webroot/.well-known/acme-challenge/$token"
trap - EXIT

live_cert="/etc/letsencrypt/live/imperfectnotes.com/cert.pem"
[ -f "$live_cert" ] || die "没有生产证书。不要为了切换续签方式重新签发。"
cert_before="$(sha256sum "$live_cert" | awk '{print $1}')"

# Certbot 2.9.0 keeps pref_challs from the renewal file unless this flag is
# set on the command line. manual issuance stored dns-01, and the webroot
# plugin only supports http-01. --preferred-challenges http is the documented
# alias and is parsed by reconfigure even though that verb's short help omits it.
if ! certbot reconfigure \
  --non-interactive \
  --cert-name imperfectnotes.com \
  --authenticator webroot \
  --webroot-path "$webroot" \
  --preferred-challenges http \
  --deploy-hook "/bin/bash $ETC_DIR/reload-nginx.sh"; then
  cp -a "$saved" "$renewal"
  die "certbot reconfigure 失败。已恢复原来的 renewal 配置。没有写入 http-01，也没有重签生产证书。"
fi

if ! certbot renew --cert-name imperfectnotes.com --dry-run --non-interactive; then
  cp -a "$saved" "$renewal"
  die "certbot renew --dry-run 失败。已把续签配置改回。没有写入 http-01。"
fi

cert_after="$(sha256sum "$live_cert" | awk '{print $1}')"
if [ "$cert_before" != "$cert_after" ]; then
  cp -a "$saved" "$renewal"
  die "生产证书文件变了。已恢复 renewal 配置。不要把这次结果当成续签切换完成。"
fi

mkdir -p "$LIB_DIR"
printf '%s\n' "http-01" > "$LIB_DIR/renewal-mode"
systemctl enable --now certbot.timer
note "HTTP-01 演练成功，certbot.timer 已启用。这是避免 90 天后过期的必要步骤。"
bash "$ETC_DIR/cert-watch.sh" || die "cert-watch 仍报续签未就绪。"
