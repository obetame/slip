# 直接传（Handoff）设计文档

> 大文件的「不过手传送」——slip 只撮合两端和留一条记录，字节不落盘。
> 状态：**S1 + S2 已落地（0.4.0）**。S3 本机直通、S4 WebRTC 未开工，理由见 §5。
> 适用版本：0.4.0 起
> 英文对照：无。这是一份决策记录，不是产品文档；面向用户的说明在两份 `design` 的「直接传」一节。
>
> **落地时与本文的差异**（实现比设计更保守的地方）：
> - 只做了 B 层。A / C 层留在文档里作为后续决策，代码里没有半成品。
> - 目标设备选择只做了广播（`to` 为空）。接口保留了 `to` 字段并在服务端校验，界面上没做设备选择器。
> - 失败不写记录：会话直接消失，只有一次提示。设计里写的"失败也留一条灰卡"没有做，因为一条写着"失败"的记录比没有记录更让人困惑。
> - 一次性下载票允许 60 秒内用 3 次，而不是严格一次。浏览器会重试下载，严格一次会把重试锁在门外。
> - 界面文案用「直接传」（设计阶段叫「递条」，已推翻，见 §6），代码统一 `handoff`。
>
> **上线后发现并修掉的两个缺陷**（都是本文没预见到的，教训见 §10.5）：
> - `HEAD /pull` 会把整个流吃掉。浏览器下载前先探一次大小是正常行为，而 Go 的 mux 让 `GET` 规则也接 `HEAD`，于是探测请求把管道吸干，真正的下载拿到 0 字节。现在 `HEAD` 只回头部，不碰管道。
> - 两个下载会平分同一条管道。第一次拿 337856 字节、第二次拿 262144 字节，两边都宣告了 600000 的 `Content-Length`，**所以两边都在中途卡死、最后一起失败**——这正是「下载几秒、速度归零、提示没成功」的真身。现在管道有单消费者闸门，第二个请求直接 409。
> - **下载工具那一路查了三轮才对。** 现象是 IDM 报「一些网站不允许请求同一个文件两次」，附带 `HTTP/1.1 401 Unauthorized`。
>   1. 先怀疑分段：加了 `Accept-Ranges: none`，`Range` 请求改为忽略。**不对**，IDM 的问题不是分段。
>   2. 再怀疑并发：加了单消费者闸门。**仍然不对**，那只是让第二个请求从「平分字节」变成「被拒绝」。
>   3. 真正的根因是 **401**：**IDM 是独立进程，不共享浏览器的 cookie**，而下载地址当时要求 `requireAuth`。于是浏览器能下、IDM 一下就被挡在门外。
>   现在**票据本身就是凭据**，`/pull` 不再要求会话 cookie（见 §12）。同时保留前两轮的修复，因为读端被替换的问题真实存在，见 §7.1。

---

## 1. 结论先行

**想法可行，但不能照原样实现。** 真正的约束不在文件大小，而在三条产品前提：

| 现状前提 | 对「直连传送」的影响 |
| --- | --- |
| 其它设备只需要一个浏览器 | 浏览器不能监听端口，所以「两端直连」必须靠 WebRTC；而 WebRTC 在明文 HTTP 源上**不可靠** |
| 明文 HTTP，没有证书 | 没有安全上下文 → 浏览器**没有任何写盘 API**（FSA/OPFS 全部要 HTTPS） |
| 只有一个全家口令，没有账号 | 没有「某个人 / 某台设备」的身份，撮合需要新建一层轻量设备在线表 |

这三条里任何一条都是产品基石，不该为了一个功能推翻。所以正确的做法不是「上 WebRTC」，而是**把「不落盘」和「不过手」拆开**：

- **不落盘（不占磁盘、不受 5 GB 配额、不写 `blobs/`）** —— 在纯浏览器前提下**完全可以做到，100% 兼容现有设备**，包括 iOS 12。
- **不过手（字节连 slip 主机的网卡都不经过）** —— 需要 WebRTC，而 WebRTC 需要安全上下文。这是一个**可选加速通道**，不是基础能力。

推荐的形态是三个层次：

| 层 | 名字 | 机制 | 过手？ | 兼容性 | 定位 |
| --- | --- | --- | --- | --- | --- |
| **B** | 内存直通 | 发送端流式 POST → slip 内存管道 → 接收端走浏览器原生下载 | 过内存，不落盘 | **全兼容**（含 iOS 12） | **MVP 主干** |
| A | 真直连 | WebRTC DataChannel，slip 只做信令 | 不过手 | 取决于 S0 实测 | 能力探测成功后自动启用 |
| C | 本机直通 | 文件本来就在 slip 主机磁盘上，直接 `ServeContent` | 不经过第二次拷贝 | 全兼容 | 顺手捡的便宜，可选 |

**一句话结论**：把功能定义为「直接传：拖一个文件给别人，字节不停在板上」，B 层就能交付；A 层是锦上添花，且必须先做真机探针再决定要不要写进路线图。

---

## 2. 现状判定：50 MB 和 5 GB 该不该动

先把「为什么不支持 1 GB」说清楚，避免为一个可以被三行代码解决的问题设计一套新架构。

当前上传链路（`internal/server/items.go:upload`）：

```
multipart → os.CreateTemp(incoming/) → io.Copy(限量) → sha256 全文再读一遍
          → os.Rename → blobs/<hash>
```

- 内存不是瓶颈：`ParseMultipartForm(8<<20)` 之后走的是临时文件，`io.Copy` 是流式的，**服务端内存不会因为 1 GB 文件爆掉**。
- 真正的瓶颈是 `store.MaxFile = 50 MB` 与 `store.MaxData = 5 GB` 的组合：放宽单文件到 1 GB，5 GB 目录只装得下 5 个文件，`ErrQuota` 会变成常态。
- `hashFile` 会把文件**完整再读一遍**，1 GB 文件实际 I/O 是 2 GB。

所以判断你「没必要做」是对的，但理由要更准确：**不是做不了，是「用 5 GB 配额换 5 个大文件」不划算**。直接传的价值恰恰是把大文件从配额里摘出去——它根本不进 `blobs/`，`Usage()` 一分不涨。

> 过渡选项：如果只想先止血，把 `MaxFile` 提到 512 MB 是 `store.go:19` 一行改动 + 前端 `types.ts` 与文案同步。可以作为直接传落地前的临时方案，但不建议作为终态。

---

## 3. 需求拆解

你说的功能其实包含三件独立的事，混在一起会导致选型错位：

| # | 需求 | 是否必须「两端同时在线」 | 是否降低磁盘占用 |
| --- | --- | --- | --- |
| R1 | 传 1 GB 以上的文件 | 否（普通纸条也能，只要放宽上限） | ❌ 反而占更多 |
| R2 | 文件不进 `blobs/`，不留副本 | 是 | ✅ 关键价值 |
| R3 | 板上留一条「已递送」记录 | 是 | ✅ 只留元数据 |

**R2 是核心。** 一旦接受「R2 要求两端同时在场」，那么「发送端窗口关掉就中断」就不是缺陷，而是这个模式的语义——和 LocalSend 完全一致。文档里必须把它写成产品规则，而不是靠文案遮掩。

---

## 4. 硬约束与浏览器能力边界

这一节是全篇的地基。四条约束逐条推到底。

### 4.1 约束一：只有浏览器，没有安装

浏览器不能监听 TCP 端口，所以：

- 浏览器 → 浏览器**只能**走 WebRTC（DataChannel）。
- 浏览器 → slip 服务端 → 浏览器，是唯一不依赖 WebRTC 的通道，且 slip 必须做成**流式转发**（不能先存后发，否则违反 R2）。

### 4.2 约束二：明文 HTTP 局域网源（非安全上下文）

slip 明确放弃 HTTPS（`docs/design.zh-CN.md`「传输用 HTTP」）。在 `http://192.168.x.x:8787` 这个源上：

| 能力 | 是否可用 | 依据 |
| --- | --- | --- |
| `window.isSecureContext` | `false` | 明文 + 非 localhost |
| `showSaveFilePicker`（FSA，可流式落盘） | ❌ | 规范要求安全上下文；Chromium 桌面 86+ 支持，Safari/Firefox 全不支持，移动端也缺 |
| `navigator.storage.getDirectory`（OPFS） | ❌ | 同样是安全上下文 API（Safari 15.2+/FF 111+ 有实现，但门槛在安全上下文） |
| `RTCPeerConnection` / `createDataChannel` | ⚠️ 不确定 | 规范文本上 **没有** `[SecureContext]` 标记，MDN 页面也未标"仅安全上下文"；但 Firefox 有 `media.peerconnection.allowInsecureFromHTTP` 开关（默认关），各版本行为不一致 |
| `fetch(url, {body: file})` / `XHR.send(file)` | ✅ | 浏览器从磁盘分块读取，内存有界 |
| `<a download>` 触发下载管理器 | ✅ | 下载器自己边收边写盘，与页面内存无关 |
| `<a download>` 在 iOS 12 | ❌ | `download` 属性 iOS 13+ 才有；iOS 12 需用导航方式 |

**由此推出一个反直觉但关键的结论：**

> 在明文 HTTP 的局域网源上，唯一能「把 1 GB 流式写到磁盘」的东西，是**浏览器自己的下载管理器**，而不是你的 JS。

这条结论直接决定了 B 层的形态：接收端不能自己 `response.body` 收流再 `createWritable()`（那需要 FSA，不可用），而必须让浏览器原生下载一个 HTTP 响应——浏览器下载器会边收边写盘，内存占用恒定，iOS 12 也一样能收 2 GB 文件。

### 4.3 约束三：没有账号，只有全家口令

撮合需要「发给谁」，但系统里没有主体。需要补一层**匿名设备在线表**（见 §6.1）：客户端生成随机 `deviceId` 存 `localStorage`，随现有的 20 秒轮询上报心跳，服务端维持 45 秒 TTL 的在线列表。这不引入账号、不引入密码，只是「现在有哪几台浏览器开着」。

### 4.4 约束四：单二进制、无外部依赖、要服务 iOS 12

- 不能引 STUN/TURN：局域网内同子网可只靠 host candidate；但**访客网络 / AP 隔离 / 跨 VLAN** 会让 host candidate 与 mDNS 全部失效。A 层必须有 B 层兜底，不能单独存在。
- 不能引 WebSocket：`docs/design.zh-CN.md` 明确「没有 WebSocket」。信令走**短轮询**（传输期间 1 秒一次，最长 5 分钟），复用现有 `api()` 封装。
- iOS 12 的约束（无 `const`/`let`/箭头函数/可选链）只约束 `legacy.ts` 与 `legacy.css`，`board.ts` 是共用的——所以新逻辑必须写在 **ES5 安全子集**里，`tsc` 会做降级，但 `Promise`/`fetch`/`XHR` 要各自判断。

---

## 5. 三种形态的对比与取舍

### 5.0 先说清楚：这不是三个竞品

最容易误读的地方：A / B / C **不是「三选一」**，而是同一次直接传请求里，服务端根据「文件在哪、两端有什么能力」选出来的三条**路由**。

```
收到直接传请求
   │
   ├─ 文件在 slip 主机的共享目录里？ ──── 是 ──▶ C 本机直通
   │                                          零拷贝 · Range 续传 · 带宽 1×
   │
   └─ 否（文件在别的设备上）
        │
        ├─ A 层可用（S0 探针结论为正）且握手成功？ ── 是 ──▶ A 真直连
        │                                                  不过手 · DTLS 加密
        │
        └─ 否则 ─────────────────────────────────────▶ B 内存直通
                                                          全兼容兜底 · 永远可用
```

对用户来说只有一个动作：**直接传**。走哪条路由是服务端和浏览器能力探测的事，不该让用户选。
这一点直接决定了实现顺序：**先把能兜底的那条做出来（B），再谈两条优化路线。**

| 维度 | A 真直连（WebRTC） | B 内存直通（推荐主干） | C 本机直通 |
| --- | --- | --- | --- |
| 字节是否过 slip 主机 | ❌ 不过 | ✅ 过内存（约 512 KB 缓冲） | ✅ 只过一次读 |
| 是否落盘 | 否 | **否** | 否 |
| 是否需要安全上下文 | **是**（否则可能拿不到 `RTCPeerConnection`） | 否 | 否 |
| iOS 12 能否接收 | 基本不能 | **能** | 能 |
| 单文件上限 | 无（受接收端内存/磁盘限制） | 无（受磁盘空间限制） | 无 |
| 断点续传 | 需自己写 offset 握手 | v1 不支持 | **原生 Range，免费拿到** |
| 传输中加密 | DTLS 强制加密 | 无（与现有下载同级，明文 HTTP） | 无 |
| 失败概率 | 中（mDNS/NAT/客户端隔离/浏览器差异） | 低 | 极低 |
| 局域网带宽开销 | 1× | 2×（收发两端都不是主机时）／**1×（发送端就是主机时）** | 1× |
| 实现量 | 大（信令 + ICE + 分块 + 背压 + 重连） | 中（管道 + 状态机 + 超时） | 小 |

### 5.1 为什么 B 是主干

1. **它是唯一在明文 HTTP 下对全设备可用的方案。** A 层在 iOS 12 上大概率直接不可用，而 iOS 12 是这个项目明确要服务的目标设备。
2. **它把「不落盘」做成了默认，而不是可选。** 用户的核心诉求是「别占我那 5 GB」，B 层直接满足。
3. **它的失败模式是可见的**（进度条不动、超时），而 WebRTC 的失败模式是黑盒（ICE 卡在 `checking`）。

### 5.2 B 层的代价，必须写进产品文案

- **带宽翻倍（有条件）**：只有在收发两端都不是 slip 主机时，字节才在空口上走两遍——若三台设备全走 Wi-Fi，实际速率约为单跳的 1/3，2 GB 文件在 Wi-Fi 5 上约 2–4 分钟。发送端就是主机时只有一跳。**仍然建议在文档里建议 slip 主机接网线。**
- **发送端标签页必须开着**，且不能锁屏（移动端后台会挂起）。用 Wake Lock 缓解（Chrome/Android 与 Safari 16.4+ 可申请；iOS 12 不支持，只能提示）。
- **明文**：文件在空口明文传输。这与现有「下载纸条附件」的暴露面完全相同，不是新增风险，但**大文件意味着更长的暴露窗口**。文案要说清楚：需要加密就用 A 层。

### 5.3 A 层的真实优势不是「不过手」，是「强制加密」

值得单独强调：WebRTC 的 DataChannel 跑在 DTLS 上，**不可关闭**。所以在明文 HTTP 的 slip 上，A 层反而是唯一能给出端到端加密的通道。如果将来做「敏感文件」场景，A 层的理由是这个，而不是省一次内存拷贝。

### 5.4 本机直通（C）到底在做什么

一句话：**当文件本来就躺在运行 slip 的那台机器上时，slip 不需要接收任何字节，只要把这个已经存在的文件直接读给接收端。**

一个具体例子：

- 你的 Mac 在跑 `slip`，`~/Movies/家庭录像.mov` 是 2.1 GB。
- 你想在 iPhone 上拿到它。
- **现状**：只能走上传。50 MB 上限直接挡死；就算放宽到 2 GB，也是把一份已经在硬盘上的文件**再拷一份**进 `blobs/`，占掉 2.1 GB 配额，用完还得记得删。
- **C 层**：`slip` 打开 `~/Movies/家庭录像.mov`，用 `http.ServeContent` 发给 iPhone。没有第二份副本，没有内存中转，没有临时文件，连"传输中"这个状态都可以省掉。

技术上它就是一个 handler：

```go
func (s *Server) localFile(w http.ResponseWriter, r *http.Request) {
    // 路径必须落在 --share 指定的目录里，否则 403。
    path, info, err := s.share.Resolve(r.PathValue("name"))
    if err != nil {
        writeErr(w, http.StatusForbidden, "forbidden")
        return
    }
    f, err := os.Open(path)
    if err != nil {
        writeErr(w, http.StatusNotFound, "not_found")
        return
    }
    defer f.Close()

    w.Header().Set("Content-Disposition", contentDisposition("attachment", info.Name()))
    // ServeContent 免费送三样东西：Range（断点续传/暂停继续）、
    // If-Modified-Since、精确的 Content-Length。
    http.ServeContent(w, r, info.Name(), info.ModTime(), f)
}
```

#### 卡点：浏览器永远不告诉你本地路径

这是 C 层唯一需要设计的地方。`<input type="file">` 交出来的是一个 `File` 对象——一个字节句柄，**不是** `/Users/hejing/Movies/...` 这个位置。`File.path` 是早年 Electron 的私有扩展，标准浏览器里早已移除。

所以「页面上把文件拖进来，让服务端按路径去读」这条路**根本不通**：服务端能拿到字节，但拿不到位置；而一旦它开始接收字节，就已经退回 B 层了。

要按路径读，只能让**服务端自己知道路径**。干净的做法只有一个：

```sh
slip --share ~/Movies      # 或设置页里选一个目录
```

「直接传」的发送界面于是不用系统文件选择器，而是列出**共享目录里的文件**；点中一个，服务端就知道路径了。用户视角仍然是"挑一个文件递出去"，只是那个候选清单来自主机磁盘，而不是来自这台设备的文件系统。

> 注意这意味着 C 层**只能从 slip 主机发**。手机上的照片给 Mac，C 层帮不上——那正是 B 层存在的理由。

#### C 层的真实收益

1. **少一次搬运**：B 层要靠发送端浏览器把文件读出来再推给服务端；即使两者同机，字节也要多经过一次「浏览器 → 内核 → 服务端」的用户态往返。C 层是从磁盘直接写 socket。
2. **不占用发送端的页面**：C 层不需要任何一端的浏览器读文件，发送方可以关掉标签页（只要 URL 还有效）。
3. **断点续传、暂停/继续、可重复下载**——`ServeContent` 处理 `Range`，一个 URL 可以下多次。B 层是纯管道，没有副本可以重放，v1 实际上做不到续传，票据也只能用一次。
4. **少一个可能断的环节**：B 层依赖浏览器的 XHR 上传，C 层不依赖。
5. **实现量极小**：一个 handler + 一个目录列表接口 + 一个选择器。

> **纠正一个容易想当然的结论：C 不省带宽。**
> 当发送方就是 slip 主机时，B 层的字节从浏览器到服务端走的是本机回环（用局域网 IP 访问也通常由内核本地投递，不上空口），只有「服务端 → 接收端」这一跳占用空口，即 1×。
> 2× 只发生在收发两端都不是主机的时候，而那种场景 C 层根本用不上（C 只能从主机发）。所以拿带宽当 C 的理由是站不住的，真正的理由是上面第 1 到 4 条。

#### C 层的真实代价（这是我把它标成「可选」的原因）

**它把 slip 变成半个文件服务器。** 共享目录里的**每一个**文件，任何拿到全家口令的设备都能下载——不是"递一个"，而是"能翻着看"。而 `docs/design.zh-CN.md` 写得很清楚：

> 文件浏览器和上传页是文件夹。纸条是一叠卡片。

C 层的边界必须靠克制守住：**不暴露目录树、不做常驻的可浏览列表**，选择器只在「直接传」流程里出现一次，选中的文件生成一张 5 分钟有效期的卡片。这样它仍然是一次"事件"，不是一个"文件夹"。一旦为了好用加上"最近的文件""子目录导航"，它就变成文件浏览器了，产品定位也就变了。

#### 关键结论：C 的增量成本依赖于 B 已存在

先做 B 再做 C，C 就退化成"多一个数据源"——状态机、卡片、nonce、记录、轮询全是共享的，改动大约半天。
反过来先做 C，你还是得建整套状态机和卡片，然后 B 又要另写一条数据通道。

**所以顺序是 B → C，不是二选一。**

---

## 6. 命名（已落地，含一次推翻）

设计阶段推荐的是「递条」：与产品名「纸条」同源，中文里「递条子」本来就是"趁人不注意传东西"的说法，语义自然，也不承诺技术细节。

**上线后改成了「直接传」。** 理由是它站在「添加文件」旁边，需要一个**第一眼就读懂**的词，而「递条子」是校园语境里的梗，不是所有人都能立刻联想到传文件。

| 名称 | 结论 |
| --- | --- |
| 递条 | ❌ 真实用户反馈：看不懂 |
| 隔空 | ❌ 承诺「完全不过手」，而 B 层要经过服务端内存，名字和实现有落差 |
| **直接传** | ✅ 和「添加文件」同一句式（动词 + 名词），一眼明白：不走板子，直接给对方 |

代码和接口仍然统一用 `handoff`：`internal/handoff/`、`/api/handoff`、卡片 `kind: "handoff"`。界面语言和代码语言不必一致——前者要对用户清楚，后者要对读代码的人清楚。

按钮的 hover 说明：「直接传到对方设备，不占用板子的空间」。手机上没有 hover，所以标签本身必须自解释，这也是改名的主因。

---

## 7. 状态机

会话是两个浏览器的共同状态，服务端是唯一裁判。所有转移都必须有超时。

```
                                  ┌──────────── 任一方取消 ────────────┐
                                  ▼                                    │
  draft ──POST /handoff──▶ offered ──accept──▶ accepted ──双方就位──▶ sending ──EOF+校验──▶ done
                             │  │                 ▲  │                  │
                       5 分钟 │  │ decline         │  │ 读端断开          │ 校验不符 / 次数用尽
                             ▼  ▼                 │  ▼                  ▼
                          expired  declined      └── failed ◀───────── failed
                                         重新开始一次尝试（gen+1）         │
                                                              写一条记录（不写 blob）
```

| 状态 | 含义 | 谁能推进 | 超时 |
| --- | --- | --- | --- |
| `offered` | 卡片已上板，等接收 | 接收端 accept / decline | 5 分钟 → `expired` |
| `accepted` | 已认领，等双方就位；**也是读端掉线后的回退态** | 两端发起 push / pull | 60 秒 → `expired` |
| `sending` | 字节在流 | 发送端写完 / 任一方中止 | 无固定上限，靠尝试超时 |
| `done` | 完成，写记录 | 服务端 | — |
| `declined` / `expired` / `failed` | 终止，卡片显示原因 | — | — |

### 7.1 一次会话是若干次尝试（上线后补的）

最初的设计是「一个会话 = 一条管道」，**这个假设是错的**，而且是 IDM 报错的根因。

浏览器的下载会被**重新发起**：浏览器自己重试、下载管理器接管（IDM 先取消浏览器的下载，再自己请求同一个 URL）、代理断开重连。而管道**只能被读一次**，第一个请求已经把字节取走了。

所以现在：

- **会话**持有一串**尝试（attempt）**。每次尝试 = 一次 push + 一次 pull + 一条全新的管道（`buf`、`pushIn` 各自独立，带自己的 ctx）。
- 读端一断，`LoseReader()` 做四件事：`gen+1`、状态退回 `accepted`、新建 pipe、cancel 旧 pipe（把阻塞在上传端的 `Write` 放出来）。
- 上传端收到 `409 restart`，页面看到 `gen` 变了就**把整个文件重传一遍**——从 0 开始，因为旧管道里的数据已经不可信。
- 发送端重新点一次「接收」也可以：同一个设备重取已接受的会话是允许的，那是重试不是冲突。
- 次数上限 `MaxAttempts = 4`，用完才真正 `failed`。

**代价要说清楚**：每次接管都从头再传。对 2 GB 的跨 Wi-Fi 传输，这仍然比「直接失败、手动重来」好，但它不是断点续传——管道没有副本，无从续起。

> 这也是为什么 `ErrRestart` 和 `ErrGone` 必须分开：前者说「这次尝试完了，但这件事没完」，后者说「整件事完了」。混成一个错误码，页面就只能报失败。


**互斥规则**（都需要显式实现）：

- 一个 `offered` 会话只能被 accept 一次，第二个请求返回 `409 already_taken`。
- 发送端同一时刻只允许 1 个活动会话；全局并发上限 2（用来给内存封顶）。
- 同一 `deviceId` 连续创建会话需限速（1 分钟内最多 5 个），复用现有 `fails` map 的思路。

---

## 8. 协议时序（B 层）

```
发送端浏览器              slip 服务端                    接收端浏览器
     │                        │                              │
     │ 1. POST /api/handoff   │                              │
     │   {name,size,mime,to}  │  只存元数据，不做任何 I/O       │
     │───────────────────────▶│                              │
     │   {id, expiresAt}      │                              │
     │◀───────────────────────│                              │
     │                        │  2. 卡片随 20s 轮询出现在板上   │
     │                        │◀─────────────────────────────│
     │                        │  3. POST /handoff/{id}/accept │
     │                        │◀─────────────────────────────│
     │                        │   {pullUrl, nonce}            │
     │                        │─────────────────────────────▶│
     │ 4. 1s 轮询拿到 accepted │                              │
     │◀───────────────────────│                              │
     │                        │  5. GET /pull?n=nonce         │
     │                        │      （先挂起，等 push 就位）    │
     │                        │◀─────────────────────────────│
     │ 6. POST /push          │                              │
     │   body = File（流式）   │                              │
     │───────────────────────▶│  ◀── 512 KB 有界环形缓冲 ──▶   │
     │                        │─────────────────────────────▶│  浏览器下载器
     │                        │                              │  边收边写盘
     │ 7. 响应 {sha256,bytes} │                              │
     │◀───────────────────────│  8. 校验通过 → 写记录（kind=handoff，无 blob）│
     │                        │                              │
     │                        │  9. 20s 轮询看到 done，卡片变灰 │
     │                        │─────────────────────────────▶│
```

关键实现细节（都是坑，逐条说）：

1. **步骤 5 必须阻塞在「等 push 就位」上，且在阻塞期间不写响应头。** 否则浏览器会先建一个 0 字节文件，Safari 可能直接判定失败。
2. **`Content-Length` 必须提前写死为声明的 `size`。** 有了它，浏览器下载器才能显示真实进度，并且能在服务端提前关闭时识别出「文件不完整」。
3. **`WriteTimeout: 5 * time.Minute` 会杀掉长传输**（`cmd/slip/main.go:90`）。2 GB 在弱 Wi-Fi（8 MB/s）下要 4 分钟，5 GB 直接超时。必须用 `http.ResponseController` 覆盖单连接截止时间：`rc.SetReadDeadline(time.Time{})` / `rc.SetWriteDeadline(time.Time{})`，并在 handler 内自己按 `select { case <-ctx.Done(): }` 控制。
4. **发送端用 XHR 而不是 fetch**：只有 `xhr.upload.onprogress` 能给出上传进度，`fetch` 不能。`body` 直接传 `File` 对象，浏览器会流式发送，不会把 1 GB 读进内存。
5. **取消要双向传播**：接收端关页面 → `w.Write` 返回错误 → 置 `err` → 发送端 `xhr.abort()`；发送端关页面 → `r.Body` 返回错误 → 接收端下载器收到截断。

---

## 9. 接口设计

全部挂在现有 mux 上，写操作沿用 `requireWrite`（`X-Slip: 1` + Origin 同源），读操作沿用 `requireAuth`（cookie）。

| 方法 | 路径 | 作用 | 鉴权 |
| --- | --- | --- | --- |
| `POST` | `/api/handoff` | 创建会话（只传元数据） | write + auth |
| `GET` | `/api/handoff` | 列出进行中的会话（给板子渲染卡片） | auth |
| `GET` | `/api/handoff/{id}` | 查单个会话状态 | auth |
| `POST` | `/api/handoff/{id}/accept` | 认领，返回一次性 pull 凭据 | write + auth |
| `POST` | `/api/handoff/{id}/decline` | 拒绝 | write + auth |
| `POST` | `/api/handoff/{id}/cancel` | 任一方取消 | write + auth |
| `POST` | `/api/handoff/{id}/push` | 发送端流式上传（裸 `application/octet-stream`） | write + auth |
| `GET` | `/api/handoff/{id}/pull?n=<nonce>` | 接收端下载（**不加 `X-Slip`，也不要 cookie**） | **仅 ticket** |
| `GET` | `/api/devices` | 在线设备列表 | auth |

> **`/pull` 既不能要 `X-Slip` 头，也不能要会话 cookie。** 前者是因为浏览器下载器无法设置自定义头，后者是因为**下载管理器是独立进程，有自己的 cookie 罐**——要求 cookie 就等于把所有外部下载器挡成 401，这正是 IDM 那一轮的真正原因。
>
> 所以**票据本身是凭据**：128 bit 随机、绑定一个会话、10 分钟有效、每次 GET 消耗一次（上限 16）、HEAD 探测不消耗、取消会话即作废。这和对象存储的「预签名 URL」是同一个模型。代价要说明白：**拿到这个 URL 的人就能下载**，所以它只适合局域网 + 家庭口令这个信任级别。

### 9.1 创建会话

```http
POST /api/handoff
X-Slip: 1
Content-Type: application/json

{ "name": "家庭录像-2026.mp4", "size": 2147483648, "mime": "video/mp4", "to": "" }
```

```json
{ "id": "9f3c1a7b2d4e5f60", "expiresAt": "2026-11-07T17:08:37Z", "state": "offered" }
```

`size` 上限设 **64 GB**（防误操作，不是技术上限）；`name` 走现有 `store.cleanName`。

### 9.2 认领

```json
{ "nonce": "b1c9…（64 hex）", "pullUrl": "/api/handoff/9f3c1a7b/pull?n=b1c9…", "expiresIn": 60 }
```

### 9.3 上传（发送端）

```http
POST /api/handoff/9f3c1a7b2d4e5f60/push
X-Slip: 1
Content-Type: application/octet-stream
Content-Length: 2147483648

<二进制流>
```

响应：`{ "sha256": "…", "bytes": 2147483648, "ms": 94213 }`
发送端把它和自己算的哈希比对，不一致就报错（其实服务端已经比对过，这里是双保险）。

### 9.4 下载（接收端）

```http
GET /api/handoff/9f3c1a7b2d4e5f60/pull?n=b1c9…
Cookie: slip_session=…
```

```
200 OK
Content-Type: application/octet-stream
Content-Length: 2147483648
Content-Disposition: attachment; filename="____.mp4"; filename*=UTF-8''<pct-encoded>
Cache-Control: no-store
X-Content-Type-Options: nosniff
```

---

## 10. 服务端实现要点

### 10.1 新包 `internal/handoff`

```go
package handoff

type State string

const (
    Offered  State = "offered"
    Accepted State = "accepted"
    Sending  State = "sending"
    Done     State = "done"
    Declined State = "declined"
    Failed   State = "failed"
    Expired  State = "expired"
)

// Session 只在内存里，进程重启即丢。
// 这是有意的：不落盘的东西不该被持久化。
type Session struct {
    ID       string
    Meta     Meta      // name, size, mime
    From     Device    // deviceId + 显示名
    To       string    // "" = 广播
    State    State
    Created  time.Time
    Deadline time.Time

    buf      chan []byte // 有界，容量 chunkN
    pushUp   chan struct{} // 发送端已就位
    pullUp   chan struct{} // 接收端已就位
    once     sync.Once
    cancel   context.CancelFunc
    got      int64
    sum      [sha256.Size]byte
    off      int64
}
```

### 10.2 有界管道（背压的核心）

不要用 `io.Pipe()`——它没有容量，会让发送端和接收端强制 1:1 抖动。用固定容量的 channel 做双端解耦：

```go
const (
    chunkSize = 256 << 10 // 256 KB
    chunkN    = 2         // 每会话 512 KB
)

// Write 由发送端调用；缓冲满时阻塞，压力经 TCP 传回浏览器，浏览器自然放慢读取。
func (s *Session) Write(b []byte) (int, error) {
    select {
    case s.buf <- b:
        return len(b), nil
    case <-s.ctx.Done():
        return 0, s.ctx.Err()
    }
}

// Read 由接收端调用。
func (s *Session) Read() ([]byte, bool) {
    select {
    case b, ok := <-s.buf:
        return b, ok
    case <-s.ctx.Done():
        return nil, false
    }
}
```

**内存上限是算得出来的**：2 个并发会话 × 512 KB = 1 MB 常驻。加 `sessions` map 本身也就几百字节。这是 B 层最重要的性质——它不会因为「文件大」而吃内存。

### 10.3 push handler 骨架

```go
func (h *Hub) push(w http.ResponseWriter, r *http.Request) {
    s, ok := h.live(r.PathValue("id"))
    if !ok { writeErr(w, 409, "gone"); return }

    // 覆盖全局 5 分钟读写超时，否则大文件必被杀。
    rc := http.NewResponseController(w)
    _ = rc.SetReadDeadline(time.Time{})
    _ = rc.SetWriteDeadline(time.Time{})
    defer func() { _ = rc.SetReadDeadline(time.Now()) }() // 交出连接时恢复

    if err := s.beginPush(r.Context()); err != nil { // 状态检查 + 等接收端
        writeErr(w, 409, byState(err)); return
    }
    defer s.Close()

    hash := sha256.New()
    buf := make([]byte, chunkSize)
    for {
        n, err := r.Body.Read(buf)
        if n > 0 {
            // 边算边发，单遍 I/O：不预扫描文件。
            hash.Write(buf[:n])
            if _, werr := s.Write(append([]byte(nil), buf[:n]...)); werr != nil {
                writeErr(w, 499, "cancelled"); return
            }
            s.add(int64(n))
        }
        if err == io.EOF { break }
        if err != nil { writeErr(w, 400, "broken"); return }
    }
    ...
    writeJSON(w, 200, map[string]any{"sha256": hex.EncodeToString(hash.Sum(nil)), "bytes": s.got})
}
```

### 10.4 pull handler 骨架

```go
func (h *Hub) pull(w http.ResponseWriter, r *http.Request) {
    s, ok := h.live(r.PathValue("id"))
    if !ok || !s.takeNonce(r.URL.Query().Get("n")) {
        writeErr(w, 404, "not_found"); return   // 一次性：拿走过就作废
    }
    rc := http.NewResponseController(w)
    _ = rc.SetWriteDeadline(time.Time{})
    defer func() { _ = rc.SetWriteDeadline(time.Now()) }()

    // 阻塞等发送端就位；期间一个字节都不写，浏览器显示"正在等待"。
    if err := s.beginPull(r.Context()); err != nil {
        writeErr(w, 409, "gone"); return
    }

    hdr := w.Header()
    hdr.Set("Content-Type", "application/octet-stream")
    hdr.Set("Content-Length", strconv.FormatInt(s.Meta.Size, 10)) // 进度条与截断检测都靠它
    hdr.Set("Content-Disposition", contentDisposition("attachment", s.Meta.Name))
    hdr.Set("Cache-Control", "no-store")
    w.WriteHeader(200)
    flush(w)

    for {
        b, ok := s.Read()
        if !ok { break }
        if _, err := w.Write(b); err != nil { s.Fail(err); return }
        flush(w)
    }
    if s.got != s.Meta.Size || s.state != Done {
        s.Fail(errShort)   // 长度不符：让发送端/记录都标失败
    }
}
```

### 10.5 pull 接口的三条硬约束（都是上线后补的）

这段代码第一版是照着下面的骨架写的，看着没问题，实际漏了三件事。它们不是实现细节，是这个传输模型的**结构性要求**：

**1. 只有 GET 才能下载，HEAD 必须单独回答。**
Go 的 `ServeMux` 里一条 `GET /x` 规则**同时接 `HEAD`**。浏览器（以及它前面的代理）经常在真正下载前先 `HEAD` 一次拿大小，于是这个探测请求会把整条管道吸进一个没人要的响应体里，紧接着的下载拿到 0 字节。正确做法是 `HEAD` 只根据会话元数据回头部，**不消耗票据、不碰管道**；其它方法一律 405。

**2. 一条管道只有一个消费者，而且「谁该赢」得由服务端决定。**
`buf` 是单消费者 channel，但接口没有拦第二个人。两个下载同时进来时会平分字节流：一个拿到 337856、一个拿到 262144，两边都写着 `Content-Length: 600000`，**所以两边都在中途停住、最后一起失败**。症状是"下载几秒后速度归零"。第一版修法是加一个 `pulling` 闸门，第二个直接 409。

**但闸门本身会让下载工具永远拿不到。** IDM 的做法是「抢在浏览器前面接管」：浏览器那个请求并没有真的断，它还在流，于是 IDM 的请求一次次撞在闸门上，看到的就是"本站不允许请求同一个文件两次"。

所以规则改成 **后来者抢占**：一个会话本来只有一个接收方，任何第二个请求都是重试、接管或误触，最新的那个才是人正在等的。抢占会换一条新管道、`gen+1`、让对方从头发一遍（见 §7.1）。两道保险防止滥用：`PreemptGrace = 400ms`（避免浏览器瞬间发两个请求时自己打自己），以及抢占计入 `MaxAttempts`。

**3. 关闭管道必须发生在记录完 sha256 之后。**
`close(buf)` 会唤醒接收端。如果先关再写 `sent`/`sha`，接收端可能在两者之间抢到锁，看到一个 `sha` 还是空的会话，于是把一次**已经成功的传输**判成 short。顺序必须是：先落记录，再关管道。

**4. `Accept-Ranges: none` 必须发，`Range` 请求只能被忽略。**
多线程下载器（IDM、迅雷、FDM）的工作方式是「同一个 URL 开多个连接 + 按字节范围切段」。一条管道两样都做不到：**不能切段**（没有副本可以 seek），**也不能开第二个连接**（单消费者）。`Accept-Ranges: none` 是规范里唯一的"请你别分段"信号，会读它的下载器自动退回单连接，这是让 IDM 这类工具还能用的唯一办法。

它要还是并行请求，第二个连接会拿到 `409 one_shot`——**这是最诚实的回答，不要试图用 200 + 空 body 敷衍**，那会让对端以为文件是 0 字节，报出来的错更难懂。

> 所以，「多线程下载器用不了」不是缺陷，是这个传输模型的直接推论：**一条单向、单次、不可回退的水管，天生无法被切成 N 段**。想让 IDM 任意并行只有一条路——服务端手里得有一份可以 seek 的文件，也就是 C 层（`http.ServeContent` 自带 Range）。这也是 C 层真正的价值所在，比"少一次拷贝"重要得多。

> 这三条共同说明一件事：**管道是有状态的、单次的、不可重放的**，所有"多一次请求没关系"的直觉在这里都不成立。

### 10.6 不落盘的三条纪律

1. **不碰 `s.store.IncomingDir()`**，不走 `AddFile`，不写 `blobs/`。
2. **不写 `items.json` 直到 `done`**，且写的是 `Item{Kind: KindHandoff, Transfer: ...}`，`Blob` 为空。
3. **`purgeLocked` / `sweepLocked` 不需要改**：它们按 `it.Blob != ""` 与目录里实际文件来做，`Blob` 为空自然被忽略。

### 10.7 记录的数据结构

```go
const KindHandoff = "handoff"

// Transfer 是直接传留在板上的唯一痕迹。没有 Blob，没有字节。
type Transfer struct {
    Peer       string `json:"peer"`              // 对方设备显示名
    Out        bool   `json:"out"`               // true=我发的，false=我收的
    SHA256     string `json:"sha256"`            // 校验码，事后可比对
    DurationMS int64  `json:"durationMs"`
    Msg        string `json:"msg,omitempty"`     // failed 时的原因码
}
```

`Item.Size` 照常记录（用于展示），**但 `Usage()` 只扫 `blobs/`，所以用量不会涨**——这正是我们要的语义，不需要额外处理。

`Public()` 增加 `transfer` 字段；`raw` / `thumb` 对 `Blob == ""` 的条目返回 `404 not_stored`（`BlobPath` 已经会返回 `ErrNotFound`，只需在 `writeStoreErr` 里补一个分支映射到 `not_stored`，前端据此显示「这条记录不含文件」）。

---

## 11. 前端实现要点

### 11.1 复用 20 秒轮询，不新增常驻连接

`board.ts:1010` 已经在 `board` 视图每 20 秒 `GET /api/items?limit=1`。把它扩展成 `GET /api/board?limit=1&presence=1`，一次返回：

```json
{
  "items": [ ... ],
  "hasMore": false,
  "devices": [ { "id": "…", "name": "MacBook 上的 Chrome", "seen": 3 } ],
  "handoffs": [ { "id": "…", "state": "offered", "name": "…", "size": 2147483648, "from": "…" } ]
}
```

**好处**：零新增请求、零新增连接，符合「没有 WebSocket、没有后台同步」的既有规则。代价是卡片最多晚 20 秒出现——可以接受，因为下一步的「传输中」状态用 1 秒的短轮询单独处理。

> 传输中的信令（等 accept、等完成）用 `setInterval(1000)`，会话结束或离开页面立即 `clearInterval`。最长 5 分钟自动停。

### 11.2 发送端：XHR 才有进度

```ts
// 用 XHR 而不是 fetch：只有 upload.onprogress 能给上传进度。
function push(id: string, file: File, onProgress: (r: number) => void): Promise<PushReply> {
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/handoff/" + id + "/push");
    xhr.setRequestHeader("X-Slip", "1");
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = function () {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
      else reject(errFrom(xhr.status));
    };
    xhr.onerror = function () { reject(codeErr("errorNet")); };
    xhr.send(file);   // File 直接给，浏览器从磁盘分块推送，内存恒定
  });
}
```

装一个全局 `activeXHR`，取消时 `xhr.abort()`；`beforeunload` 时也 abort（否则服务端要等 TCP 超时）。

### 11.3 接收端：让浏览器下载器干活

```ts
// 现代页面：a[download] 不会离开当前页。
function startPull(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";            // 文件名由 Content-Disposition 决定
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
```

- **iOS 12 没有 `download` 属性**：legacy 页面用 `window.open(url, "_blank")`，由 Safari 接管下载；提示「下载完成后回到这个页面」。
- **接收端页面无法知道下载何时完成**（下载器不在页面控制范围内）。闭环靠轮询：服务端在 pull 正常结束时置 `done` 并写记录，接收端 1 秒轮询看到 `done` 就把卡片变成「已接收」。这个「服务端知道、页面通过轮询得知」的设计，是 B 层能自洽的关键。

### 11.4 卡片形态

| 状态 | 显示 | 可点 |
| --- | --- | --- |
| `offered`（别人发的） | 「MacBook 想递来 `xxx.mp4` · 2.0 GB」+ `接收` `拒绝` | 接收 / 拒绝 |
| `offered`（自己发的） | 「等待接收…」+ 目标设备名 + `撤回` | 撤回 |
| `accepted` | 「对方已认领，正在建立连接…」 | 取消 |
| `sending` | 双向进度条 + 实时速率 + 剩余时间 | 取消 |
| `done`（记录） | 灰卡：「已递出 · 2.0 GB · **未占用空间**」+ 校验码前 8 位 | 删除（同普通纸条） |
| `failed` / `expired` | 灰卡 + 原因 + `重新递送` | 重试 / 删除 |

「未占用空间」这个词必须出现在完成记录上，否则用户会疑惑「为什么装了个 2 GB 文件，用量没变」。

### 11.5 legacy 页面的差异清单

- 无 `download` 属性 → `window.open`。
- 无 `fetch` 的 `ReadableStream` → 不影响（我们不用）。
- 无 Optional chaining / 模板字符串注意 `tsc` target（现有 `tooling` 已降到 ES5）。
- 无 Wake Lock → 提示「请保持屏幕常亮」。
- 无 `PerformanceObserver` → 速率用 `bytes/elapsed` 粗算即可。

---

## 12. 安全模型

局域网 + 全家口令，威胁模型不是「互联网攻击者」，而是**同一个口令下的设备互相欺骗**，以及**口令泄漏**。

| 威胁 | 场景 | 对策 |
| --- | --- | --- |
| T1 钓鱼接收 | 攻击者发一个名为「工资条.pdf」的 offer，诱导点击 | 卡片必须显示**发送设备名 + 大小 + 后端连接状态**；`offered` 状态永远不能自动下载，必须人手点「接收」 |
| T2 冒名 | 攻击者把设备名改成「我的 MacBook」 | 首次与某 `deviceId` 交互时显示 **4 位确认码（SAS）**，两端应显示相同数字；确认后写入 `peers.json` 白名单，后续标记「已配对」 |
| T3 票据泄漏 / 重放 | pull URL 被同网段设备截获 | 128 bit 随机、10 分钟有效、绑定一个会话、每次 GET 消耗一次（上限 16）、HEAD 不消耗、取消即作废。**票据是唯一的凭据**，因为下载工具没有 cookie，见 §9 的说明 |
| T4 刷屏 DoS | 反复创建 offer 把板子刷满 | 每设备 1 个活动会话、全局 2 个并发、创建速率 5 次/分钟；复用 `server.fails` 的窗口计数模式 |
| T5 带宽占用 | 有人用直接传当常驻传输器 | 全局并发上限 + 单会话 5 分钟无进展即中止 |
| T6 传输中篡改 | 中间人改写字节 | 服务端逐块 `sha256` 并与发送端声明比对（服务端是可信的自有主机）；需要真端到端时切 A 层（DTLS） |
| T7 明文暴露 | 大文件在空口明文 | 与现有附件下载同级，不新增风险类别；文案说明，敏感文件建议 A 层 |
| T8 文件名注入 | 恶意文件名 | 复用 `store.cleanName` + 现有 `contentDisposition`（已处理 UTF-8 与引号转义） |

**明确不在威胁模型内**：拿到口令的恶意设备能读整块板子（这是现有的、已接受的设计），直接传不改变这一点。

---

## 13. 「不落盘」的验收标准

这个承诺必须可验证，否则就是文案。三条硬验收：

1. **磁盘**：传输 2 GB 的过程中，`du -s <data dir>` 保持不变；`ls <data>/blobs` 无新增；`<data>/incoming` 为空。
2. **文件句柄**：传输中 `lsof -p <pid>` 里没有 `<data>` 下的普通文件（除 `items.json` / `config.json` / `sessions.json` 的读写句柄）。
3. **内存**：传输 2 GB 时 RSS 增长 < 20 MB（1 MB 缓冲 + Go runtime 抖动）。

三条都进 CI 之外的手工验收清单（`docs/handoff-test.md` 或 `scripts/handoff-test.sh`）。

---

## 14. 兼容性矩阵（需要实测填表）

| 设备 / 浏览器 | B 层发送 | B 层接收 | A 层 | 备注 |
| --- | --- | --- | --- | --- |
| macOS Chrome / Edge | ✅ | ✅ | 待测 | 最佳组合 |
| macOS Safari | ✅ | ✅（走 Safari 下载器） | 待测 | Safari 对非安全上下文最严 |
| Windows Chrome | ✅ | ✅ | 待测 | |
| Android Chrome | ✅ | ✅（下载到 Downloads） | 待测 | 接收端体验最好 |
| iOS 17+ Safari | ⚠️ 后台会挂起 | ✅ | 待测 | 需 Wake Lock + 前台 |
| **iOS 12 Safari** | ⚠️ 大文件慎用 | ✅（新标签下载） | ❌ 预计不可用 | 降级页面，无 `download` 属性 |
| Firefox 桌面 | ✅ | ✅ | ⚠️ 有 `allowInsecureFromHTTP` 门槛 | |

A 列全部标「待测」是刻意为之：**这一列不该由文档断言，必须由 S0 探针在真机上给出结论。**

---

## 15. 风险登记表

| # | 风险 | 概率 | 影响 | 缓解 |
| --- | --- | --- | --- | --- |
| R1 | 明文 HTTP 上 `RTCPeerConnection` 在目标浏览器不可用，A 层归零 | 高 | 中（B 层已是主干，不影响交付） | S0 探针先测；A 层设计为可选 |
| R2 | 用户以为「不占空间」等于「永久保存」，发现关页面就断 | 中 | 高（信任受损） | 卡片上常驻一行说明；发送端关闭前二次确认 |
| R3 | Wi-Fi 下带宽翻倍导致体感慢 | 高 | 中 | 文案建议主机接网线；显示实时速率与剩余时间 |
| R4 | 服务端 5 分钟超时杀掉长传输 | **确定** | 高 | `http.NewResponseController` 覆盖单连接截止时间（§10.3） |
| R5 | 接收端 Safari 提前判定失败 | 中 | 中 | 阻塞等 push 就位后再写响应头；`Content-Length` 必填 |
| R6 | 移动端切后台导致中断 | 高 | 中 | Wake Lock + 提示；中断后可一键重试 |
| R7 | 「记录」与「纸条」在板子上混淆 | 中 | 低 | 独立视觉（灰卡 + 角标「直递」），操作只有删除/重试 |
| R8 | 全局并发上限被误调大，内存失控 | 低 | 中 | 上限写死在 `handoff` 包里，不做 flag |

---

## 16. 分期落地

| 阶段 | 交付物 | 验证方式 | 粗估 |
| --- | --- | --- | --- |
| **S0 探针** | 一个 `/spike/handoff` 页面：打印 `isSecureContext`、`typeof RTCPeerConnection`、尝试建 DataChannel 到第二个标签页、打印 ICE candidate 类型；尝试 `showSaveFilePicker`、`navigator.storage.getDirectory` | 在 §14 的每台真机上跑一遍，填表 | 1 人日 |
| **S1 骨架** | `internal/handoff`（只有状态机，不传字节）、`/api/handoff` 系列、`/api/board` 扩展、板子上出现 offer 卡片 | 两个标签页能完成 offered→accepted→cancel | 1.5 人日 |
| **S2 内存直通** | push/pull 管道、背压、超时覆盖、sha256 校验、写 `KindHandoff` 记录 | §13 三条验收 + 2 GB 真机对传 | 2.5 人日 |
| **S3 本机直通（可选）** | `--share DIR` + 直接传界面里的主机文件选择器 + `http.ServeContent`（Range 免费拿续传） | 从共享目录递一个 5 GB 文件，中途暂停再续 | 0.5–1 人日（**前提是 S1/S2 已完成**，复用状态机、卡片、nonce、记录） |
| **S4 WebRTC 通道（条件性）** | 仅当 S0 结论为正时开工：信令走 1s 轮询、`RTCDataChannel` 分块 + 背压、失败自动回落 B 层 | 同子网直连成功；故意开 AP 隔离验证回落 | 4 人日 |
| **S5 硬化** | 设备配对 SAS、限流、`not_stored` 文案、legacy 页面、i18n、README/design 更新 | 双语文案齐全；`just browser-test` 通过 | 2 人日 |

**实现顺序是 B → C →（条件性）A，不是三选一。** 理由见 §5.0 与 §5.4：

- S0–S2 是**不可分割的最小可用闭环**，约 5 人日，交付后「不落盘的大文件传送」就已经完整可用。
- S3 是加法而不是替代：同一套状态机换一个数据源，增量小、收益直接（零拷贝 + 1× 带宽 + 续传），但需要你先接受 `--share` 这个新概念。
- S4 只有 S0 探针结论为正才值得排期，且它的真实卖点是**加密**，不是省内存。


---

## 17. 明确不做

- **文件夹 / 多文件批量**：v1 单文件。多文件需要 manifest + 逐个流 + 部分成功语义，成本是单文件的 2 倍。
- **断点续传**：B 层是纯管道，没有随机读取能力，服务端也没有副本可以重放。只有 C 层能免费拿到（`http.ServeContent` 的 Range）。
- **跨网段 / 公网**：`lan.Allowed` 决定 slip 只服务私有网段。直接传不扩大这个边界。
- **账号体系**：设备在线表是「谁现在开着浏览器」，不是「谁是谁」。
- **服务端持久化进行中的会话**：进程重启，进行中的直接传全部作废。不落盘的东西不该被持久化。
- **给直接传记录做缩略图**：没有 blob 就没有缩略图，卡片用文件类型图标。

---

## 18. 需要你拍板的五件事

1. **名字**：`直接传`（推荐）/ `直递` / 保留 `隔空`。
2. **是否接受「字节过 slip 内存」**：接受 → S0–S2 就是完整方案；不接受 → 整个功能必须等 A 层，且 A 层只在 HTTPS 下可靠，等于要动产品基石。
3. **是否要 A 层**：建议 S0 探针跑完再决定，不要现在就写进 0.2.0。
4. **是否要 C 层（`--share DIR` 本机直通）**：建议要，但排在 B 之后（增量 0.5–1 人日）。它有独立前提——你得接受「共享目录」这个新概念，以及它把 slip 推向半个文件服务器的风险（§5.4）。
5. **记录是否上板**：我建议上板（符合「留下一条记录」的诉求），并用灰色 + 角标区分。若你担心混淆，也可以只放进设置页的「传输记录」。

**推荐路线（一句话）**：S0 探针（1 天）→ S1+S2 内存直通（5 天，此时功能已完整可用）→ S3 本机直通（0.5–1 天）→ S4 视探针结论再定。


---

## 附：与本项目既有设计的冲突清单

落地前必须同步修改的文档与代码约定：

| 位置 | 现状 | 需要改成 |
| --- | --- | --- |
| `docs/design.zh-CN.md`「它不是什么」 | 明确说「PairDrop 和 LocalSend 要求两边同时醒着……纸条还在」 | 补一句：直接传是那个模式的补充，纸条仍然保留「合上盖子还在」的默认语义 |
| `docs/design.zh-CN.md`「没有 WebSocket」 | 仍然成立 | 补一句：直接传期间用 1 秒短轮询，不引入长连接 |
| `README.md` / `README.zh-CN.md` Limits 表 | 只有 50 MB / 5 GB | 增加一行：直接传不占数据目录 |
| `cmd/slip/main.go` 超时 | `Read/WriteTimeout: 5m` | 用 `ResponseController` 在直接传 handler 内覆盖 |
| `internal/web/src/types.ts` | `Item` 无 transfer | 增加 `transfer?: Transfer`、`kind: "handoff"` |
| `internal/server/server.go` mux | 无 handoff 路由 | 增加 8 条路由 |
