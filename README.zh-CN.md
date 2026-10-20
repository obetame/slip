# 纸条 Slip

[English](README.md)

纸条是家里用的一块板子，用来放文字、图片和文件。一台电脑运行它，其它设备只用浏览器。

新的纸条在最上面。没有后台同步。只有亲手删除，内容才会消失。

## 安装

### 下载发布包

打开[最新发布](https://github.com/obetame/slip/releases/latest)，按这台电脑选择压缩包：

| 系统 | 压缩包 |
| --- | --- |
| Linux x86-64 | `slip_<version>_linux_amd64.tar.gz` |
| Linux arm64 | `slip_<version>_linux_arm64.tar.gz` |
| macOS 通用 | `slip_<version>_darwin_universal.tar.gz` |
| Windows x86-64 | `slip_<version>_windows_amd64.zip` |
| Windows arm64 | `slip_<version>_windows_arm64.zip` |

macOS 的包里是一个通用二进制，Apple 芯片和 Intel 都能跑。

同一次发布里的 `SHA256SUMS` 列出每个压缩包的校验值。在 macOS 或 Linux 上解压后，把 `slip` 放到 `PATH` 里：

```sh
tar -xzf slip_*_darwin_universal.tar.gz
chmod +x slip
sudo mv slip /usr/local/bin/slip
```

macOS 的包用 Developer ID 签名并经过 Apple 公证，打开时不会出现拦截提示，也不需要额外步骤。

在 Windows 上解压出 `slip.exe`，从命令提示符运行。Windows 可能会提示发布者未知。这个文件没有用付费证书签名。

### 用 Go 安装

需要 Go 1.27 或更新版本：

```sh
go install github.com/obetame/slip/cmd/slip@v0.1.0
```

二进制会放在 `$(go env GOPATH)/bin`。这个目录要在 `PATH` 里。

## 运行

```sh
slip
```

终端会打印本机地址。监听局域网时，还会打印其它设备可以打开的地址，以及第一条地址的二维码。绑定 `127.0.0.1`、`localhost` 或 `::1` 时只打印本机地址。第一次运行时，Mac 会打开页面，让你设置家里口令。口令至少 6 位。不要拿邮箱或银行的口令来用。页面走的是局域网里的普通 HTTP。

其它设备连上同一个 Wi-Fi，打开局域网地址，输入同一次口令。浏览器会记住 180 天。

## 参数

| 参数          | 含义                                            |
| ----------- | --------------------------------------------- |
| `--port`    | 监听端口。默认 8787，或者上次记住的端口。写明端口时，如果被占用就不会改去旁边的端口。 |
| `--data`    | 存放纸条和口令哈希的目录。                                 |
| `--host`    | 绑定地址。默认所有网卡。`127.0.0.1` 只留在这台电脑上。             |
| `--no-open` | 第一次运行时不打开浏览器。                                 |
| `--version` | 打印版本后退出。                                      |

环境变量：`SLIP_PORT`、`SLIP_DATA`、`SLIP_NO_OPEN=1`。

macOS 上的数据目录默认是 `~/Library/Application Support/slip`。目录权限 `0700`，文件权限 `0600`。

## 限度

| 限度   | 数值                          |
| ---- | --------------------------- |
| 单个文件 | 50 MB                       |
| 一条文字 | 200 KB                      |
| 数据目录 | 5 GB                        |
| 口令   | 6 到 200 个字符，只保存 Argon2id 哈希 |

图片可以查看和下载。其它文件下载。PDF 也可以查看。文字可以选中，复制按钮复制整张纸条。

## 旧 iPad

iPad mini 2 和其它 iOS 12 设备会自动打开一个更简单的页面，能做的事情是一样的。用 `/?ui=legacy` 强制打开它，用 `/?ui=modern` 回到完整页面。这个选择会记在那一个浏览器里。

## 本地开发

克隆仓库。[just](https://github.com/casey/just) 放着常用命令。没有 just 时，`make test` 和 `make build` 做同样的两件事。

```sh
git clone https://github.com/obetame/slip.git
cd slip
just test
just dev-local
```

`just dev-local` 只监听这台电脑，纸条放在一个临时目录里。它不会打开浏览器，也不会用家里那份数据。终端会打印地址。端口没被占用时是 `http://127.0.0.1:8787`。删掉那个临时目录，就可以重新设置口令。

| 命令 | 作用 |
| --- | --- |
| `just test` | 运行 `go test ./...`。 |
| `just build` | 在当前目录生成这台机器的 `./slip`。 |
| `just dev --no-open` | 从源码运行。后面的词会传给 slip。 |
| `just dev-local` | 只在本机试，使用临时数据目录。 |
| `just dist` | 在 `./dist` 里生成各系统的发布包。 |
| `just fmt` | 运行 `gofmt`。 |
| `just clean` | 删掉 `./slip` 和 `./dist`。 |

不用 just 时：

```sh
go test ./...
go run ./cmd/slip --host 127.0.0.1 --no-open
```

GitHub 会在 pull request 上跑测试，合进 `main` 后再跑一次。在 `main` 上打 `vX.Y.Z` 标签会构建发布包。分支和标签的约定写在[参与贡献](CONTRIBUTING.md)里。

## 更多

- [Design](docs/design.md) 与 [设计说明](docs/design.zh-CN.md)
- [安全说明](SECURITY.md)
- [参与贡献](CONTRIBUTING.md)

## 许可证

[MIT](LICENSE)
