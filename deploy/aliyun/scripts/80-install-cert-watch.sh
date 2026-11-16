#!/bin/bash
# Install the daily warning timer. It does not renew anything.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_root
require_env IMPERFECTNOTES_INSTALL_CERT_WATCH yes
managed_etc_ok

UNIT_SRC="$(cd "$SCRIPT_DIR/../systemd" && pwd)"
mkdir -p "$ETC_DIR" "$LIB_DIR" "$UNIT_DIR"
cp "$SCRIPT_DIR/cert-watch.sh" "$ETC_DIR/cert-watch.sh"
chmod 755 "$ETC_DIR/cert-watch.sh"
cp "$UNIT_SRC/imperfectnotes-cert-watch.service" "$UNIT_DIR/imperfectnotes-cert-watch.service"
install_unit "$UNIT_SRC/imperfectnotes-cert-watch.timer"
if [ -z "$SYSROOT" ]; then
  systemctl enable --now imperfectnotes-cert-watch.timer
  bash "$ETC_DIR/cert-watch.sh" || note "证书监视已安装。当前状态是警告，这在阶段 70 之前是预期的。"
else
  note "SYSROOT 演练：未启用 timer。"
fi
