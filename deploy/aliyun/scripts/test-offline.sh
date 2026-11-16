#!/bin/bash
# Offline checks for the pinned release and nginx configs.
# Starts temporary nginx on 127.0.0.1:8870 and 8871/8872 only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

OUT="$(mktemp -d)"
SYS="$(mktemp -d)"
NGX="$(mktemp -d)"
cleanup() {
  if [ -f "$NGX/local.pid" ]; then
    sudo nginx -s stop -c "$NGX/local.conf" >/dev/null 2>&1 || true
  fi
  if [ -f "$NGX/public.pid" ]; then
    sudo nginx -s stop -c "$NGX/public.conf" >/dev/null 2>&1 || true
  fi
  rm -rf "$OUT" "$SYS" "$NGX"
}
trap cleanup EXIT

note "=== 构建发布包两次，确认哈希稳定 ==="
"$SCRIPT_DIR/build-release.sh" "$OUT/a"
"$SCRIPT_DIR/build-release.sh" "$OUT/b"
cmp "$OUT/a/imperfectnotes-site-${PINNED_SHORT}.tar.gz" "$OUT/b/imperfectnotes-site-${PINNED_SHORT}.tar.gz"
note "压缩包可重复构建。"

mkdir -p "$OUT/tree"
tar -xzf "$OUT/a/imperfectnotes-site-${PINNED_SHORT}.tar.gz" -C "$OUT/tree"
python3 "$SCRIPT_DIR/check-release-tree.py" "$OUT/tree"

note "=== shellcheck 与危险命令扫描 ==="
(
  cd "$SCRIPT_DIR"
  # SC1091/SC2015 stay visible as style notes; warnings and errors still fail.
  shellcheck -x -S warning ./*.sh
)
python3 - "$SCRIPT_DIR" <<'PY'
import pathlib, re, sys
root = pathlib.Path(sys.argv[1])
patterns = [
    r"(?:^|[;&|])\s*systemctl\s+unmask\b",
    r"(?:^|[;&|])\s*systemctl\s+(?:start|enable|restart)\s+nginx\b",
    r"(?:^|[;&|])\s*iptables\b",
    r"(?:^|[;&|])\s*ufw\s+(?:allow|delete|enable|disable|insert)\b",
    r"(?:^|[;&|])\s*nft\b",
    r"(?:^|[;&|])\s*ssh\b",
    r"(?:^|[;&|])\s*scp\b",
]
bad = []
for path in root.glob("*.sh"):
    for lineno, raw in enumerate(path.read_text().splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        code = re.sub(r"'[^']*'|\"[^\"]*\"", "", line)
        for pattern in patterns:
            if re.search(pattern, code):
                bad.append(f"{path.name}:{lineno}: {line}")
if bad:
    print("\n".join(bad))
    sys.exit(1)
print("forbidden_command_scan_ok")
PY

note "=== 演练安装：幂等、拒绝覆盖、拒绝路径穿越 ==="
export IMPERFECTNOTES_SYSROOT="$SYS"
export IMPERFECTNOTES_INSTALL_RELEASE=yes
note "阶段10 绝对路径安装"
"$SCRIPT_DIR/10-install-release.sh" \
  "$OUT/a/imperfectnotes-site-${PINNED_SHORT}.tar.gz" \
  "$OUT/a/imperfectnotes-site-${PINNED_SHORT}.tar.gz.sha256" \
  "$OUT/a/manifest.sha256" \
  "$OUT/a/release-commit.txt" | tee "$OUT/abs-install.log"
grep -q '已安装' "$OUT/abs-install.log"
abs_index="$SYS/var/www/imperfectnotes/releases/${PINNED_SHORT}/index.html"
[ -f "$abs_index" ]
expected_index="$(awk '$2=="index.html" {print $1}' "$OUT/a/manifest.sha256")"
actual_index="$(sha256sum "$abs_index" | awk '{print $1}')"
[ "$expected_index" = "$actual_index" ] || die "绝对路径安装后的首页与清单不一致。"
"$SCRIPT_DIR/10-install-release.sh" \
  "$OUT/a/imperfectnotes-site-${PINNED_SHORT}.tar.gz" \
  "$OUT/a/imperfectnotes-site-${PINNED_SHORT}.tar.gz.sha256" \
  "$OUT/a/manifest.sha256" \
  "$OUT/a/release-commit.txt"
echo extra >> "$SYS/var/www/imperfectnotes/releases/${PINNED_SHORT}/index.html"
set +e
"$SCRIPT_DIR/10-install-release.sh" \
  "$OUT/a/imperfectnotes-site-${PINNED_SHORT}.tar.gz" \
  "$OUT/a/imperfectnotes-site-${PINNED_SHORT}.tar.gz.sha256" \
  "$OUT/a/manifest.sha256" \
  "$OUT/a/release-commit.txt"
overwrite_status=$?
set -e
[ "$overwrite_status" -ne 0 ] || die "覆盖不同内容时没有拒绝。"
note "覆盖冲突被拒绝。"

note "阶段10 相对路径安装（与运行文档相同的 ../../site）"
rel_bundle="$OUT/rel-bundle"
mkdir -p "$rel_bundle/deploy/scripts" "$rel_bundle/site"
cp "$OUT/a/imperfectnotes-site-${PINNED_SHORT}.tar.gz" \
  "$OUT/a/imperfectnotes-site-${PINNED_SHORT}.tar.gz.sha256" \
  "$OUT/a/manifest.sha256" \
  "$OUT/a/release-commit.txt" \
  "$rel_bundle/site/"
(
  cd "$rel_bundle/deploy/scripts"
  IMPERFECTNOTES_SYSROOT="$OUT/relsys" \
    "$SCRIPT_DIR/10-install-release.sh" \
    ../../site/imperfectnotes-site-${PINNED_SHORT}.tar.gz \
    ../../site/imperfectnotes-site-${PINNED_SHORT}.tar.gz.sha256 \
    ../../site/manifest.sha256 \
    ../../site/release-commit.txt
) | tee "$OUT/rel-install.log"
grep -q '已安装' "$OUT/rel-install.log"
rel_index="$OUT/relsys/var/www/imperfectnotes/releases/${PINNED_SHORT}/index.html"
[ -f "$rel_index" ]
rel_actual="$(sha256sum "$rel_index" | awk '{print $1}')"
[ "$expected_index" = "$rel_actual" ] || die "相对路径安装后的首页与清单不一致。"
(
  cd "$rel_bundle/deploy/scripts"
  IMPERFECTNOTES_SYSROOT="$OUT/relsys" \
    "$SCRIPT_DIR/10-install-release.sh" \
    ../../site/imperfectnotes-site-${PINNED_SHORT}.tar.gz \
    ../../site/imperfectnotes-site-${PINNED_SHORT}.tar.gz.sha256 \
    ../../site/manifest.sha256 \
    ../../site/release-commit.txt
) | tee "$OUT/rel-install-again.log"
grep -q '内容一致，不覆盖' "$OUT/rel-install-again.log"
set +e
(
  cd "$rel_bundle/deploy/scripts"
  IMPERFECTNOTES_SYSROOT="$OUT/relsys-missing" \
    "$SCRIPT_DIR/10-install-release.sh" \
    ../../site/imperfectnotes-site-${PINNED_SHORT}.tar.gz \
    ../../site/imperfectnotes-site-${PINNED_SHORT}.tar.gz.sha256 \
    ../../site/missing-manifest.sha256 \
    ../../site/release-commit.txt
)
missing_status=$?
set -e
[ "$missing_status" -ne 0 ] || die "不存在的相对清单没有被拒绝。"
[ ! -d "$OUT/relsys-missing/var/www/imperfectnotes/releases" ] || die "失败的相对路径安装写出了 release。"
note "相对路径安装通过，缺失清单在写入前被拒绝。"

bad_tar="$OUT/bad.tar.gz"
mkdir -p "$OUT/bad/nested"
echo x > "$OUT/bad/nested/file"
tar -C "$OUT/bad" -czf "$bad_tar" ../bad/nested/file
printf '%s\n' "$PINNED_COMMIT" > "$OUT/bad-commit.txt"
echo "deadbeef  bad.tar.gz" > "$OUT/bad.sha256"
# The sha check happens before member check. Give it a matching sha so the
# member check is what rejects the archive.
sha256sum "$bad_tar" | awk '{print $1"  bad.tar.gz"}' > "$OUT/bad.sha256"
set +e
"$SCRIPT_DIR/10-install-release.sh" "$bad_tar" "$OUT/bad.sha256" "$OUT/a/manifest.sha256" "$OUT/bad-commit.txt"
bad_status=$?
set -e
[ "$bad_status" -ne 0 ] || die "危险压缩包没有被拒绝。"
note "危险压缩包被拒绝。"

export IMPERFECTNOTES_ENABLE_LOCALHOST=yes
"$SCRIPT_DIR/20-enable-localhost.sh"
[ -f "$SYS/etc/imperfectnotes/nginx.conf" ]
grep -q '127.0.0.1:8870' "$SYS/etc/imperfectnotes/nginx.conf"
if grep -E 'listen[[:space:]]+80([^0-9]|$)|listen[[:space:]]+443([^0-9]|$)' "$SYS/etc/imperfectnotes/nginx.conf"; then
  die "演练后的活动配置监听了公网端口。"
fi
export IMPERFECTNOTES_ROLLBACK=localhost
"$SCRIPT_DIR/90-rollback.sh"
unset IMPERFECTNOTES_SYSROOT IMPERFECTNOTES_INSTALL_RELEASE IMPERFECTNOTES_ENABLE_LOCALHOST IMPERFECTNOTES_ROLLBACK

note "=== 用真实 nginx 验收 localhost 配置 ==="
python3 - "$REPO" "$OUT/tree" "$NGX" <<'PY'
import pathlib, sys
repo, tree, ngx = map(pathlib.Path, sys.argv[1:])
src = repo / "deploy/aliyun/nginx"
etc = ngx / "etc"
etc.mkdir()
for name in ("http-base.conf", "site.conf", "404.html", "nginx-localhost.conf", "nginx-public.conf"):
    text = (src / name).read_text()
    text = text.replace("/etc/imperfectnotes", str(etc))
    text = text.replace("/var/www/imperfectnotes/current", str(tree))
    text = text.replace("/var/log/imperfectnotes", str(ngx / "log"))
    text = text.replace("/var/lib/imperfectnotes-nginx", str(ngx / "lib"))
    text = text.replace("/run/imperfectnotes-nginx.pid", str(ngx / "local.pid"))
    (etc / name).write_text(text)
(ngx / "log").mkdir()
(ngx / "lib").mkdir()
for sub in ("client_body", "proxy", "fastcgi", "uwsgi", "scgi"):
    (ngx / "lib" / sub).mkdir()
conf = (etc / "nginx-localhost.conf").read_text()
(ngx / "local.conf").write_text(conf)
public = (etc / "nginx-public.conf").read_text()
public = public.replace("listen 443 ssl http2 default_server;", "listen 127.0.0.1:8872 ssl http2 default_server;")
public = public.replace("listen 443 ssl http2;", "listen 127.0.0.1:8872 ssl http2;")
public = public.replace("listen 80 default_server;", "listen 127.0.0.1:8871 default_server;")
public = public.replace("listen 80;", "listen 127.0.0.1:8871;")
public = public.replace("/run/imperfectnotes-nginx.pid", str(ngx / "public.pid"))
# The shared replacements above already rewrote the pid to local.pid via the
# file copy. Put the public pid back after that, then rewrite cert paths.
public = public.replace(str(ngx / "local.pid"), str(ngx / "public.pid"))
(ngx / "public.conf").write_text(public)
PY

chmod 755 "$OUT" "$OUT/tree" "$NGX"
chmod -R a+rX "$OUT/tree" "$NGX/etc" "$NGX/lib" "$NGX/log"
sudo nginx -t -c "$NGX/local.conf"
sudo nginx -c "$NGX/local.conf"
"$SCRIPT_DIR/30-accept-localhost.sh"

note "=== 公网配置在高位端口上的跳转、证书和 HTTP-01 目录 ==="
sudo openssl req -x509 -newkey rsa:2048 -keyout "$NGX/key.pem" -out "$NGX/cert.pem" -days 2 -nodes \
  -subj "/CN=imperfectnotes.com" \
  -addext "subjectAltName=DNS:imperfectnotes.com,DNS:www.imperfectnotes.com" >/dev/null 2>&1
sudo chmod a+r "$NGX/key.pem" "$NGX/cert.pem"
python3 - "$NGX" <<'PY'
import pathlib, sys
ngx = pathlib.Path(sys.argv[1])
text = (ngx / "public.conf").read_text()
text = text.replace("/etc/letsencrypt/live/imperfectnotes.com/fullchain.pem", str(ngx / "cert.pem"))
text = text.replace("/etc/letsencrypt/live/imperfectnotes.com/privkey.pem", str(ngx / "key.pem"))
text = text.replace("/var/www/imperfectnotes/acme", str(ngx / "acme"))
(ngx / "public.conf").write_text(text)
PY
mkdir -p "$NGX/acme/.well-known/acme-challenge"
echo ping-token > "$NGX/acme/.well-known/acme-challenge/ping-token"
sudo nginx -t -c "$NGX/public.conf"
sudo nginx -c "$NGX/public.conf"

public_code() {
  curl -skS -o /tmp/in-public-body -D /tmp/in-public-headers --max-time 20 \
    --resolve "imperfectnotes.com:8871:127.0.0.1" \
    --resolve "www.imperfectnotes.com:8871:127.0.0.1" \
    --resolve "imperfectnotes.com:8872:127.0.0.1" \
    --resolve "www.imperfectnotes.com:8872:127.0.0.1" \
    -w '%{http_code}' "$@" || true
  tr -d '\r' < /tmp/in-public-headers > /tmp/in-public-headers.lf
  mv /tmp/in-public-headers.lf /tmp/in-public-headers
}
fail=0
expect() {
  local name="$1" want="$2" got="$3"
  if [ "$got" = "$want" ]; then note "通过 $name -> $got"; else note "失败 $name 期望 $want 实际 $got"; fail=1; fi
}
expect "http apex" 301 "$(public_code "http://imperfectnotes.com:8871/")"
grep -qi '^Location: https://imperfectnotes.com/$' /tmp/in-public-headers || { note "失败 http apex Location"; fail=1; }
expect "http www 保留路径" 301 "$(public_code "http://www.imperfectnotes.com:8871/shop")"
grep -qi '^Location: https://imperfectnotes.com/shop$' /tmp/in-public-headers || { note "失败 http www Location"; fail=1; }
expect "acme" 200 "$(public_code "http://imperfectnotes.com:8871/.well-known/acme-challenge/ping-token")"
grep -q 'ping-token' /tmp/in-public-body || { note "失败 acme 内容"; fail=1; }
expect "https www" 301 "$(public_code "https://www.imperfectnotes.com:8872/shop")"
grep -qi '^Location: https://imperfectnotes.com/shop$' /tmp/in-public-headers || { note "失败 https www Location"; fail=1; }
expect "https apex" 200 "$(public_code "https://imperfectnotes.com:8872/")"
expect "https self" 200 "$(public_code "https://imperfectnotes.com:8872/self/")"
expect "https ziwei" 200 "$(public_code "https://imperfectnotes.com:8872/ziwei/")"
expect "https assets dir" 404 "$(public_code "https://imperfectnotes.com:8872/assets/")"
expect "https range" 206 "$(public_code -H 'Range: bytes=0-15' "https://imperfectnotes.com:8872/assets/covers/about.jpg")"
[ "$fail" -eq 0 ] || die "公网配置演练没有通过。"

note "=== 和现站字节、状态比对 ==="
python3 - "$OUT/a/manifest.sha256" <<'PY'
import hashlib, pathlib, sys, urllib.request
manifest = {}
for line in pathlib.Path(sys.argv[1]).read_text().splitlines():
    digest, name = line.split(None, 1)
    manifest[name] = digest
paths = [
    "index.html",
    "style.css",
    "script.js",
    "data/episodes.json",
    "shop/index.html",
    "privacy/index.html",
    "self/index.html",
    "self/self.css",
    "self/engine/engine.mjs",
    "ziwei/index.html",
    "robots.txt",
    "sitemap.xml",
    "assets/logo/favicon.svg",
]
base = "https://imperfectnotes.com/"
for name in paths:
    url = base if name == "index.html" else base + name
    with urllib.request.urlopen(url, timeout=40) as response:
        body = response.read()
        status = response.status
        ctype = response.headers.get("content-type", "")
    digest = hashlib.sha256(body).hexdigest()
    if status != 200 or digest != manifest[name]:
        raise SystemExit(f"live mismatch {name} status={status} digest={digest} expected={manifest[name]}")
    print(f"live_match {name} {ctype}")
PY

"$SCRIPT_DIR/60-cutover-check.sh" before "$OUT/a/manifest.sha256"
note "离线验收完成。没有连接 ECS，没有改 DNS，没有签发正式证书。"
