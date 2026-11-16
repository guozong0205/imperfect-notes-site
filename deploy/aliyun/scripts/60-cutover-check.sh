#!/bin/bash
# Read-only checks before and after the DNS change. Safe to run from any
# machine that can resolve the public domain. Does not change DNS.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

mode="${1:-}"
manifest="${2:-}"
case "$mode" in
  before|after) ;;
  *) die "用法：$0 before|after [manifest.sha256]" ;;
esac
command -v dig >/dev/null 2>&1 || die "需要 dig。可安装 dnsutils，脚本不会自动安装。"

fail=0
bad() { note "失败 $*"; fail=1; }
ok() { note "通过 $*"; }

a_records="$(dig +short "$APEX_HOST" A | LC_ALL=C sort | tr '\n' ' ')"
www_cname="$(dig +short "$WWW_HOST" CNAME | tr '\n' ' ')"
mx="$(dig +short "$APEX_HOST" MX | tr '\n' ' ')"
spf="$(dig +short "$APEX_HOST" TXT | tr '\n' ' ')"
note "A [$a_records]"
note "www CNAME [$www_cname]"
note "MX [$mx]"
note "TXT [$spf]"

echo "$mx" | grep -q 'route1.mx.cloudflare.net' || bad "MX 里没有 Cloudflare route1"
echo "$mx" | grep -q 'route2.mx.cloudflare.net' || bad "MX 里没有 Cloudflare route2"
echo "$mx" | grep -q 'route3.mx.cloudflare.net' || bad "MX 里没有 Cloudflare route3"
echo "$spf" | grep -q 'v=spf1 include:_spf.mx.cloudflare.net ~all' || bad "SPF 变了"

if [ "$mode" = "before" ]; then
  for ip in "${GITHUB_PAGES_A[@]}"; do
    echo " $a_records " | grep -q " $ip " || bad "切流前缺少 GitHub Pages 地址 $ip"
  done
  echo " $a_records " | grep -q " $PUBLIC_IP " && bad "切流前 A 记录已经包含 $PUBLIC_IP"
  echo "$www_cname" | grep -q "$GITHUB_WWW_CNAME" || bad "www 还不是 $GITHUB_WWW_CNAME"
else
  echo " $a_records " | grep -q " $PUBLIC_IP " || bad "切流后 A 不是 $PUBLIC_IP"
  for ip in "${GITHUB_PAGES_A[@]}"; do
    echo " $a_records " | grep -q " $ip " && bad "切流后仍有 GitHub Pages 地址 $ip"
  done
  www_ips="$(dig +short "$WWW_HOST" A | tr '\n' ' ')"
  echo " $www_ips " | grep -q " $PUBLIC_IP " || bad "www 没有解析到 $PUBLIC_IP"
fi

home_code="$(curl -sS -o /tmp/in-home -D /tmp/in-headers --max-time 25 -w '%{http_code}' "https://${APEX_HOST}/" || true)"
[ "$home_code" = "200" ] && ok "首页 200" || bad "首页 $home_code"
grep -q '辽ICP备2026023787号-1' /tmp/in-home || bad "首页没有备案号"
self_code="$(curl -sS -o /tmp/in-self --max-time 25 -w '%{http_code}' "https://${APEX_HOST}/self/" || true)"
[ "$self_code" = "200" ] && ok "/self/ 200" || bad "/self/ $self_code"
grep -q 'location.replace("/")' /tmp/in-self || bad "/self/ 不是当前页内跳转"
ziwei_code="$(curl -sS -o /tmp/in-ziwei --max-time 40 -w '%{http_code}' "https://${APEX_HOST}/ziwei/" || true)"
[ "$ziwei_code" = "200" ] && ok "/ziwei/ 200" || bad "/ziwei/ $ziwei_code"
grep -q 'ziwei-interpreter.imperfectnotes.workers.dev' /tmp/in-ziwei || bad "/ziwei/ 丢了解读接口"
miss_code="$(curl -sS -o /dev/null --max-time 25 -w '%{http_code}' "https://${APEX_HOST}/does-not-exist" || true)"
[ "$miss_code" = "404" ] && ok "未知路径 404" || bad "未知路径 $miss_code"
www_code="$(curl -sS -o /dev/null -D /tmp/in-www --max-time 25 -w '%{http_code}' "https://${WWW_HOST}/shop" || true)"
[ "$www_code" = "301" ] && ok "www 301" || bad "www $www_code"
tr -d '\r' < /tmp/in-www | grep -qi '^Location: https://imperfectnotes.com/shop$' || bad "www 跳转目标不对"
range_code="$(curl -sS -o /tmp/in-range -D /tmp/in-range-headers --max-time 25 -H 'Range: bytes=0-15' -w '%{http_code}' "https://${APEX_HOST}/assets/covers/about.jpg" || true)"
[ "$range_code" = "206" ] && ok "图片范围 206" || bad "图片范围 $range_code"

if [ -z "$manifest" ] && [ -f "$WWW_DIR/releases/${PINNED_SHORT}.manifest.sha256" ]; then
  manifest="$WWW_DIR/releases/${PINNED_SHORT}.manifest.sha256"
fi
if [ -n "$manifest" ]; then
  expected="$(awk '$2=="index.html" {print $1}' "$manifest")"
  actual="$(sha256sum /tmp/in-home | awk '{print $1}')"
  if [ -n "$expected" ] && [ "$expected" = "$actual" ]; then
    ok "首页字节与发布清单一致"
  else
    bad "首页字节与发布清单不一致 expected=$expected actual=$actual"
  fi
else
  note "未提供 manifest，跳过字节比对。"
fi

if [ "$mode" = "after" ]; then
  issuer="$(echo | openssl s_client -servername "$APEX_HOST" -connect "${APEX_HOST}:443" 2>/dev/null | openssl x509 -noout -issuer || true)"
  echo "$issuer" | grep -q "Let's Encrypt" && ok "证书签发者是 Let's Encrypt" || bad "证书签发者不是 Let's Encrypt：$issuer"
  mp3_code="$(curl -sS -o /dev/null --max-time 30 -H 'Range: bytes=0-15' -w '%{http_code}' \
    "https://raw.githubusercontent.com/guozong0205/imperfect-notes-assets/main/ep17.mp3" || true)"
  [ "$mp3_code" = "206" ] && ok "外部 mp3 仍支持范围请求" || bad "外部 mp3 范围请求 $mp3_code"
fi

if [ "$fail" -ne 0 ]; then
  die "验收未通过。不要把它当成切流完成。"
fi
note "$mode 验收通过。邮件记录仍在。这不代表备案接入已在控制台核对。"
