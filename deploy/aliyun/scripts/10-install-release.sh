#!/bin/bash
# Install the pinned release beside any older tree. Never overwrite a
# different tree, and never touch /opt/imperfect-notes-staging or /var/www/html.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_root
require_env IMPERFECTNOTES_INSTALL_RELEASE yes
managed_etc_ok

if [ "$#" -ne 4 ]; then
  die "用法：IMPERFECTNOTES_INSTALL_RELEASE=yes $0 TARBALL SHA256 MANIFEST COMMITFILE"
fi

tarball="$1"
shafile="$2"
manifest="$3"
commitfile="$4"
[ -f "$tarball" ] && [ -f "$shafile" ] && [ -f "$manifest" ] && [ -f "$commitfile" ] || die "发布文件不完整。"

got_commit="$(tr -d '[:space:]' < "$commitfile")"
[ "$got_commit" = "$PINNED_COMMIT" ] || die "只接受 $PINNED_COMMIT，收到 $got_commit。"

expected_sha="$(awk '{print $1}' "$shafile")"
actual_sha="$(sha256sum "$tarball" | awk '{print $1}')"
[ "$expected_sha" = "$actual_sha" ] || die "压缩包 sha256 不一致。"

assert_tar_members "$tarball"

extract="$(mktemp -d)"
trap 'rm -rf "$extract"' EXIT
tar -xzf "$tarball" -C "$extract"
assert_no_symlinks "$extract"
(
  cd "$extract"
  sha256sum -c "$manifest" >/dev/null
)
python3 "$SCRIPT_DIR/check-release-tree.py" "$extract"

dest="$WWW_DIR/releases/$PINNED_SHORT"
mkdir -p "$WWW_DIR/releases" "$WWW_DIR/acme/.well-known/acme-challenge"
if [ -e "$dest" ]; then
  if diff -rq "$dest" "$extract" >/dev/null; then
    note "发布目录已存在且内容一致，不覆盖。"
  else
    die "$dest 已存在且内容不同。脚本不会覆盖。请保留旧目录并停止。"
  fi
else
  cp -a "$extract" "$dest"
  note "已安装 $dest"
fi
cp "$manifest" "$WWW_DIR/releases/${PINNED_SHORT}.manifest.sha256"
printf '%s\n' "$PINNED_COMMIT" > "$WWW_DIR/releases/${PINNED_SHORT}.commit"
chmod -R a+rX "$dest"

current="$WWW_DIR/current"
if [ -e "$current" ] && [ ! -L "$current" ]; then
  die "$current 已存在且不是符号链接。脚本不会替换它。"
fi
if [ -L "$current" ]; then
  previous="$(readlink "$current")"
  printf '%s\n' "$previous" > "$WWW_DIR/previous-target"
  note "上一版链接是 $previous"
fi
ln -s "releases/$PINNED_SHORT" "$WWW_DIR/current.next"
mv -Tf "$WWW_DIR/current.next" "$current"
note "current -> releases/$PINNED_SHORT"
note "没有改动 /var/www/html，也没有改动 /opt/imperfect-notes-staging。"
