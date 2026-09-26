---
title: 镜像
lectureNumber: 4
draft: false
---

# 镜像

## 目标

- 理解镜像、镜像分层、镜像仓库与标签等核心概念
- 掌握常用镜像命令：`pull`、`images`、`push`、`rmi`、`tag`、`history`、`inspect`、`save`/`load`
- 能拉取、管理镜像，并亲手构建一个属于自己的镜像
- 建立"镜像和容器是两个不同的东西"的直觉

---

## 第一部分 什么是镜像（重点）

### 1.1 镜像的定义

**镜像（Image）** 是一个**只读包（read-only package）**，包含了运行一个应用所需的全部内容。这里"只读"是关键词——一旦创建，镜像本身就不允许再被修改。

一个镜像包含的内容：

| 内容 | 说明 |
|---|---|
| 应用程序 | 你的代码、脚本、二进制程序 |
| 应用依赖 | 依赖库、运行时（如 Python、Node）、配置文件 |
| 操作系统构造的最小集合 | busybox、库文件等运行所需组件 |
| 元数据 | 端口、环境变量、默认启动命令等描述信息 |

> 一句话：**镜像 = 把"能跑应用的那台环境"打包成一个静态文件。**

### 1.2 镜像通常很小

很多初学者以为"镜像 = 一台操作系统"，其实两者差别巨大。以官方的 **Alpine Linux** 镜像为例，它只有约 **7MB**：

- **没有提供 shell**（准确说是没有完整的多用户 shell 环境，Slim 变体往往不带）；
- **没有包管理器**（Alpine 用 `apk`，但很多精简镜像不带它）；
- **不包含内核**，容器与宿主机**共享同一个内核**；
- 相比之下，Windows 镜像的工作方式不同，会大得多（动辄 GB 级）。

正是因为"没有内核 + 只保留必要组件"，镜像才能做到几十 MB 甚至几 MB。这个特征会在第三部分"分层"和后续 Dockerfile 章节中反复用到。

### 1.3 镜像与容器（必须分清的概念）

初学最容易混淆的就是"镜像"和"容器"。两者关系可以类比程序与进程、类与对象：

| 对比维度 | 镜像（Image） | 容器（Container） |
|---|---|---|
| 时机 | **构建时**的构造（build-time） | **运行时**的构造（run-time） |
| 本质 | 只读的静态模板 | 镜像启动出来的、可运行/可写的实例 |
| 生命周期 | 持久存在，不随使用结束 | 动态，可启动、停止、销毁 |
| 可变性 | 只读，不可改 | 可写，能读、写、执行、挂载卷 |
| 对应关系 | 一个镜像可以启动**一个或多个**容器 | 每个容器是镜像的一个独立运行实例 |

```
  镜像 Image（只读模板）
      │
      ├──> 启动容器 A
      ├──> 启动容器 B
      └──> 启动容器 C   （同一个镜像，N 个彼此独立的容器）
```

**xi记忆口诀**：镜像类是**图纸**，容器是照图纸**盖出来的房子**。改图纸（镜像是只读的，需重建），不会影响已盖好的房子；一个图纸能盖很多栋房子。

---

## 第二部分 镜像名与标签

### 2.1 为什么需要名字和标签

镜像成千上万，我们需要一套命名规则来：

- **区分不同的项目/应用**（用镜像名）；
- **区分同一个项目/应用的不同版本**（用标签）。

统一的格式是：

```
image_name:tag_name      # 镜像名:标签
```

示例：

| 写法 | 含义 |
|---|---|
| `ubuntu:latest` | Ubuntu 镜像的 latest（默认/latest 标识最新） |
| `ubuntu:v1` | Ubuntu 镜像的第 1 个版本 |
| `ubuntu:v2` | Ubuntu 镜像的第 2 个版本 |
| `python:3.12-slim` | Python 3.12 的精简版 |

几点注意：

- **标签是可选的**：不写时自动用 `latest`。但"latest 永远最新"是个误解，它只是一个标签名，不代表最新版本；
- **同一镜像名可挂不同标签**：`ubuntu:v1` 和 `ubuntu:v2` 其实是同一份底层数据的两块"铭牌"；
- `tag` 命令用来给已有镜像加标签（见 4.5）。

### 2.2 镜像仓库（Registry）与 Docker Hub

镜像被存放在叫 **镜像仓库（Registry）** 的服务上，作用类似"App Store"或"代码托管平台"。

| 概念 | 说明 |
|---|---|
| Registry（仓库） | 存放和分发镜像的服务端 |
| Repository（仓储/名空间） | Registry 里按项目名称组织的镜像集合，例如 `alpine`、`python` |
| Docker Hub | Docker 官方公共仓库，最大的镜像仓库，网址 https://hub.docker.com |

拉取/推送镜像的完整名称格式其实是：

```
[registry/]repository[:tag]
registry/hub.docker.com/python:3.12-slim
```

- **省略 registry** 时，默认从 Docker Hub 拉取；
- 常见写法 `docker pull python:3.12-slim` 省略了 `registry.hub.docker.com/library/` 前缀。

> 企业中通常会搭建**私有仓库**（如 Harbor、Nexus、阿里云容器镜像服务），把镜像存在内网，分发更快也更安全。

---

## 第三部分 镜像的本质：分层（Layer）

### 3.1 分层结构

镜像不是一团"糊在一起"的文件，而是由**一组松耦合的只读层（layer）堆叠**而成，每一层包含一个或多个文件。

```
┌─────────────────────────┐  ← 最上层（新层的元数据）
│         layer 4         │
├─────────────────────────┤
│         layer 3         │
├─────────────────────────┤
│         layer 2         │
├─────────────────────────┤
│         layer 1 (base)  │  ← 最底层，如 alpine 基础镜像
└─────────────────────────┘
```

- 层是从基础镜像一层层"叠"出来的，最底层通常是基础镜像；
- **层是只读的**，构建完成后堆叠在一起形成完整的镜像；
- 后面讲到的 `docker history`、`docker build` 中的 `RUN`/`COPY` 都是在说"加一层"。

### 3.2 层是可以共享的

**多个镜像之间可以、并且确实会共享层。**

因为每一层是独立的、只读的、可复用的，所以：

- 如果你的镜像基于 `alpine`，那么 **alpine 的那几层** 对所有基于它的镜像都是共用的；
- 磁盘上只存一份，多个镜像的显示大小趋向于"各自独占的那部分 + 共享的底层"；
- 拉取时也会命中已存在的层，快速完成。

```
alpine (base) 所带的层 —— 被镜像 A、B、C 共享
┌─────────────┐
│  shared     │ ◄── 镜像 A 使用
│  layers     │ ◄── 镜像 B 使用
│             │ ◄── 镜像 C 使用
└─────────────┘
```

### 3.3 为什么分层这么重要

| 好处 | 说明 |
|---|---|
| 省磁盘 | 共享层只在磁盘存一次，避免每个镜像都完整复制 |
| 省带宽 | 下载新镜像时只拉取未命中的层 |
| 加速构建 | Docker 构建时复用未变化的层（缓存机制），大幅变快 |
| 便于分发 | 只需传差异层，而非整个镜像 |

> 这也为下一讲"优化 Dockerfile"埋下伏笔：**尽量把容易变化的文件放在靠后的层，把稳定不变的内容放在靠前的层**，让缓存尽量命中。

### 3.4 进阶：容器层的"写时复制"

容器之所以能对"只读镜像"进行写入，靠的是在其上叠加的一层**可写容器层**（Copy-on-Write，COW）：

- 启动容器时，Docker 在只读镜像层之上加一个**可写层**；
- 容器内读文件 → 读取镜像底层的只读副本；
- 容器内写/改文件 → 先把该文件**复制**到容器层，再写入（所以叫"写时复制"）；
- 容器删除后，可写层一并销毁，**底层镜像不受任何影响**。

这样既保证了镜像的只读性，又让多个容器彼此隔离、底层共享。

---

## 第四部分 常用镜像命令（重点）

### 4.1 docker pull —— 拉取镜像

```bash
docker pull ubuntu:latest         # 从仓库（默认 Docker Hub）拉取 ubuntu 最新标签
docker pull alpine:3.20           # 指定具体版本
```

- 从注册的仓库中下载镜像到本机；
- 频繁使用，但**不是必需**——`docker run` 时若本机没有，会自动先 `pull`。

### 4.2 docker images / docker image ls —— 查看本机镜像

```bash
docker images
docker image ls                  # 等价写法
```

输出示例：

```
REPOSITORY   TAG       IMAGE ID        CREATED         SIZE
alpine       latest    a24bb4013296    3 weeks ago     7.38MB
ubuntu       latest    ba6acccedd29    4 weeks ago     77.8MB
hello-world  latest    fe4c16cbf7a4    5 weeks ago     13.3KB
```

| 列 | 含义 |
|---|---|
| REPOSITORY | 镜像名（所在项目） |
| TAG | 标签（版本） |
| IMAGE ID | 镜像唯一 ID（通常是短 ID） |
| SIZE | 本机占用的近似大小 |

### 4.3 docker push —— 推送镜像到仓库

```bash
docker push <用户名>/<镜像名>:<标签>
```

- 把本地镜像上传到仓库，供他人拉取或异地部置；
- 推送到 Docker Hub 通常**需要先把镜像 `tag` 成自己的用户名**，并先用 `docker login` 登录。

### 4.4 docker rmi / docker image rm —— 删除镜像

```bash
docker rmi <镜像名>:<标签>       # 按名字删
docker rmi <镜像ID>              # 按 ID 删
docker image rm <镜像名>         # 等价

docker rmi $(docker images -q)   # 危险：删除所有本地镜像
```

- 只能删除**没有被任何容器使用**的镜像；若某容器（即使已停止）引用它，会报错，需先删除该容器。

### 4.5 docker tag —— 给镜像加标签（改名/版本）

```bash
docker tag <原镜像> <新名字>:<新标签>
docker tag flask-demo:1.0 myrepo/flask-demo:1.0
```

- 本质是给同一个镜像 ID 增加一个**引用/别名**，不复制任何数据；
- 常用于：为发布版本命名、为推送到仓库改名、区分环境（dev/staging/prod）。

### 4.6 docker history / docker inspect —— 查看镜像内部

```bash
docker history alpine           # 查看镜像由哪些层构成（构建历史）
docker inspect alpine           # 查看镜像的详细元数据（JSON）
```

- `history` 展示一列镜像层与每条指令，直观体现"分层"；
- `inspect` 返回完整 JSON，含标签、架构、暴漏端口、环境变量等；常配合 `--format` 过滤字段。

### 4.7 docker save / docker load —— 离线传输镜像

```bash
docker save -o myimage.tar flask-demo:1.0   # 把镜像导出为单个 tar 文件
docker load -i myimage.tar                  # 从 tar 文件导入镜像
```

- 用于**离线分发 / 备份**：把镜像打成文件，拷到无网络环境再 `load` 恢复；
- 与 `docker export/import`（容器层快照）不同，`save/load` 保留镜像的分层结构和层，语义更完整。

### 4.8 docker commit —— 从容器创建镜像（了解即可）

```bash
docker commit <容器ID> <新镜像名>:<标签>
docker commit web1 my-web:v1
```

- 把**某个容器的当前可写层**打包成新镜像；
- 适合快速"快照"，但**不被推荐为构建镜像的正常方式**（可读性、可复现性差），正式的项目都用 Dockerfile 构建。本讲实践二会用它体验镜像的"从无到有"。

### 4.9 其他相关命令

| 命令 | 作用 |
|---|---|
| `docker search <关键词>` | 在 Docker Hub 搜索公共镜像 |
| `docker build -t myapp:1.0 .` | 用 Dockerfile 构建镜像（`-t` 指定名字和标签，`.` 为构建上下文/项目根目录） |
| `docker inspect/history` | 查看镜像元数据/层历史（见 4.6） |
| `docker save/load` | 离线导出/导入镜像（见 4.7） |
| `docker buildx` | 高级多平台构建（多架构镜像）工具 |
| `docker system prune` | 清理无用的镜像、容器、网络、缓存 |

> `docker pull`、`docker images`、`docker push`、`docker rmi` 是**四大核心命令**，务必熟练；`commit/inspect/history/save/load/buildx` 按需掌握。


---

## 第七部分 总结

| 方面 | 要点 |
|---|---|
| 镜像本质 | 只读包，包含应用、依赖、最小化 OS 构造和元数据；**不含内核**，与宿主机共享内核，因此通常很小（Alpine 约 7MB） |
| 镜像 vs 容器 | 镜像是**构建时**的只读模板，容器是**运行时**的可写实例；一个镜像可启动多个容器 |
| 命名 | 格式 `image_name:tag`；标签默认 `latest`；仓库（Registry）存放分发镜像，默认 Docker Hub |
| 分层 | 镜像由多层只读层堆叠而成，层可跨镜像**共享**，省磁盘/带宽并加速构建；容器的可写层靠**写时复制** |
| 常用命令 | `pull/images(ls)/push/rmi` 为核心；`tag/history/inspect/save/load/commit` 按需掌握 |
| 作业 | 随堂作业 HW03：pull + run + history + inspect 体会分层；commit + tag + save + rmi + load 走通镜像生命周期 |
| 下一步 | 从"有图"到"画图"：用 Dockerfile 自动化、可复现地构建镜像（见下讲） |