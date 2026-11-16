# imperfectnotes.com 静态站迁到阿里云北京 ECS

这份材料只准备和验证部署包。迁站没有完成。

没有登录 ECS，没有改 DNS，没有合并 PR，没有提交备案，没有购买服务，没有签发正式证书。现站仍由 GitHub Pages 提供。截止观察时间是 2026-11-16 10:30 UTC。

固定内容是 `main` 上的 `082fd05c17711c8bdbdafbbf1218306e1d1a17e5`（2026-10-31 08:32:11 +0800，Speed up home LCP）。发布包不包含这次加入的 `deploy/` 目录，所以网站字节和这次文档提交无关。

## 取舍

用已安装的 nginx 二进制跑一个独立单元 `imperfectnotes-static.service`，配置只读 `/etc/imperfectnotes/nginx.conf`，不 include `/etc/nginx/sites-enabled`。系统里的 `nginx.service` 保持 masked，不 unmask，不 start。

先只听 `127.0.0.1:8870`。确认后再切到公网 80/443。不占用 22、3389、8765、8766、8767、8768，不碰 `/opt/imperfect-notes-staging` 和 `/var/www/html`。

证书在 DNS 仍指向 GitHub 时用手工 DNS-01 申请。不向任何人要 AccessKey 或 Cloudflare 令牌，也不复制 GitHub 的私钥。GitHub Pages 的证书私钥不在这台 ECS 上。手工 DNS-01 不会自动续签。DNS 切到本机并且 80 端口从公网可达之后，阶段 70 把续签改成 HTTP-01。`certbot renew --dry-run` 成功之前，不要认为过期风险已经消失。

没有为了迁移重写页面，也没有把 `/self` 或 `/ziwei` 配成 404。2026-11-16 实测现站：

| 路径 | 状态 | 含义 |
| --- | --- | --- |
| `/`、`/index.html` | 200 | 同一份首页，`/index.html` 不跳走 |
| `/shop` | 301 | 到 `/shop/`，查询串保留 |
| `/self/`、`/ziwei/` | 200 | `/self/` 的页面自己执行 `location.replace("/")`；`/ziwei/` 是排盘页 |
| `/self/self.css` | 200 | `/privacy/` 在用它 |
| `/assets/`、`/self/data/` | 404 | 没有目录列表 |
| `/does-not-exist`、`/SHOP/` | 404 | 不回落到首页；路径区分大小写 |
| `http://` 和 `https://www` | 301 | 最终主机是 `https://imperfectnotes.com`，路径先原样保留 |

www 的 301 目标是根域。邮件仍走 Cloudflare Email Routing，任何阶段都不改 MX、SPF、`cf2024-1._domainkey`、`_dmarc`。

## 发布包

125 个文件。去掉了 `.gitignore` 和 `CNAME`，因为现站对这两个地址返回 404。没有符号链接。

```
imperfectnotes-site-082fd05c1771.tar.gz
sha256 755911dd59013966f96b2d00c4fb7f594837a79ea68bb12bf853cf9a9975c470
bytes  10892334
```

同一命令打两次，压缩包字节一致。清单在旁边的 `manifest.sha256`。`/self/index.html`、`/ziwei/index.html`、`/style.css`、`/script.js`、`/data/episodes.json` 等 13 个现站 URL 的正文 sha256 与清单一致。

## 在这台准备机上已经验证的

`deploy/aliyun/scripts/test-offline.sh` 退出码 0。它做了这些事：

- 固定提交打出可重复的压缩包，并检查 222 个站内引用都落在树上。
- shellcheck。脚本里没有 `systemctl unmask`、没有启动系统 nginx、没有 iptables/ufw/nft/ssh。
- 在临时根里安装发布包：第二次安装发现内容相同则跳过；改过一个字节则拒绝覆盖；成员名不是 `./` 相对路径则拒绝。
- 用本机 nginx 1.24.0 加载 localhost 配置。`30-accept-localhost.sh` 通过：首页 200 且含备案号，`/self/` 与 `/ziwei/` 为 200，无索引目录为 404，www 301 到 `https://imperfectnotes.com/shop`，图片 `Range: bytes=0-15` 为 206。
- 用临时自签证书把公网配置改挂到 `127.0.0.1:8871` 和 `8872` 做演练。HTTP 跳到 https 根域，`/.well-known/acme-challenge/` 不跟着跳走，https 的 www 301 保留路径。这张自签证书只活在临时目录，不进发布包。
- `60-cutover-check.sh before` 对现站通过：四个 GitHub Pages A 记录还在，www 仍是 `guozong0205.github.io`，MX 仍是 Cloudflare 三条，SPF 未变。

没有验证的：

- systemd 真正拉起服务。这台准备机没有 systemd。单元文件只被复制进临时根。
- 在 ECS 上执行任何脚本。Workbench 会话不在这里，也没有尝试 SSH。
- 向 Let's Encrypt 真实下单。只核对了 Ubuntu 24.04 仓库里 certbot 2.9.0 的 `reconfigure --authenticator webroot --webroot-path` 参数。
- 阿里云安全组、备案接入控制台、防火墙的当前规则。下面公网步骤仍要你在控制台看过再做。

## 服务器上的顺序

把整个 `deploy/aliyun` 和 `site/` 解到 ECS 的 `/root/imperfectnotes-migrate/`。下面命令都在这个目录的 `deploy/scripts` 里执行。除了写明的环境变量，不要导出 `IMPERFECTNOTES_SYSROOT`。

阶段 00，只读：

```bash
bash 00-preflight.sh
```

预期里就包括：系统 nginx 是 masked/inactive，80/443 没人听，`/etc/letsencrypt/live` 不存在，8765–8768 上的旧进程还在。脚本不会结束它们。

阶段 10，安装这个提交。目标目录已存在且内容不同时会停，不会覆盖。在 `deploy/scripts` 下，下面的相对路径和绝对路径都可以。脚本会先把四个参数收成绝对路径，再进入临时目录校验清单。

```bash
IMPERFECTNOTES_INSTALL_RELEASE=yes bash 10-install-release.sh \
  ../../site/imperfectnotes-site-082fd05c1771.tar.gz \
  ../../site/imperfectnotes-site-082fd05c1771.tar.gz.sha256 \
  ../../site/manifest.sha256 \
  ../../site/release-commit.txt
```

文件落在 `/var/www/imperfectnotes/releases/082fd05c1771/`，`current` 指向它。

阶段 20，只听本机 8870。`nginx -t` 失败会撤回刚写入的 `/etc/imperfectnotes` 并且不启动。

```bash
IMPERFECTNOTES_ENABLE_LOCALHOST=yes bash 20-enable-localhost.sh
bash 30-accept-localhost.sh
```

阶段 40，交互申请证书。DNS 保持现状。

```bash
CERTBOT_EMAIL=hello@imperfectnotes.com \
IMPERFECTNOTES_ISSUE_CERT=yes \
  bash 40-issue-cert-dns01.sh
```

终端里要先输入 `issue`。certbot 随后给出 TXT。只在 Cloudflare 新增：

```
_acme-challenge.imperfectnotes.com
_acme-challenge.www.imperfectnotes.com
```

用 `dig +short TXT` 能看到值之后，再回 certbot 的提示。签发后删掉这两条 TXT。不要改下面这些：

```
A     imperfectnotes.com     185.199.108.153
A     imperfectnotes.com     185.199.109.153
A     imperfectnotes.com     185.199.110.153
A     imperfectnotes.com     185.199.111.153
CNAME www.imperfectnotes.com guozong0205.github.io.
MX    46 route1.mx.cloudflare.net.
MX    69 route2.mx.cloudflare.net.
MX    54 route3.mx.cloudflare.net.
TXT   v=spf1 include:_spf.mx.cloudflare.net ~all
TXT   cf2024-1._domainkey
TXT   _dmarc  v=DMARC1; p=none; rua=mailto:hello@imperfectnotes.com
```

若机器上没有 certbot，先看完再执行 `apt-get install -y certbot`。不要安装 `python3-certbot-nginx`，那个插件会改系统 nginx。也可以把 `IMPERFECTNOTES_INSTALL_CERTBOT=yes` 交给阶段 40，它只会装 `certbot`。

这张证书大约 90 天。authenticator 会记成 `manual`。`certbot renew` 无法在没人值守时完成 DNS-01。阶段 40 会装每日 `imperfectnotes-cert-watch.timer`。在阶段 70 成功前，这个 timer 以失败状态提醒你，这是预期，不是已经续签。证书还剩超过 30 天时，阶段 40 拒绝重签，避免撞上 Let's Encrypt 的重复签发限制。

阶段 50 才会听 80 和 443。必须同时给出两个变量，而且证书要覆盖两个主机名、剩余超过 14 天。80 或 443 已被别的进程占用时直接停止，不杀进程。系统 nginx 若已在运行，也停止。不改安全组、ufw、iptables。

```bash
IMPERFECTNOTES_ENABLE_PUBLIC=yes \
IMPERFECTNOTES_PUBLIC_CONFIRM=39.96.210.138 \
  bash 50-enable-public.sh
```

然后你自己在阿里云控制台的安全组入方向新增两条，别的规则不动：

```
TCP 80  来源 0.0.0.0/0
TCP 443 来源 0.0.0.0/0
```

不要开放 8870、8765–8768，不要改 22 或 3389。放行前可以用：

```bash
curl -I --resolve imperfectnotes.com:443:127.0.0.1 https://imperfectnotes.com/
```

阶段 60 在改 DNS 之前跑 `before`，改完再跑 `after`。它可以在任意能解析公网 DNS 的机器上执行。

```bash
bash 60-cutover-check.sh before ../../site/manifest.sha256
```

DNS 切换本身不在脚本里。灰色云朵保持 DNS only，不要开橙色代理。把根域的四条 A 换成一条 `39.96.210.138`。把 www 的 CNAME 从 `guozong0205.github.io` 改成 `imperfectnotes.com`，或改成同样的 A。不要留着 GitHub 的 A 或 AAAA。www 今天能通过 GitHub 的 IPv6 到达，这台 ECS 没有给出 IPv6，切走之后 www 的 IPv6 会消失；根域现在就没有 AAAA。

改 DNS 之前，请在阿里云备案控制台确认 `imperfectnotes.com` 的接入已经包含这台北京 ECS。这里没有打开过备案控制台。接入若仍指向别处，DNS 切过去可能被拦截。

切完：

```bash
bash 60-cutover-check.sh after ../../site/manifest.sha256
```

`after` 还要求证书签发者是 Let's Encrypt，并且外部 `ep17.mp3` 的范围请求仍是 206。

阶段 70 是续签的分界。A 和 www 都已经指向 `39.96.210.138`，并且安全组放行了 80 之后才跑。它先从公网读取自己写下的探测文件；失败就不动 renewal 配置。成功后把 authenticator 改成 webroot，再跑 `certbot renew --dry-run`。演练失败会把 renewal 文件拷回去。演练成功才写入 `/var/lib/imperfectnotes/renewal-mode` 为 `http-01`，并启用 `certbot.timer`。部署钩子只重载 `imperfectnotes-static`。

```bash
IMPERFECTNOTES_ENABLE_HTTP01_RENEW=yes bash 70-enable-http01-renew.sh
```

到这一步之前，日历上要留一个提醒：签发后第 60 天如果阶段 70 还没成功，就再跑一次阶段 40。不要等到第 89 天。

## 回退

只退监听，发布目录保留：

```bash
IMPERFECTNOTES_ROLLBACK=localhost bash 90-rollback.sh
```

停掉独立站点、不启动系统 nginx：

```bash
IMPERFECTNOTES_ROLLBACK=stop bash 90-rollback.sh
```

若 `current` 曾经指向别的 release，并且那个目录还在：

```bash
IMPERFECTNOTES_ROLLBACK=localhost IMPERFECTNOTES_RESTORE_PREVIOUS=yes bash 90-rollback.sh
```

DNS 要手工改回上面列出的四条 GitHub A 和 www CNAME。邮件记录不动。改完跑 `60-cutover-check.sh before`。没有打开 HSTS，浏览器不会被钉死在新地址上。

## 外部依赖

播放器和壁纸不在这台机器上。`data/episodes.json` 的 mp3 和 4K 壁纸指向 `raw.githubusercontent.com/guozong0205/imperfect-notes-assets`。资源仓不迁。nginx 不对它们做反代。现站已经是这样；放到国内机器上之后，页面能开，不代表大陆网络一定播得了这些文件。

紫微解读仍请求 `https://ziwei-interpreter.imperfectnotes.workers.dev`。页面只把排盘事实送过去。Worker 密钥不在这个仓库里，这次也不部署 Worker。`workers/ziwei-interpreter-openai.js` 只是现站已经公开的模板，发布包按原样带上，避免这个 URL 从 200 变成 404。

曲谱仍是页面说明加 mailto。仓库里没有 `assets/pay/alipay-qr.png`，现站这里是 404，发布包也是 404。不新增支付。

其他请求：Google Fonts、gtag `G-YQFBQR7C37`、紫微页的 cdnjs three.js、YouTube、抖音。字体或统计在大陆打不开时，页面主体仍由本机文件渲染。

`/privacy/` 引用 `/self/self.css`。`/self/` 的 HTML 会立刻跳回首页，这是当前 `main` 的页面内容，不是服务器 404。

## 和现站不完全相同的地方

- 缺失页面的正文是一句「没有这一页。」，状态仍是 404。现站那份 GitHub 404 皮肤没有搬过来。
- `.mjs` 的类型是 `application/javascript`。现站是 `text/javascript`。两种都能当模块加载。
- `sitemap.xml` 的类型是 `text/xml`。现站是 `application/xml`。
- 成功响应带 `Cache-Control: public, max-age=600` 和 `Access-Control-Allow-Origin: *`，与现站一致。没有加 HSTS。
- 目录斜杠跳转用相对 `Location`。www 和 http 到根域的跳转仍是绝对 URL。

## 材料位置

准备机上的可下载目录：

```
/opt/cursor/artifacts/imperfectnotes-aliyun-migration-082fd05c1771/
```

单文件压缩包和它的 sha256 在同一层 artifacts 目录。仓库里的审阅副本是 `deploy/aliyun/`，发布包哈希写在 `deploy/aliyun/PINNED_RELEASE.txt`。
