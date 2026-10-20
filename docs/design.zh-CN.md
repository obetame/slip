# 纸条 0.1.0

[English](design.md)

纸条是家里的一块板子。在运行它的那台电脑上放下一段文字、一张图片或一个文件，同一台路由器下的其它设备用浏览器拿走。这一版没有账号，没有后台同步，也没有菜单栏。

屏幕上的名字是「纸条」。命令是 `slip`。英文界面里它叫 Slip。

## 它不是什么

已经有的工具解决的是旁边的问题。

- PairDrop 和 LocalSend 要求两边同时醒着，并且都愿意接收。合上笔记本之后，纸条还在。
- 文件浏览器和上传页是文件夹。纸条是一叠卡片，新的在最上面，要看就复制或下载这一张。
- 云端剪贴板会把内容带出家里。纸条停在局域网里。

## 产品规则

- 全家共用一个口令。最短 6 个字符，最长 200 个，按 Unicode 码位计算，不去掉首尾空白。磁盘上只有哈希。
- 通过校验的浏览器拿到一个 HttpOnly cookie，有效 180 天。
- 纸条一直留着，直到有人删除，或者清空整叠。删除可以撤销。
- 单个文件最大 50 MB。一条文字最大 200 KB（UTF-8 字节）。数据目录里的文件字节合计最大 5 GB。
- 文字就是纯文本，不渲染 Markdown。
- 界面默认中文，可以切到英文。语言记在 `localStorage` 的 `slip.lang`。主题默认浅色，深色要自己选（`slip.theme`）。
- 没有 WebSocket。打开页面或按刷新，才会重新取这一叠。
- 传输用 HTTP。给 iOS 12 装证书很痛苦，而这一版仍然要服务那台设备。口令不要拿邮箱或银行的口令来用。

## 两个页面

新浏览器看到完整页面：一张纸、一条印泥色的边、拖放，以及粘贴图片。

iPad mini 2 最高是 iOS 12.5.7。它的 Safari 不拿完整页面。服务看用户代理里有没有 `CPU OS 12_` 或 `CPU iPhone OS 12_`，有就返回 `legacy.html`。`/?ui=legacy` 和 `/?ui=modern` 会写一年的 `slip_ui` cookie，然后跳回 `/`。cookie 优先于用户代理。

降级页走同一套接口，能做的事情也一样：设置口令、等待、登录、写字、添加文件、复制、查看、下载、删除、撤销、刷新、设置、改口令、清空、退出所有设备。它的脚本和样式停在 iOS 12 能跑的写法上：没有可选链，没有 `const` 和 `let`，没有箭头函数，没有 flex 的 `gap`，没有 `:has`，没有 `aspect-ratio`。没有剪贴板 API 时，复制走 `document.execCommand`。输入框至少 16px，避免聚焦时页面被放大。可点的东西至少 44px。那台 iPad 保存图片的办法是打开图片然后长按。

视觉上的完成度放在完整页面。降级页要完整，并且能读。

## 进程

一个 Go 二进制。标准库提供 HTTP，并把页面嵌进去。Argon2id 来自 `golang.org/x/crypto`。缩略图在进程里解码，缩放用 `golang.org/x/image/draw`。macOS 上先试 `sips`，这样 HEIC 可以有预览，又不用链上 libheif。二维码用 `rsc.io/qr`，页面上是 SVG，终端里是方块字符。没有 cgo，没有 SQLite，没有 Docker。

模块路径是 `github.com/obetame/slip`，语言版本是 Go 1.27。`GET /{$}` 需要 Go 1.22 或更新。CI 使用 Go 1.27，并设置 `GOTOOLCHAIN=local`。依赖如果需要更新的 Go，检查会失败，而不是再去下载一套工具链。

macOS arm64 上的剥离构建（`go build -ldflags="-s -w"`，用 Go 1.27.2 编译）是 7,296,994 字节，大约 7.0 MiB。这个数字会随 Go 版本、依赖和目标系统变化。以后的 Homebrew 包会只带一种架构。

在 `main` 上打 `vX.Y.Z` 标签会发布这一版。标签必须是 `v` 加上 `version.Current`。GitHub Actions 在 Ubuntu 上用 Go 1.27 构建压缩包，参数是 `CGO_ENABLED=0`、`-trimpath` 和 `-ldflags="-s -w"`，目标是 Linux、macOS 和 Windows 的 amd64 与 arm64。一起发布的还有 `SHA256SUMS`。上面的字节数是那次本机构建，不是这些压缩包。

生产参数的 Argon2id 在计算口令时会用到 64 MiB 的工作内存。那不是进程闲着时的体积。

## 数据目录

目录权限 `0700`，文件权限 `0600`。macOS 默认是 `~/Library/Application Support/slip`。`--data` 和 `SLIP_DATA` 可以改。Linux 默认是 `$XDG_DATA_HOME/slip`，否则是 `~/.local/share/slip`。

| 路径 | 作用 |
| --- | --- |
| `config.json` | 端口、Argon2id 哈希、创建时间 |
| `sessions.json` | 每个令牌的 SHA-256，以及过期时间 |
| `items.json` | 这一叠，包括还在撤销窗口里的纸条 |
| `blobs/` | 文件内容，文件名是 SHA-256 |
| `thumbs/` | JPEG 预览，`<hash>.jpg` |
| `incoming/` | 和 blobs 在同一文件系统上的上传临时文件 |
| `slip.lock` | 正在运行的进程拿着的建议锁 |

写入先在同一目录放临时文件，权限 `0600`，同步，再改名。第二个进程拿不到锁，直接退出。`main` 里的清扫每 5 秒跑一次。库代码自己不启动这个循环。

相同的文件字节只存一份。每张纸条仍有自己的 id、名字和时间。

名字只取最后一段，去掉 NUL，超过 180 个字符时留下末尾 180 个。磁盘路径是哈希，不用上传来的名字。

## 口令和会话

哈希的形状是 `argon2id$v=19$m=65536,t=2,p=2$<salt>$<sum>`。生产参数是 time 2、内存 64 MiB、线程 2、16 字节盐、32 字节结果。比较是常数时间。测试用很小的代价（time 1、内存 64 KiB、线程 1），让测试保持快。

接口返回错误码，不返回翻译后的句子：`passphrase_too_short`、`passphrase_too_long`、`passphrase_mismatch`、`wrong_passphrase`、`locked`、`too_large`、`text_too_large`、`quota`、`empty`、`unauthorized`、`setup_required`、`already_setup`、`forbidden`、`bad_request`、`not_found`、`gone`。

同一个 `RemoteAddr` 在 10 分钟内失败 8 次，这个地址会被锁 15 分钟。用的是连接上的地址，不是转发头。锁定时返回 429。口令正确会清掉计数。

cookie 名叫 `slip_session`。HttpOnly，SameSite=Lax，不加 Secure，因为页面是 HTTP。更改口令保留当前这个 cookie，删掉其它的。退出所有设备会把全部会话删掉。

设置口令是 `POST /api/setup`，只能来自本机，并且只能在还没有口令的时候。

## 谁可以连接

允许：本机、RFC 1918、IPv6 本地唯一地址、链路本地地址。拒绝：公网地址，以及运营商级 NAT `100.64.0.0/10`（Go 不把它当作私网）。IPv4 映射的 IPv6 会先还原成 IPv4 再判断。

这挡不住路由器端口转发。转发进来的连接，看起来仍是路由器的局域网地址。真正的锁是口令。

分享地址的顺序是 `192.168.0.0/16`，然后 `10.0.0.0/8`，然后 `172.16.0.0/12`，然后在主机名是安全的 DNS 标签时加上 `hostname.local`。二维码编码的是第一条。启动时也会打印 `http://127.0.0.1:<port>`。绑定 `127.0.0.1`、`localhost` 或 `::1` 时只打印这一行本机地址。其它设备到不了这些地址，局域网行和二维码会是死链。空绑定或 `0.0.0.0` 仍会打印分享地址。

`GET /api/bootstrap` 告诉页面口令是否已经设置（`ready`）、这个浏览器是否已登录、对方是不是本机。地址只给本机或已登录的浏览器。用量只给已登录的浏览器。`ready` 的意思是口令已经存在，不是「还需要设置」。

## HTTP

默认监听所有网卡，端口 8787。如果这个默认端口或上次记住的端口被占用，会向后试 10 个端口，并把实际绑上的端口记下来。`--port` 和 `SLIP_PORT` 不会改去旁边的端口。

超时：请求头 10 秒，读和写 5 分钟，空闲 2 分钟。SIGINT 和 SIGTERM 在 3 秒内关闭。

第一次运行、还没有口令、也没有 `--no-open` 或 `SLIP_NO_OPEN=1` 时，如果绑定地址是空、`127.0.0.1`、`localhost` 或 `::1`，macOS 会打开浏览器。

会修改数据的请求必须带 `X-Slip: 1`。如果带了 `Origin`，它的主机必须和请求的 Host 相同。日志只记 4xx 和 5xx 的方法、路径和状态。不记正文，不记口令。HTML 和 JSON 都是 `Cache-Control: no-store`。

安全头：`nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`、`Cross-Origin-Resource-Policy: same-origin`，以及

```
Content-Security-Policy: default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

页面里没有内联脚本，所以主题由 `/boot.js` 在绘制前设置。`robots.txt` 禁止抓取。

| 方法 | 路径 | 谁 |
| --- | --- | --- |
| GET | `/` | 局域网上的任何人。页面选择见上文。 |
| GET | 静态资源、`/favicon.png`、`/robots.txt` | 局域网上的任何人 |
| GET | `/api/bootstrap` | 局域网上的任何人。部分字段会藏起来。 |
| GET | `/api/qr.svg` | 本机，或已登录的浏览器 |
| POST | `/api/setup` | 本机，且还没有口令 |
| POST | `/api/login` | 局域网上的任何人，受锁定限制 |
| POST | `/api/logout`、`/api/logout-all`、`/api/passphrase` | 已登录 |
| GET | `/api/items` | 已登录。`limit` 默认 40，最大 100。`before` 是一条 id。不认识的 id 会从最新一条重新开始。 |
| POST | `/api/text` | 已登录。JSON `{"text":"..."}`。 |
| POST | `/api/files` | 已登录。multipart 字段 `file`，最多 8 个。 |
| GET | `/api/items/{id}/raw` | 已登录。`?dl=1` 强制下载。 |
| GET | `/api/items/{id}/thumb` | 已登录，JPEG 预览 |
| DELETE | `/api/items/{id}` | 已登录。软删除。 |
| POST | `/api/restore` | 已登录。JSON `{"ids":[...]}`，且还在撤销窗口内。 |
| POST | `/api/clear` | 已登录。软删除所有还看得到的纸条。 |

按钮上的撤销保留 8 秒，可以攒下好几条 id。服务在 60 秒内仍接受恢复，慢一点的手机在横条消失后还能成功。之后清扫会丢掉纸条；如果没有别的纸条还指向那份内容，blob 和缩略图也会删掉。

可以内联显示的类型是 `image/jpeg`、`image/png`、`image/gif`、`image/webp` 和 `application/pdf`。其它类型，包括 HTML 和 SVG，都是 `Content-Disposition: attachment` 和 `Content-Type: application/octet-stream`。文件名同时给一个 ASCII 兜底和一个 RFC 5987 的 `filename*`。

缩略图是长边最多 960 像素的 JPEG，质量 70。超过 2000 万像素的图不会在进程里解码。预览做不出来时，日志只有 `thumbnail skipped`，不含文件系统路径。这张纸条仍然可以下载。

## 页面

纸色 `#f3efe6`，纸条 `#faf7f2`，墨色 `#1c1915`，次要文字 `#5e584e`，线 `#ddd4c6`，印 `#8f2d2a`，印上的字 `#f6f1e8`。深色是 `#1a1816`、`#24211d`、`#f3efe6`、`#b7aea0`，印的颜色不变。圆角 2 px。中文标志用宋体。英文单词 Slip 用界面无衬线。视口顶部有一条 4 px 的印。

书写区在最上面。最新的一张纸条左侧有 3 px 的印。文字用按钮提交，也可以用 Command/Control+Enter。Enter 是换行。拖入文件、粘贴图片或点添加文件会立刻上传，每批最多 8 个。没有图标字体，没有库存照片。动效只有加载时的一道光，`prefers-reduced-motion` 会把它关掉。

文案在 `internal/web/static/api.js`。服务不负责翻译。

## 威胁模型

| 威胁 | 0.1.0 的做法 |
| --- | --- |
| Wi-Fi 上的客人 | 仍然需要口令。流量没有加密。 |
| 端口转发，或监听公网 | 公网来源会被拒绝。从路由器转进来的不会。不要把端口公布出去。 |
| 另一个网页发起的跨站请求 | `X-Slip` 加上 Origin 检查。cookie 是 SameSite=Lax。 |
| 上传的 HTML 或 SVG | 不会在纸条的源上内联渲染。 |
| 上传名字里的路径 | 存储路径是哈希。下载名是最后一段，并做了头字段转义。 |
| 猜口令 | Argon2id、短暂锁定、最短长度。这挡不住一个从别处拿来的口令。 |
| 两个进程共用一个目录 | 第二个进程退出。 |
| 数据目录被拷走 | 口令是哈希。磁盘上的会话也是哈希。纸条正文本身是可读的，这正是这些文件存在的原因。 |

## 0.1.0 不做

- Homebrew 配方。
- `slip install` 安装 LaunchAgent。以后如果做，默认应该是关的，除非人明确要求。
- 可选的 HTTPS。
- 菜单栏图标或全局热键。
- 账号、同步或 Markdown。
