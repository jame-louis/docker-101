---
title: 镜像仓库
lectureNumber: 6
draft: false
---

# 镜像仓库（Registry）

## 目标

- 理解仓库（Registry）与仓储（Repository）、镜像名、镜像全名之间的关系
- 掌握 `docker login`、`docker pull`、`docker push`、`docker search`、`docker tag`
- 掌握公共仓库 Docker Hub 的完整推送/拉取流程
- **重点**：掌握用 `registry` 镜像搭建**本地私有仓库**，理解私有化分发的思路

---

## 第一部分 什么是镜像仓库（重点）

### 1.1 Registry 与 Repository 的关系

这两个词常被混用，其实是两码事，必须分清：

| 概念 | 中文 | 作用 | 类比 |
|---|---|---|---|
| **Registry** | 镜像仓库/注册中心 | 存放并分发镜像的**服务器/服务** | 应用商店平台 |
| **Repository** | 仓储/命名空间项目 | Registry 里按名称组织的一个镜像集合 | 商店里的一个 App |

```
Registry（一台服务器）
├── repository: python      ← 一个项目，有很多 tag
├── repository: nginx
│     ├── nginx:latest
│     ├── nginx:1.25
│     └── nginx:1.26
├── repository: alpine
└── repository: 你的镜像名
```

- **Docker Hub** 是最著名的公共 Registry；
- 同一个 Registry 里可以有很多 Repository，每个 Repository 下又有多个 Tag。

### 1.2 镜像的完整名称格式

在上一讲基础上，把 Registry 地址一并写全，镜像名其实是这样的：

```
[镜像仓库地址]/[命名空间]/[镜像名]:[标签]

registry / owner / repo : tag

例如：docker.io/library/python:3.12-slim
```

| 组成部分 | 是否可省略 | 省略时默认 |
|---|---|---|
| Registry 地址 | 是 | `docker.io`（Docker Hub） |
| 命名空间（owner） | 是 | `library`（官方镜像空间） |
| 标签（tag） | 是 | `latest` |

所以：

```bash
docker pull python:3.12-slim
# 等价于
docker pull docker.io/library/python:3.12-slim
```

> **一句话分辨**：`docker pull` 的一半工作就是在"拼这个全名、找对仓库服务器去拿镜像"。

### 1.3 为什么需要仓库

| 需求 | 仓库如何满足 |
|---|---|
| 分发 | 不同机器、不同团队都能从同一处拉取同一份镜像 |
| 备份 | 镜像集中托管，不易丢失 |
| 团队协作 | 推送即共享，无需线下拷贝镜像文件 |
| 版本管理 | 用 tag 管理版本，用 namespace 区分归属 |
| 私有化 | 企业自建仓库，镜像不出内网 |

### 1.4 公共仓库 vs 私有仓库

| 维度 | Docker Hub（公共） | 私有仓库 |
|---|---|---|
| 访问 | 公开，任何设备可拉取 | 需要认证/已在可信网络 |
| 成本 | 公共镜像免费；私有仓库有配额限制 | 由自己掌控，无配额顾虑 |
| 安全 | 公开仓库有被污染风险 | 可完全自控，适合企业内网 |
| 常见实现 | Docker Hub | Harbor、Nexus、GitLab Registry、阿里云 ACR，以及本讲要做的本地 `registry` |

---

## 第二部分 Docker Hub 与登录

### 2.1 注册与登录

Docker Hub 是 Docker 官方的公共镜像仓库，网址 https://hub.docker.com ，注册账号后即可推送自己的镜像。

```bash
docker login              # 交互式输入 用户名/密码
docker logout             # 退出登录
```

- 登录成功后，凭证会保存在 `~/.docker/config.json`；
- `docker push` 到 Docker Hub 之前必须 `docker login`；`docker pull` **公共镜像**则不需要登录。

### 2.2 docker search —— 在仓库搜索镜像

```bash
docker search nginx                # 搜索官方镜像
docker search --filter=stars=100 alpine   # 按 Star 数过滤
docker search --limit 10 mysql     # 限定返回数量
```

- 直接查询 Docker Hub；返回结果含镜像名、描述、Star 数、**官方（OFFICIAL）**标识；
- 给出本机没有的镜像也能搜出来，方便发现他人共享的镜像。

### 2.3 推送的身份问题

推送镜像到 Docker Hub 时，**镜像名里的命名空间必须是你自己的用户名**（或属于你的组织），否则 docker push 会被拒绝：

```bash
docker push myname/myimg:1.0     # ✅ 命名空间是你自己的账号
docker push ubuntu:1.0           # ❌ 无权推送到 library/ubuntu
```

---

## 第三部分 Docker Hub 推送 / 拉取完整流程（重点）

### 3.1 进入你的项目目录并登录

```bash
docker login
```

### 3.2 构建（或已有）一个镜像，并打上你的命名空间标签

以 Flask 应用为例（构建方法见 Dockerfile 讲）：

```bash
docker build -t flask-demo:1.0 .            # 先本地构建
docker tag flask-demo:1.0 jamelouis/flask-demo:1.0   # 加上自己的用户名
```

> `docker tag` 不会复制数据，只是给同一镜像 ID 增加一个带命名空间的**别名**，让推送目标合法。

### 3.3 推送

```bash
docker push jamelouis/flask-demo:1.0
```

输出示例（分层推送 + 摘要）：

```
Using default tag: latest
The push refers to repository [docker.io/jamelouis/flask-demo]
2f3d...: Pushed
4a1c...: Pushed
latest: digest: sha256:... size: 1243
```

- 按**层**逐一上传，已存在（别人共享）的层可以跳过，体现分层的复用；
- 推送成功后，任何机器执行 `docker pull jamelouis/flask-demo:1.0` 都能拿到它。

### 3.4 在另一台机器/全新环境拉取并运行

```bash
docker pull jamelouis/flask-demo:1.0
docker run -d -p 5000:5000 jamelouis/flask-demo:1.0
```

> 至此形成完整闭环：**构建 → tag → login → push →（异地）pull → run**。

---

## 第四部分 本地私有仓库（Local Registry）（重点）

除了 Docker Hub，自己也能起一个仓库。Docker 官方提供了 `registry` 镜像，一条命令就能在本机搭一个**私有仓库**，非常适合：镜像不出内网、用于教学实验、离线环境。

### 4.1 为什么需要本地/私有仓库

| 场景 | 理由 |
|---|---|
| 教学实验 | 不上公网也能 push / pull，彻底打通仓库流程 |
| 内网/离线 | 公网拉不到，用本地仓库分发 |
| 代码绝密 | 镜像含私有代码/配置，不能推到公网 |
| 快速迭代 | 本地 push/pull 无网络开销 |

### 4.2 用 registry 镜像启动本地仓库

```bash
docker pull registry:2                # 拉取官方本地仓库镜像
docker run -d --name myregistry -p 5000:5000 registry:2
```

- 容器名 `myregistry`，把容器内 5000 端口映射到宿主机 5000；
- 这样一个**本地仓库服务器**就跑起来了，校验：

```bash
docker ps
curl http://localhost:5000/v2/        # 返回 {} 说明仓库服务正常
```

### 4.3 推送到本地仓库

本地仓库的地址就是本机，所以镜像名里的 "registry 地址" 部分要写成 `localhost:5000`：

```bash
docker tag flask-demo:1.0 localhost:5000/flask-demo:1.0   # 命名空间可任取
docker push localhost:5000/flask-demo:1.0
```

> 关键点：**只要把镜像名前缀改成 `localhost:5000/`，push 就会打到本地仓库而不是 Docker Hub**。这就是 Registry 全名里"仓库地址"字段的意义所在。

### 4.4 从本地仓库拉取

```bash
docker rmi localhost:5000/flask-demo:1.0
docker pull localhost:5000/flask-demo:1.0
```

### 4.5 本地仓库数据的持久化

容器型的 registry 默认把镜像数据存在自己的可写层里，**容器删除数据即丢失**。要持久化，挂一个数据卷：

```bash
docker run -d --name myregistry -p 5000:5000 \
  -v /opt/registry:/var/lib/registry \
  registry:2
```

> `/var/lib/registry` 是 registry 容器内部存放镜像数据的目录，把它挂到宿主机 `/opt/registry`，删容器再启也不会丢数据。

### 4.6 关于 HTTPS/信任的提示（了解即可）

Docker 默认要求镜像仓库走 HTTPS。本地 `localhost:5000` 被 Docker 特殊放行（视为可信），可直接用；如果需要局域网内的**其他主机**访问这台本地仓库，通常需要在客户端把该主机地址加入"非安全仓库"（`insecure-registries`）白名单：

```json
// 所有客户端节点 /etc/docker/daemon.json
{ "insecure-registries": ["192.168.1.10:5000"] }
```

> 这属于排查进阶内容，本讲先用 `localhost` 教学即可；真正生产环境建议使用 Harbor 并提供 HTTPS。

---

## 第五部分 仓库相关命令速查

| 命令 | 作用 |
|---|---|
| `docker login` / `docker logout` | 登录 / 退出镜像仓库 |
| `docker pull <全名>` | 从仓库拉取镜像（默认 Docker Hub） |
| `docker push <全名>` | 推送到仓库 |
| `docker search <关键词>` | 在仓库搜索镜像 |
| `docker tag <原名> <新名>` | 增加别名/命名空间，为推送做准备 |
| `docker rmi` | 删除本地镜像 |
| `curl http://host:5000/v2/_catalog` | 列出 registry 中的镜像列表（本地仓库调试） |


---

## 第八部分 总结

| 方面 | 要点 |
|---|---|
| 仓库角色 | Registry 是"存放并分发镜像的服务器"，Repository 是里面按项目命名的一个镜像集合，两者别混 |
| 镜像全名 | `[仓库地址]/[命名空间]/[镜像名]:[标签]`，省略地址默认 `docker.io`，省略空间默认 `library`，省略标签默认 `latest` |
| Docker Hub | 默认公共仓库；`push` 需要 `login`，且命名空间必须是自己的用户名；`pull` 公共镜像无需登录 |
| 完整流程 | `构建 → tag(加用户名) → login → push →（异地）pull → run` |
| 本地仓库 | 用 `registry:2` 一行起飞；镜像名加 `localhost:5000/` 前缀即推本地；挂 `/var/lib/registry` 持久化数据；局域网访问需配 `insecure-registries` |
| 命令 | `login/logout`、`pull`、`push`、`search`、`tag`、`rmi`，`/v2/_catalog` 列本地镜像 |
| 下一步 | 卷、网络、Compose 编排，把多个镜像容器编排成一套应用 |

> 一句话串起三讲：**镜像（04）= 图纸/模板，容器（05）= 运行实例，仓库（本讲）= 存放和分发图纸的"图书馆"**。有了仓库，镜像才能跨机器、跨团队地流转起来。