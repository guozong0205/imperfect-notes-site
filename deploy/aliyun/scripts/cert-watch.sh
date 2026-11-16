#!/bin/bash
# Report whether the pinned certificate can renew by itself.
# Exit 1 on a warning so the systemd timer stays visibly failed.
set -euo pipefail

CERT="/etc/letsencrypt/live/imperfectnotes.com/cert.pem"
RENEWAL="/etc/letsencrypt/renewal/imperfectnotes.com.conf"
MODE_FILE="/var/lib/imperfectnotes/renewal-mode"
STATUS_FILE="/var/lib/imperfectnotes/CERT_STATUS"
mkdir -p /var/lib/imperfectnotes

alerts=()
if [ ! -f "$CERT" ]; then
  alerts+=("还没有证书。阶段 40 用 DNS-01 手工 TXT 申请；申请后不会自动续签。")
else
  end_raw="$(openssl x509 -enddate -noout -in "$CERT" | cut -d= -f2)"
  end_epoch="$(date -d "$end_raw" +%s)"
  now_epoch="$(date +%s)"
  days="$(( (end_epoch - now_epoch) / 86400 ))"
  alerts+=("证书到期还剩 ${days} 天（${end_raw}）。")
  if [ "$days" -lt 21 ]; then
    alerts+=("不足 21 天。不要等到过期。")
  fi
fi

auth="missing"
if [ -f "$RENEWAL" ]; then
  auth="$(awk -F= '/^authenticator/{gsub(/ /,"",$2); print $2; exit}' "$RENEWAL")"
fi
mode="missing"
if [ -f "$MODE_FILE" ]; then
  mode="$(tr -d '[:space:]' < "$MODE_FILE")"
fi
if [ "$auth" != "webroot" ] || [ "$mode" != "http-01" ]; then
  alerts+=("续签方式仍是 ${auth} / 记录 ${mode}。手工 DNS-01 不会被 certbot renew 自动完成。DNS 切到本机并确认 80 端口可达之后，才能跑阶段 70。")
fi

{
  echo "time $(date -Is)"
  echo "authenticator $auth"
  echo "mode $mode"
  for line in "${alerts[@]}"; do
    echo "notice $line"
  done
} > "$STATUS_FILE"

logger -t imperfectnotes-cert -- "$(tr '\n' ' ' < "$STATUS_FILE")" || true
cat "$STATUS_FILE"

if [ "$auth" != "webroot" ] || [ "$mode" != "http-01" ]; then
  exit 1
fi
if [ -f "$CERT" ]; then
  if [ "${days:-0}" -lt 21 ]; then
    exit 1
  fi
fi
exit 0
