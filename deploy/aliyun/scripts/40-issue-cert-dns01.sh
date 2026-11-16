#!/bin/bash
# Interactive DNS-01 issuance while DNS still points at GitHub Pages.
# Does not ask for an API token, does not change A/CNAME/MX, and does not
# enable public listeners. A manual certificate does not auto-renew.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_root
require_env IMPERFECTNOTES_ISSUE_CERT yes
[ -z "$SYSROOT" ] || die "申请证书不能在 IMPERFECTNOTES_SYSROOT 演练里执行。"

if [ ! -t 0 ]; then
  die "这一步必须在 Workbench 的交互终端里跑。不要用无终端方式，也不要把令牌写进命令。"
fi
if ! command -v certbot >/dev/null 2>&1; then
  if [ "${IMPERFECTNOTES_INSTALL_CERTBOT:-}" = "yes" ]; then
    apt-get update
    apt-get install -y certbot
  else
    die "没有 certbot。确认后可先执行：apt-get install -y certbot（不要安装 python3-certbot-nginx）。"
  fi
fi
if dpkg -s python3-certbot-nginx >/dev/null 2>&1; then
  note "警告：已安装 python3-certbot-nginx。本脚本不会使用 --nginx，也不会改 /etc/nginx。"
fi

email="${CERTBOT_EMAIL:-}"
if [ -z "$email" ]; then
  die "请设置 CERTBOT_EMAIL，例如 hello@imperfectnotes.com。脚本不代发邮件。"
fi

live="/etc/letsencrypt/live/imperfectnotes.com/cert.pem"
if [ -f "$live" ]; then
  end_raw="$(openssl x509 -enddate -noout -in "$live" | cut -d= -f2)"
  end_epoch="$(date -d "$end_raw" +%s)"
  days="$(( (end_epoch - $(date +%s)) / 86400 ))"
  if [ "$days" -gt 30 ]; then
    note "已有证书，还剩 ${days} 天，到期 ${end_raw}。为避免 Let's Encrypt 次数限制，不重复签发。"
    note "若 authenticator 仍是 manual，它不会自动续签。请看阶段 70 和 cert-watch。"
    exit 0
  fi
fi

cat <<EOF
即将申请 Let's Encrypt 证书：${APEX_HOST} 和 ${WWW_HOST}。
验证方式是 DNS-01 手工 TXT。DNS 现在可以继续指向 GitHub Pages。

只允许在 Cloudflare 新增这两条 TXT，灰色云朵即可（TXT 本来也不会被代理）：
  _acme-challenge.${APEX_HOST}
  _acme-challenge.${WWW_HOST}
值由 certbot 接下来显示。两条都要加。等 dig 能查到后再回车。

不要改这些已有记录：
  A    ${APEX_HOST}    ${GITHUB_PAGES_A[*]}
  CNAME ${WWW_HOST}   ${GITHUB_WWW_CNAME}
  MX   route1/route2/route3.mx.cloudflare.net
  TXT  v=spf1 include:_spf.mx.cloudflare.net ~all
  TXT  cf2024-1._domainkey
  TXT  _dmarc.${APEX_HOST}
不要填写 API Token 或 AccessKey。不要复用 GitHub 的私钥；GitHub Pages 的证书私钥不在这台机器上，也不该被复制。

签发成功后删掉刚加的 _acme-challenge TXT。
这张证书约 90 天到期，certbot renew 不能无人值守地完成 manual DNS-01。
在阶段 70 的 HTTP-01 演练成功之前，不要认为续签已经解决。
EOF

read -r -p "已经阅读以上限制。输入 issue 继续：" answer
[ "$answer" = "issue" ] || die "未确认，没有申请证书。"

certbot certonly \
  --manual \
  --preferred-challenges dns \
  --agree-tos \
  --email "$email" \
  --cert-name imperfectnotes.com \
  --key-type rsa \
  --rsa-key-size 2048 \
  -d "$APEX_HOST" \
  -d "$WWW_HOST"

note "证书目录：/etc/letsencrypt/live/imperfectnotes.com/"
note "请现在删除 Cloudflare 上的 _acme-challenge TXT。不要改 A、CNAME、MX。"
openssl x509 -in /etc/letsencrypt/live/imperfectnotes.com/cert.pem -noout -subject -issuer -dates
note "这一步没有打开 80/443，也没有重载网站。"
IMPERFECTNOTES_INSTALL_CERT_WATCH=yes "$SCRIPT_DIR/80-install-cert-watch.sh"
