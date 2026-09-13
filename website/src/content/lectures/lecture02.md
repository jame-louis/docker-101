---
title: Ubuntu 软件安装体系与 Docker 实践完全手册
lectureNumber: 2
slidevUrl: slides/lecture02
draft: false
---

> 从第一性原理出发，完整梳理：安装软件的本质 → apt 仓库信任链 → 境内网络环境的两条链路 →
> Docker Engine 安装实战（VMware + Ubuntu 22.04 实机截图）。
>
> 环境：VMware Workstation 16 Pro · Ubuntu 22.04.5 LTS (jammy) · amd64 · 中国境内网络（清华 TUNA 系统源 + 阿里云 Docker 源）

---

## 目录

- [第 1 章 核心认知：境内安装要解决两条独立链路](#第-1-章-核心认知境内安装要解决两条独立链路)
- [第 2 章 第一性原理：安装软件的本质](#第-2-章-第一性原理安装软件的本质)
- [第 3 章 dpkg 与 apt：双手与大脑](#第-3-章-dpkg-与-apt双手与大脑)
- [第 4 章 apt 仓库体系：目录、索引与信任链](#第-4-章-apt-仓库体系目录索引与信任链)
- [第 5 章 安装命令逐行拆解](#第-5-章-安装命令逐行拆解)
- [第 6 章 systemctl：服务的过去与现在](#第-6-章-systemctl服务的过去与现在)
- [第 7 章 中国境内安装 Docker 完整流程](#第-7-章-中国境内安装-docker-完整流程)
- [第 8 章 实机操作记录（含截图）](#第-8-章-实机操作记录含截图)
  - [8.1 VMware Workstation 安装 Ubuntu 22.04](#81-vmware-workstation-安装-ubuntu-2204)
  - [8.2 Ubuntu 终端安装 Docker](#82-ubuntu-终端安装-docker)
- [第 9 章 延伸：Docker Desktop 官方安装法审查](#第-9-章-延伸docker-desktop-官方安装法审查)
- [附录 A 排错速查表](#附录-a-排错速查表)
- [附录 B 全流程命令速览](#附录-b-全流程命令速览)

---

## 第 1 章 核心认知：境内安装要解决两条独立链路

安装 Docker 在境内网络下涉及**两条完全不同的网络链路**，不能混在一起解决：

```
链路 A：apt 下载 .deb 安装包  →  download.docker.com 不可达  →  换阿里云 apt 源镜像
链路 B：docker pull 拉取镜像   →  docker.io 不可达          →  配 registry-mirrors
```

- 链路 A 通过换 **apt 软件源镜像**解决；链路 B 通过 **registry mirror**解决，两者互不相干。
- 链路 A 的镜像站（阿里云、清华 TUNA、中科大）原样同步官方仓库目录，**GPG 公钥也从镜像域名下载**，信任链不变。
- 链路 B 的加速器本质是 daemon 的回退列表：`docker pull` 默认问 `docker.io`，失败后按 `registry-mirrors` 顺序改问镜像站。
- 2024 年中起大批公共镜像加速器关停，**老教程的镜像清单多已失效**，需配 2~3 个互为备份。

---

## 第 2 章 第一性原理：安装软件的本质

去掉所有术语，安装一个软件的本质操作只有三件：

1. **复制文件**：可执行文件 → `/usr/bin`，库 → `/usr/lib`，配置 → `/etc`，文档 → `/usr/share/doc`
2. **登记造册**：系统记录装了什么包、什么版本、哪些文件——否则无法升级、卸载、查依赖
3. **运行脚本**：preinst / postinst / prerm / postrm——创建用户、注册服务、生成缓存等副作用

**所有包管理器都只是这三件事的自动化**，差别在"造册格式"和"文件从哪来"。

Ubuntu 装软件的五层全景：

| 层级 | 工具 | 管什么 | 类比 |
|---|---|---|---|
| 01 | dpkg | 解包 .deb、复制文件、登记、跑脚本 | 双手 |
| 02 | apt | 依赖求解、查仓库目录、下载排序 | 大脑 |
| 03 | 官方仓库 / PPA | 软件分发网络（GPG 验签） | 批发市场 |
| 04 | snap / flatpak | 依赖自带、沙箱、自动更新 | 集装箱物流 |
| 05 | 源码编译 | 自己解决一切 | 手工作坊 |

选型原则：**优先 apt，发行版版本太旧或只有 snap 版时上 snap，编译是没办法的办法**。

---

## 第 3 章 dpkg 与 apt：双手与大脑

### 3.1 .deb 文件解剖

一个 `.deb` 本质是 `ar` 归档，里面两个 tar 包：

```
someapp_1.0_amd64.deb
├── debian-binary               ← 纯文本，只有 "2.0"
├── control.tar.gz              ← 控制信息
│   ├── control                 ← 元数据：包名 / 版本 / Depends
│   ├── preinst · postinst      ← 安装前后执行的脚本
│   ├── prerm · postrm          ← 卸载前后执行的脚本
│   └── conffiles               ← 用户改过的配置要保留
└── data.tar.gz                 ← 真正的文件（tar 内路径 = 安装目标路径）
    ├── usr/bin/someapp
    ├── usr/lib/someapp/…
    └── etc/someapp/config.yaml
```

**安装的字面实现**：把 `data.tar.gz` 解压到根目录 `/`，文件即各就各位；再执行 postinst。

### 3.2 dpkg 的能力边界

```bash
sudo dpkg -i someapp.deb    # 装本地 .deb
sudo dpkg -r someapp        # 卸载（保留配置）
dpkg -l | grep someapp      # 列出已安装
dpkg -L someapp             # 这个包装了哪些文件
dpkg -S /usr/bin/someapp    # 反查文件属于哪个包
```

它**不会下载、不会解依赖**。依赖缺失就报错退出——1990 年代的 dependency hell 就是这么来的。

### 3.3 apt 的两个大脑

```
你 ──→ apt（大脑①依赖求解器 + 大脑②仓库客户端）──→ dpkg（双手）
```

- **大脑① 依赖求解器**：读取 Depends 及版本约束（`libc6 >= 2.34`），递归求闭包——拓扑排序 + 约束满足
- **大脑② 仓库客户端**：从 sources.list 取"商品目录"，update 缓存、install 提货

**推论**：直接 `dpkg -i` 网上下载的 .deb = 绕过两个大脑，容易把系统搞成半依赖状态。装 Docker 走仓库而非裸 .deb，原因在此。

### 3.4 Ubuntu 官方仓库四分区与 PPA

- `main`：自由软件，官方维护（内核、bash、python3）
- `restricted`：专有驱动，官方维护（NVIDIA 驱动）
- `universe`：自由软件，**社区维护**，更新可能滞后（htop、nginx）
- `multiverse`：版权/法律受限（某些编解码器）

PPA 的本质和手动加 Docker 仓库**一模一样**：写一个 `deb ...` 源 + 装一把 GPG 公钥，只是托管在 Launchpad 上。`add-apt-repository` 帮你做了这两件事。**只加信任作者的 PPA**——加 PPA 等于授权对方给你的系统推送任意软件。

### 3.5 生命周期动词表

| 命令 | 职责 |
|---|---|
| `apt update` | 刷新所有源的目录缓存，**不装任何东西** |
| `apt upgrade` | 升级，但**不删除任何现有包**（解不开就留旧版） |
| `apt full-upgrade` | 允许删包解依赖冲突，跨版本升级必用 |
| `apt remove` | 卸程序，**保留 /etc 配置** |
| `apt purge` | 程序 + 配置全删 |
| `apt autoremove` | 清"作为依赖被拉入、现已无人使用"的孤儿包 |
| `apt clean` | 清空 /var/cache/apt/archives/ 的 .deb 缓存 |
| `apt policy X` | 已装版本 vs 仓库可用版本，版本诊断神器 |

`apt` vs `apt-get`：apt 是 2014 年的人类友好版（彩色、进度条）；写脚本用 apt-get，接口有跨版本兼容承诺。

### 3.6 deb vs snap

| | .deb (apt) | .snap |
|---|---|---|
| 依赖 | 动态链接系统共享库 | 全部自带，互相隔离 |
| 跨发行版 | 否，与系统版本强绑定 | 是 |
| 沙箱 | 无 | 严格，默认访问不了 $HOME 以外 |
| 更新 | 显式 | snapd 自动接管 |
| 代价 | 依赖冲突风险 | 体积大、库重复、启动略慢 |

陷阱：Ubuntu 把 firefox 等换成了 snap 版，`apt install firefox` 实际装转接头——用 `which firefox` 和 `snap list` 确认。

---

## 第 4 章 apt 仓库体系：目录、索引与信任链

### 4.1 仓库物理上就是一个目录树

以阿里云 Docker 仓库为例：

```
https://mirrors.aliyun.com/docker-ce/linux/ubuntu/
├── dists/                          ← "目录 + 索引"
│   └── jammy/
│       ├── InRelease               ← ★ 全库总目录 + PGP 数字签名
│       └── stable/
│           └── binary-amd64/
│               └── Packages(.gz)   ← ★ 商品清单（纯文本）
└── pool/                           ← 真正的 .deb 货物
    └── stable/amd64/*.deb
```

`dists/` 是"目录和索引"，`pool/` 是"货物"——两者分离是 Debian 仓库设计的精髓。

### 4.2 InRelease：总目录 + 签名

```
-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

Architectures: amd64 arm64 armhf s390x ppc64el   ← 有哪些架构可选（arch= 在选这里的一项）
Components: stable edge test nightly            ← 有哪些通道可选（stable 在选这里的一项）
Suite: jammy                                     ← 服务哪个 Ubuntu 版本（jammy 填这里）
MD5Sum:
 5228944eb5c3cb8d7a321370e4c4e1d6   3080 stable/binary-amd64/Packages
 ...
-----BEGIN PGP SIGNATURE-----                    ← Docker 私钥签发，改一字签名即失效
```

### 4.3 Packages：商品清单

每个软件一个条目，**没有软件本体，只有"去哪下载、怎么验证"**：

```
Package: docker-ce
Version: 28.x.x~ubuntu.22.04~jammy
Depends: containerd.io (>= 1.6.0), ...
Filename: pool/stable/amd64/docker-ce_xxx_amd64.deb   ← apt 安装时拼「仓库URL + Filename」下载
Size: 24300000
SHA256: a7db459b27fa57e73ad6214afc9abeec…              ← 下载后校验完整性
```

### 4.4 配置行 → 目录树映射

```
deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] \
    https://mirrors.aliyun.com/docker-ce/linux/ubuntu \
    jammy stable
```

| 配置词 | 落到哪里 |
|---|---|
| `deb` | 声明二进制包仓库（决定找 binary-*/Packages） |
| URL | 所有路径的根 |
| `jammy` | 拼成 `dists/jammy/`，填错即 404 |
| `stable` | 拼成 `dists/jammy/stable/` |
| `arch=amd64` | 只下 `binary-amd64/Packages` 一份索引 |
| `signed-by` | 验证 `dists/jammy/InRelease` 签名的公钥 |

大白话：*"apt，去这个 URL 看 dists/jammy/ 的总目录，用这把公钥验签，只下载 stable 通道里 binary-amd64 那份清单。"*

### 4.5 apt update 的四步信任链

```
① 拼地址下载 dists/jammy/InRelease
② 用 docker.gpg 公钥验 PGP 签名 ── 签名无效立刻中止
③ 按 InRelease 清单下载 dists/jammy/stable/binary-amd64/Packages.gz，哈希校验
④ 缓存到 /var/lib/apt/lists/（此后 install/search 全查本地缓存）
```

信任传递链：**PGP 签名 ─验签→ InRelease ─哈希→ Packages ─哈希→ 每个 .deb**。
攻击者黑进镜像站替换 .deb 也没用——没有 Docker 私钥，改不了签名，链条在第一环就断。这就是 `signed-by` 和装 GPG 公钥的全部意义。

### 4.6 apt install 数据流

```
apt install docker-ce
  → 查本地缓存 /var/lib/apt/lists/ 的 Packages
  → 解析依赖闭包
  → 按条目的 Filename 拼下载地址（仓库URL + Filename）
  → 下载 → SHA256 校验 → dpkg 解包安装
```

**先 update 再 install**：install 只查本地目录缓存，目录过期就找不到包。

---

## 第 5 章 安装命令逐行拆解

### 5.1 GPG 公钥管道

```bash
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

- `|` 管道：左边命令的标准输出直接喂给右边的标准输入，全程不落中间文件
- `curl -fsSL`：`f` 遇 HTTP 错误即失败（防止把错误页面当密钥）、`s` 静默、`S` 出错时仍要吭声
- `gpg --dearmor`：把带 `BEGIN PGP PUBLIC KEY BLOCK` 外壳的文本公钥转成 apt 用的二进制
- `-o`：输出到文件而非终端
- 行尾 `\`：告诉 bash 命令未完，下一行是延续（纯排版）

### 5.2 权限修正

```bash
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

root 创建的文件默认仅所有者可读，apt 验签以普通用户权限读公钥 → 必须所有人可读。

### 5.3 仓库配置拼装

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://mirrors.aliyun.com/docker-ce/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

- `$(命令)`：bash 命令替换——先执行括号内命令，把输出填到这里（模板填空）
- `dpkg --print-architecture`：机器自己报 amd64/arm64，不写死
- `. /etc/os-release && echo "$VERSION_CODENAME"`：执行系统元信息文件后取代号变量（jammy），一个模板适配所有 Ubuntu 版本
- 双引号包住整体：`$( )` 会被执行替换，同时 `$VERSION_CODENAME` 不被拆词
- `tee`：T 型分叉，把 stdin 一边写文件一边回显；`sudo tee` 才能以 root 写 `/etc` 下的文件（`sudo cmd > file` 里 sudo 管不到重定向）
- `> /dev/null`：把 tee 的回显丢掉（/dev/null 是系统垃圾桶）
- 放在 `sources.list.d/` 而非主文件：第三方源各占一个"单间"，停用删文件即可

### 5.4 基础工具安装

```bash
sudo apt install -y ca-certificates curl gnupg
```

- `-y`：提问自动答 yes（写脚本用；手动装可去掉）
- `ca-certificates`：CA 根证书，没有它 HTTPS 全报不可信
- `curl`：命令行下载工具；`gnupg`：GPG 工具集

---

## 第 6 章 systemctl：服务的过去与现在

```bash
sudo systemctl enable --now docker
```

等价于 `enable`（管以后）+ `start`（管现在）两步合一。

### 6.1 enable 的本质：创建符号链接

开机启动的本质问题是"谁决定哪些程序被拉起"。systemd 把系统组织成**依赖图**，节点是 unit（文本配置文件 `/usr/lib/systemd/system/docker.service`）：

```
[Unit]     → 我是谁、依赖谁（After=network-online.target）
[Service]  → 怎么启动我（ExecStart=/usr/bin/dockerd；Type=notify 启动完主动通知）
[Install]  → 我属于哪个目标（WantedBy=multi-user.target）
```

`enable docker` = 在 `/etc/systemd/system/multi-user.target.wants/` 下创建一个指向 docker.service 的软链接。**只改配置，不启动进程**；`disable` 删链接，不影响当前运行中的进程。

`systemctl is-enabled docker` 的状态词：`enabled` / `disabled` / `static`（无 [Install] 段，不能 enable）/ `masked`（屏蔽，钩子指向 /dev/null，连手动 start 都不行）。

### 6.2 start：拉起并托管进程

systemd 按 unit 描述 fork 进程执行 ExecStart，启动完成后标记 active (running)。此后进程被 systemd **收养托管**：崩溃可按 Restart= 策略自动拉起。这就是"不要 nohup 手撸后台进程"的原因——手撸的进程没有户口。

### 6.3 配套命令

```bash
systemctl status docker          # 一眼看全：状态 + PID + 最近日志
systemctl is-active docker       # 只问活没活（脚本判断用）
sudo systemctl reload docker     # 重载配置不重启进程（走 ExecReload）
sudo systemctl mask docker       # 屏蔽：谁也启动不了（比 disable 更强）

journalctl -u docker -f          # 服务日志实时滚动（相当于服务的 tail -f）

sudo systemctl daemon-reload     # 改了 unit 文件后必须先重扫配置
sudo systemctl restart docker    # 再重启才生效——顺序不能反
```

sudo 的原因：systemd 通过特权 socket 接受管理请求，控制系统服务 = 系统级权限。例外：`systemctl --user` 走用户自己的实例，不需要 sudo（Docker Desktop 用的就是它）。

---

## 第 7 章 中国境内安装 Docker 完整流程

```bash
# 0. 前置
sudo apt update
sudo apt install -y ca-certificates curl gnupg

# 1. GPG 公钥（验签的前提，从国内镜像下载，内容一致）
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 2. 仓库配置（指向阿里云镜像）
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://mirrors.aliyun.com/docker-ce/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 3. 安装（五个包：CLI → 引擎 → 运行时 → 构建 → 编排）
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# 4. 启动 + 授权
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker

# 5. 镜像加速器（链路 B）
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker

# 6. 终验（同时验证两条链路）
docker info | grep -A 5 "Registry Mirrors"
docker run hello-world
```

**不要装** `docker`（无关软件）或 `docker.io`（旧版）。若有阿里云账号，可在「容器镜像服务 → 镜像加速器」领取专属地址加入 mirrors 列表。

---

## 第 8 章 实机操作记录（含截图）

环境：VMware Workstation 16 Pro（宿主机 Windows），虚拟机名 `Ubuntu22.04`，
配置 4GB 内存 / 2 CPU 内核 / 30GB 磁盘（拆分）/ NAT 网络，ISO 为 `ubuntu-22.04.5-desktop-amd64.iso`。

### 8.1 VMware Workstation 安装 Ubuntu 22.04

**步骤 1–2 打开新建虚拟机向导**：主页点击「创建新的虚拟机」，选择**典型（推荐）**配置；安装来源选择**稍后安装操作系统**（先建空硬盘再挂 ISO，可控性更强）。

![新建虚拟机向导-典型配置](images/vm-install-ubuntu-step-1.png)

![稍后安装操作系统](images/vm-install-ubuntu-step-2.png)

**步骤 3 选择客户机操作系统**：Linux → Ubuntu 64 位。

![选择 Linux / Ubuntu 64 位](images/vm-install-ubuntu-step-3.png)

**步骤 4 命名虚拟机**：名称 `Ubuntu22.04`，位置 `D:\Documents\Virtual Machines\Ubuntu22.04`。

![命名虚拟机](images/vm-install-ubuntu-step-4.png)

**步骤 5 指定磁盘容量**：30 GB，选择**将虚拟磁盘拆分成多个文件**（便于移动，代价是大容量下性能略降）。

![指定磁盘容量 30GB 拆分](images/vm-install-ubuntu-step-5.png)

**步骤 6 确认配置**：汇总核对——Ubuntu 64 位、30GB 拆分磁盘、4GB 内存、NAT 网络、2 个 CPU 内核。点击「完成」。

![确认配置完成创建](images/vm-install-ubuntu-step-6.png)

**步骤 7 挂载 ISO**：虚拟机设置 → CD/DVD (SATA) → 使用 ISO 映像文件，选中
`E:\workspace\课程软件\vm\ubuntu-22.04.5-desktop-amd64.iso`，勾选「启动时连接」。

![挂载 Ubuntu ISO 镜像](images/vm-install-ubuntu-step-7.png)

**步骤 8 开机安装，选择键盘布局**：English (US)（默认）→ 继续。

![键盘布局 English (US)](images/vm-install-ubuntu-step-8.png)

**步骤 9 更新和其他软件**：选择**最小安装**（网络浏览器和基本工具）——Docker 学习环境够用，体积更小；勾选「安装 Ubuntu 时下载更新」，不勾第三方软件。

![最小安装](images/vm-install-ubuntu-step-9.png)

**步骤 10 安装类型**：**清除整个磁盘并安装 Ubuntu**（虚拟机磁盘是空的，放心抹除）→ 现在安装。

![清除整个磁盘并安装](images/vm-install-ubuntu-step-10.png)

**步骤 11 时区**：Shanghai（UTC+8）。

![时区 Shanghai](images/vm-install-ubuntu-step-11.png)

**步骤 12 复制文件**：等待安装程序复制文件（约数十分钟）。

![正在复制文件](images/vm-install-ubuntu-step-12.png)

**步骤 13 安装完成**：点击「现在重启」。

![安装完成提示重启](images/vm-install-ubuntu-step-13.png)

> ⚠️ **关键**：重启前把 CD/DVD 从 ISO 改回**物理驱动器**（或断开连接），否则虚拟机会再次从 ISO 引导、循环进入安装界面。

![改回物理驱动器](images/vm-install-ubuntu-step-14.png)

**步骤 14–15 从硬盘启动并登录**：进入登录界面，选择用户 **xujc** 输入密码。

![登录界面](images/vm-install-ubuntu-step-15.png)

**步骤 16 进入桌面**：Ubuntu 22.04 桌面（Jellyfish 壁纸）。基础系统安装完成。

![Ubuntu 22.04 桌面](images/vm-install-ubuntu-step-16.png)

### 8.2 Ubuntu 终端安装 Docker

本机系统源已配清华 TUNA 镜像，Docker 源用阿里云镜像（两条链路分别解决）。

**步骤 1 刷新索引**：`sudo apt update`，命中清华源四个组件，提示 426 个包可升级。

![apt update 命中清华源](images/ubuntu-install-docker-step-1.png)

**步骤 2 装基础工具**：`sudo apt install -y ca-certificates curl gnupg`，apt 自动解依赖（升级 13 个包、新装 curl）。

![安装 ca-certificates curl gnupg](images/ubuntu-install-docker-step-2.png)

**步骤 3 创建密钥目录**：`sudo install -m 0755 -d /etc/apt/keyrings`；用 `ls -al /etc/apt/` 观察目录结构（keyrings、sources.list.d、trusted.gpg.d 并列）。

![创建 keyrings 目录](images/ubuntu-install-docker-step-3.png)

**步骤 4 下载 GPG 公钥**：`curl -fsSL .../gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg`，随后 `chmod a+r`；`ls -l` 确认权限为 `-rw-r--r--`。

![下载并转换 GPG 公钥](images/ubuntu-install-docker-step-4.png)

**步骤 5 写仓库配置**：先 `dpkg --print-architecture`（amd64）、`cat /etc/os-release`（jammy）确认两个自动填空项；写 `docker.list` 并 `cat` 验证内容正确。

> ⚠️ 本步真实踩坑：首次执行时命令首混入了终端控制字符，报 `echo: 未找到命令`——重新干净输入后成功。

![确认架构与代号并写 docker.list](images/ubuntu-install-docker-step-5.png)

**步骤 6 刷新索引 + 安装**：`sudo apt update` 成功从阿里云拉取 `jammy InRelease` 和 `stable amd64 Packages`；`apt install` 五个包，混合从阿里云 Docker 源与清华 Ubuntu 源下载全部依赖。

![apt update 与安装五个包](images/ubuntu-install-docker-step-6.png)

**步骤 7 启动服务**：`sudo systemctl enable --now docker`，钩子挂上且进程拉起。

![systemctl enable --now docker](images/ubuntu-install-docker-step-7.png)

**步骤 8 用户授权**：首次 `docker ps` 报 `permission denied`（socket 权限）；`usermod -aG docker $USER` + `newgrp docker` 后正常输出表头。

![用户组授权前后对比](images/ubuntu-install-docker-step-8.png)

**步骤 9 链路 B 卡点**：`docker run hello-world` 报 `connection refused`——daemon 直连 `registry-1.docker.io` 被拒。

![docker.io 连接被拒](images/ubuntu-install-docker-step-9.png)

**步骤 10 配镜像加速器**：写 `daemon.json`（daocloud / 1ms.run / xuanyuan 三个互为备份），`daemon-reload` + `restart docker`，`docker info` 确认三个镜像源已生效。

![配置 registry-mirrors 并验证](images/ubuntu-install-docker-step-10.png)

**步骤 11 终验成功**：`docker run hello-world` 拉取成功，输出 `Hello from Docker!`——两条链路全部打通。

![Hello from Docker](images/ubuntu-install-docker-step-11.png)

---

## 第 9 章 延伸：Docker Desktop 官方安装法审查

官方文档（docs.docker.com/desktop/setup/install/linux/ubuntu/）的三步：

```bash
# 1. 配置 Docker 的 apt 仓库（Engine 安装的第一步）
# 2. 手动下载 docker-desktop-amd64.deb
# 3. sudo apt install ./docker-desktop-amd64.deb
```

**审查结论**：

| 观察 | 原理 |
|---|---|
| 第 1 步加仓库 | Desktop 的 deb 有依赖，仓库是**依赖补给站**（角色变了：不再分发本体） |
| `apt install ./deb` 混合模式 | 货物来源本地文件，依赖求解和补货仍走 apt 大脑 |
| postinst 三件套（setcap / 写 hosts / 软链 CLI） | 安装 = 复制文件 + 登记造册 + **运行脚本**的完整实例 |
| 装到 `/opt/docker-desktop` | 自包含软件的标准位置 |
| `systemctl --user` 运行 | Desktop 是用户应用（用户级 systemd 实例），Engine 是系统服务 |
| context 切换 | Desktop 与宿主机 Engine 可共存，CLI 靠 context 选择指向谁 |

**坑**：
1. 许可：250 人以上企业或年营收超 1000 万美元商用需付费订阅——服务器场景基本不成立
2. 升级要每次手动重新下载 deb——本体不在 apt 仓库里，享受不到 `apt upgrade`
3. 前置挑剔：仅 x86-64 + Ubuntu LTS + GNOME 扩展；deb 需从 docker.com 直连下载，境内体验差

**结论**：方法论无懈可击，但选它不选 Engine 的理由只有一个——需要 GUI、内置 K8s 和桌面集成；服务器/命令行场景一律走 Engine 路线。

---

## 附录 A 排错速查表

| 现象 | 定位 | 解法 |
|---|---|---|
| `apt update` 卡在 docker 源 | 链路 A：源地址不通 | 检查 `docker.list` 域名、网络 |
| `GPG error` / `NO_PUBKEY` | 公钥没装或不可读 | 重跑公钥安装两步，确认 `chmod a+r` |
| `404 Not Found`（jammy InRelease） | 仓库代号填错 | 确认 `VERSION_CODENAME` 与系统匹配 |
| `Unable to locate package docker-ce` | 没跑 update 或源没生效 | 安装前先 `sudo apt update` |
| `echo: 未找到命令` | 复制命令带入 `$` 或控制字符 | 检查命令首字符；`cat docker.list` 验证 |
| `docker run` 拉镜像超时 / connection refused | 链路 B：Docker Hub 不可达 | 配置 `daemon.json` 的 registry-mirrors |
| `permission denied`（docker.sock） | 用户组未生效 | `newgrp docker` 或注销重新登录 |
| 拉 `gcr.io` / `ghcr.io` 失败 | 加速器只代理 Docker Hub | 前缀法：`docker pull docker.m.daocloud.io/gcr.io/xxx` 再 `docker tag` 改回 |
| 重启后又进安装界面 | ISO 仍挂在光驱 | CD/DVD 改回物理驱动器或断开 |
| 改 unit 文件 / daemon.json 后不生效 | 配置没重扫 | `daemon-reload` 再 `restart`，顺序不能反 |

## 附录 B 全流程命令速览

见第 7 章「中国境内安装 Docker 完整流程」，可直接整段复制执行。

