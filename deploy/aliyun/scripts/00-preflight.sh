#!/bin/bash
# Read-only look at the ECS. Prints facts. Does not change DNS, nginx,
# firewall, processes, or files outside a SYSROOT dry run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

warn=0
note "=== Imperfect Notes 迁站预检（只读）==="
note "固定提交 $PINNED_COMMIT"
if [ -n "$SYSROOT" ]; then
  note "警告：IMPERFECTNOTES_SYSROOT=$SYSROOT，这是演练，不是 ECS。"
fi

if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  note "系统 ${PRETTY_NAME:-unknown}"
else
  note "警告：读不到 /etc/os-release"
  warn=1
fi

df -h / /var /opt 2>/dev/null || df -h /
avail_kb="$(df -Pk / | awk 'NR==2 {print $4}')"
if [ "${avail_kb:-0}" -lt 2000000 ]; then
  die "根分区可用空间不足 2GB。"
fi

note "--- 监听端口（不结束任何进程）---"
ss -ltnp || true

for port in 22 8765 8766 8767 8768 80 443 "$LOCAL_PORT"; do
  if ss -ltnH "sport = :$port" | grep -q .; then
    note "端口 $port 正在监听。"
  else
    note "端口 $port 未监听。"
  fi
done

if [ -z "$SYSROOT" ]; then
  note "系统 nginx enabled=$(systemctl is-enabled nginx 2>/dev/null || true) active=$(systemctl is-active nginx 2>/dev/null || true)"
  if [ "$(systemctl is-active nginx 2>/dev/null || true)" = "active" ]; then
    note "警告：系统 nginx 正在运行。后续脚本会拒绝公网切换，且不会 unmask 或停止它。"
    warn=1
  fi
fi

if [ -d /opt/imperfect-notes-staging ]; then
  note "/opt/imperfect-notes-staging 存在。本方案不读取、不写入、不重启其中的进程。"
else
  note "警告：没有 /opt/imperfect-notes-staging。不创建它。"
fi

if [ -d /etc/letsencrypt/live ]; then
  note "/etc/letsencrypt/live 已存在。阶段 40 若证书仍有效，不会重复签发。"
  find /etc/letsencrypt/live -maxdepth 2 -type d -print 2>/dev/null || true
else
  note "/etc/letsencrypt/live 不存在。这和当前观察一致。证书要到阶段 40 才申请。"
fi

note "--- IPv4 地址 ---"
ip -4 addr || true
note "公网地址按现有记录是 $PUBLIC_IP。阿里云往往用 NAT，网卡上不一定出现这个地址。预检不因此失败。"

if command -v ufw >/dev/null 2>&1; then
  note "--- ufw 状态（只读，不改规则）---"
  ufw status || true
else
  note "未安装 ufw。脚本不会安装，也不会改 iptables/nft/安全组。"
fi

if command -v dig >/dev/null 2>&1; then
  note "--- 当前 DNS（只查询）---"
  note "A $(dig +short "$APEX_HOST" A | tr '\n' ' ')"
  note "www CNAME $(dig +short "$WWW_HOST" CNAME | tr '\n' ' ')"
  note "MX $(dig +short "$APEX_HOST" MX | tr '\n' ' ')"
  note "TXT $(dig +short "$APEX_HOST" TXT | tr '\n' ' ')"
else
  note "没有 dig。需要时再安装 dnsutils。现在不安装。"
fi

note "邮件相关记录（MX、SPF、DKIM、DMARC）不在任何脚本的修改范围内。"
note "本预检没有连接 Workbench 以外的管理接口，没有改 DNS，没有申请证书。"
if [ "$warn" -ne 0 ]; then
  note "预检结束：有警告，见上方。退出码 0，因为这些警告是切流前的预期状态或需要人工看的事实。"
fi
exit 0
