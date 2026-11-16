#!/bin/bash
# Read-only acceptance of the localhost listener. Does not change config.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

BASE="http://127.0.0.1:${LOCAL_PORT}"
fail=0

check() {
  local name="$1"
  local want="$2"
  local got="$3"
  if [ "$got" = "$want" ]; then
    note "通过 $name -> $got"
  else
    note "失败 $name 期望 $want 实际 $got"
    fail=1
  fi
}

fetch() {
  local url="$1"
  shift
  curl -sS -o /tmp/imperfectnotes-body -D /tmp/imperfectnotes-headers \
    -A 'imperfectnotes-accept/1' --max-time 20 \
    "$@" -w '%{http_code}' "$url" || true
  tr -d '\r' < /tmp/imperfectnotes-headers > /tmp/imperfectnotes-headers.lf
  mv /tmp/imperfectnotes-headers.lf /tmp/imperfectnotes-headers
}

check "首页" 200 "$(fetch "$BASE/" -H 'Host: imperfectnotes.com')"
grep -q '辽ICP备2026023787号-1' /tmp/imperfectnotes-body || { note "失败 首页没有备案号"; fail=1; }
check "index.html" 200 "$(fetch "$BASE/index.html" -H 'Host: imperfectnotes.com')"
check "shop 无斜杠" 301 "$(fetch "$BASE/shop" -H 'Host: imperfectnotes.com')"
grep -i '^Location: /shop/$' /tmp/imperfectnotes-headers >/dev/null || { note "失败 /shop 没有相对跳到 /shop/"; fail=1; }
check "shop/" 200 "$(fetch "$BASE/shop/" -H 'Host: imperfectnotes.com')"
check "shop 查询串" 301 "$(fetch "$BASE/shop?x=1" -H 'Host: imperfectnotes.com')"
grep -i '^Location: /shop/?x=1$' /tmp/imperfectnotes-headers >/dev/null || { note "失败 查询串没有保留"; fail=1; }
check "self/" 200 "$(fetch "$BASE/self/" -H 'Host: imperfectnotes.com')"
grep -q 'location.replace("/")' /tmp/imperfectnotes-body || { note "失败 /self/ 不是当前页内跳转"; fail=1; }
check "ziwei/" 200 "$(fetch "$BASE/ziwei/" -H 'Host: imperfectnotes.com')"
grep -q 'ziwei-interpreter.imperfectnotes.workers.dev' /tmp/imperfectnotes-body || { note "失败 /ziwei/ 丢了解读接口"; fail=1; }
check "self.css" 200 "$(fetch "$BASE/self/self.css" -H 'Host: imperfectnotes.com')"
check "engine.mjs" 200 "$(fetch "$BASE/self/engine/engine.mjs" -H 'Host: imperfectnotes.com')"
grep -qi '^Content-Type: application/javascript' /tmp/imperfectnotes-headers || { note "失败 mjs 类型不是 javascript"; fail=1; }
check "episodes" 200 "$(fetch "$BASE/data/episodes.json" -H 'Host: imperfectnotes.com')"
check "目录 /assets/" 404 "$(fetch "$BASE/assets/" -H 'Host: imperfectnotes.com')"
check "目录 /self/data/" 404 "$(fetch "$BASE/self/data/" -H 'Host: imperfectnotes.com')"
check "不存在的页" 404 "$(fetch "$BASE/does-not-exist" -H 'Host: imperfectnotes.com')"
grep -q '没有这一页' /tmp/imperfectnotes-body || { note "失败 404 页面不对"; fail=1; }
check "大小写 /SHOP/" 404 "$(fetch "$BASE/SHOP/" -H 'Host: imperfectnotes.com')"
check "收款码仍不存在" 404 "$(fetch "$BASE/assets/pay/alipay-qr.png" -H 'Host: imperfectnotes.com')"
check "www" 301 "$(fetch "$BASE/shop" -H 'Host: www.imperfectnotes.com')"
grep -i '^Location: https://imperfectnotes.com/shop$' /tmp/imperfectnotes-headers >/dev/null || { note "失败 www 跳转目标不对"; fail=1; }
check "未知 Host" 404 "$(fetch "$BASE/" -H 'Host: evil.example')"

range_code="$(curl -sS -D /tmp/imperfectnotes-headers -o /tmp/imperfectnotes-range -H 'Host: imperfectnotes.com' -H 'Range: bytes=0-15' --max-time 20 -w '%{http_code}' "$BASE/assets/covers/about.jpg")"
check "图片范围请求" 206 "$range_code"
grep -qi '^Content-Range: bytes 0-15/' /tmp/imperfectnotes-headers || { note "失败 Content-Range"; fail=1; }
[ "$(wc -c < /tmp/imperfectnotes-range | tr -d ' ')" = "16" ] || { note "失败 范围响应不是 16 字节"; fail=1; }

if [ "$fail" -ne 0 ]; then
  die "本机验收没有通过。"
fi
note "本机验收通过。这还不是公网，也还没有切 DNS。"
