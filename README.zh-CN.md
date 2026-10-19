# 纸条 Slip

[English](README.md)

纸条是家里用的一块板子，用来放文字、图片和文件。一台电脑运行它，其它设备只用浏览器。

新的纸条在最上面。没有后台同步。只有亲手删除，内容才会消失。

## 运行

需要 Go 1.23 或更新版本：

```sh
git clone https://github.com/obetame/slip.git
cd slip
go build -ldflags="-s -w" -o slip ./cmd/slip
./slip
```

终端会打印本机地址。监听局域网时，还会打印其它设备可以打开的地址，以及第一条地址的二维码。绑定 `127.0.0.1`、`localhost` 或 `::1` 时只打印本机地址。第一次运行时，Mac 会打开页面，让你设置家里口令。口令至少 6 位。不要拿邮箱或银行的口令来用。页面走的是局域网里的普通 HTTP。

其它设备连上同一个 Wi-Fi，打开局域网地址，输入同一次口令。浏览器会记住 180 天。

## 参数

| 参数 | 含义 |
| --- | --- |
| `--port` | 监听端口。默认 8787，或者上次记住的端口。写明端口时，如果被占用就不会改去旁边的端口。 |
| `--data` | 存放纸条和口令哈希的目录。 |
| `--host` | 绑定地址。默认所有网卡。`127.0.0.1` 只留在这台电脑上。 |
| `--no-open` | 第一次运行时不打开浏览器。 |
| `--version` | 打印版本后退出。 |

环境变量：`SLIP_PORT`、`SLIP_DATA`、`SLIP_NO_OPEN=1`。

macOS 上的数据目录默认是 `~/Library/Application Support/slip`。目录权限 `0700`，文件权限 `0600`。

## 限度

| 限度 | 数值 |
| --- | --- |
| 单个文件 | 50 MB |
| 一条文字 | 200 KB |
| 数据目录 | 5 GB |
| 口令 | 6 到 200 个字符，只保存 Argon2id 哈希 |

图片可以查看和下载。其它文件下载。PDF 也可以查看。文字可以选中，复制按钮复制整张纸条。

## 旧 iPad

iPad mini 2 和其它 iOS 12 设备会自动打开一个更简单的页面，能做的事情是一样的。用 `/?ui=legacy` 强制打开它，用 `/?ui=modern` 回到完整页面。这个选择会记在那一个浏览器里。

## 开发

```sh
make test
make build
```

`make test` 会运行 `go test ./...`。模块语言版本停在 Go 1.23，和 CI 一致。

## 更多

- [Design](docs/design.md) 与 [设计说明](docs/design.zh-CN.md)
- [安全说明](SECURITY.md)
- [参与贡献](CONTRIBUTING.md)

## 许可证

[MIT](LICENSE)
