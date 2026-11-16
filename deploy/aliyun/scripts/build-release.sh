#!/bin/bash
# Build the public site tarball from the pinned commit only.
# This does not archive later deploy commits, CNAME, or dotfiles.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

REPO="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT="${1:-$REPO/deploy/aliyun/dist/site}"
mkdir -p "$OUT"

if ! git -C "$REPO" cat-file -e "${PINNED_COMMIT}^{commit}"; then
  die "仓库里没有固定提交 $PINNED_COMMIT"
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git -C "$REPO" archive --format=tar "$PINNED_COMMIT" | tar -C "$work" -xf -
rm -f "$work/.gitignore" "$work/CNAME"
if [ -e "$work/.gitignore" ] || [ -e "$work/CNAME" ]; then
  die "未能去掉 GitHub Pages 不发布的文件。"
fi
assert_no_symlinks "$work"

manifest="$OUT/manifest.sha256"
(
  cd "$work"
  find . -type f -printf '%P\n' | LC_ALL=C sort | while IFS= read -r file; do
    sha256sum "$file"
  done
) > "$manifest"

file_count="$(wc -l < "$manifest" | tr -d ' ')"
commit_time="$(git -C "$REPO" show -s --format=%ct "$PINNED_COMMIT")"
tarball="$OUT/imperfectnotes-site-${PINNED_SHORT}.tar.gz"
tar --sort=name --mtime="@${commit_time}" --owner=0 --group=0 --numeric-owner \
  -C "$work" -cf - . | gzip -n > "$tarball"
sha256="$(sha256sum "$tarball" | awk '{print $1}')"
bytes="$(wc -c < "$tarball" | tr -d ' ')"
printf '%s\n' "$PINNED_COMMIT" > "$OUT/release-commit.txt"
printf '%s  %s\n' "$sha256" "$(basename "$tarball")" > "$OUT/$(basename "$tarball").sha256"

cat > "$OUT/PINNED_RELEASE.txt" <<EOF
commit $PINNED_COMMIT
short $PINNED_SHORT
commit_time $(git -C "$REPO" show -s --format='%ci' "$PINNED_COMMIT")
subject $(git -C "$REPO" show -s --format='%s' "$PINNED_COMMIT")
files $file_count
excluded .gitignore CNAME
reason_excluded GitHub Pages returned 404 for both on 2026-11-16
tarball $(basename "$tarball")
sha256 $sha256
bytes $bytes
EOF

cp "$OUT/PINNED_RELEASE.txt" "$REPO/deploy/aliyun/PINNED_RELEASE.txt"
note "release $tarball"
note "sha256 $sha256"
note "files $file_count"
