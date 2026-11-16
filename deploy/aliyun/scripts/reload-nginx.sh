#!/bin/bash
# Certbot deploy hook. Reloads only the independent site unit.
set -euo pipefail

if [ "${RENEWED_LINEAGE:-}" != "/etc/letsencrypt/live/imperfectnotes.com" ]; then
  echo "跳过：不是 imperfectnotes.com 的证书。"
  exit 0
fi
/usr/sbin/nginx -t -c /etc/imperfectnotes/nginx.conf
if systemctl is-active --quiet imperfectnotes-static; then
  systemctl reload imperfectnotes-static
fi
