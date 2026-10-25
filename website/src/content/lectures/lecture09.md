---
title: 数据卷与持久化
lectureNumber: 9
draft: false
slidevUrl: slides/lecture09
---
# Docker 持久化存储与数据共享

## 目标

- 理解容器的数据特性：可写层随容器销毁而消失（"生产/有状态"的根源）
- **重点难点**：掌握 Docker 的三种数据管理方式——**数据卷 Volume**、**绑定挂载 Bind Mount**、临时存储 tmpfs
- 掌握 `docker volume` 的完整命令（create / ls / inspect / rm）+ 挂载参数 `-v` 与 `--mount`
- 掌握容器间数据共享与**基于数据共享的代码开发调试**（把源码目录挂进容器，改代码免重建）

---

## 第一部分 容器的数据问题（重点）

### 1.1 痛点回顾：一删全没

上一讲末尾埋过一个坑：容器里写的数据（数据库记录、上传的文件、改过的网页）都存在容器的**可写层**里，而可写层**随容器的销毁而消失**：

```bash
docker run -d --name web -p 8080:80 nginx
docker exec -it web bash -c 'echo hello > /usr/share/nginx/html/a.txt'
docker rm -f web                                # 删容器
docker run -d --name web2 -p 8080:80 nginx
curl http://localhost:8080/a.txt                # 404! a.txt 没了
```

这就是"无状态"的代价：**容器用坏就重开很方便，可数据也跟着没了**。而对数据库、文件服务这些**有状态**应用来说，这是不能接受的。

### 1.2 三种解决思路

Docker 提供了三种"把数据请出可写层"的方式，核心是**把宿主机侧的一个存储位置挂载（mount）进容器的某个目录**：

| 方式 | 挂载源 | 特点 | 典型用途 |
|---|---|---|---|
| **数据卷 Volume** | Docker 管理的位置 | 与宿主目录隔离、跨容器共享、命令齐全 | 数据库、需要共享的有状态数据 |
| **绑定挂载 Bind Mount** | 宿主机任意目录 | 直接映射宿主路径、实时同步 | 开发调试、传配置、共享代码 |
| **tmpfs** | 内存 | 不落盘、重启即清空 | 敏感临时数据 |

---

## 第二部分 数据卷（Volume）

### 2.1 什么是数据卷

**Volume** 是 Docker 专门管理的一块存储，独立于任何容器生命存在。你做一个卷，把容器某个目录挂到这个卷上，**容器删除后卷还在**；新建容器再挂上同一个卷，数据就回来了。

### 2.2 docker volume 常用命令

```bash
docker volume create mydata          # 创建数据卷
docker volume ls                     # 列出所有卷
docker volume inspect mydata         # 查看卷细节(挂载点位置在宿主机)
docker volume rm mydata              # 删除卷
docker volume prune                  # 删除未使用的卷
```

### 2.3 挂载数据卷到容器

```bash
# 方式一: -v 卷名:容器内目录   (卷不存在会自动创建)
docker run -d --name web -v webdata:/usr/share/nginx/html nginx

# 方式二: --mount 更清晰(推荐看细节用)
docker run -d --name web \
  --mount source=webdata,target=/usr/share/nginx/html nginx
```

- `-v`（简写）与 `--mount`（结构化）功能同，生产环境更推荐 `--mount`；
- 数据卷的实际存储位置由 Docker 管理（`docker volume inspect` 的 `Mountpoint` 字段，通常在 `/var/lib/docker/volumes/<名>/_data`），**不要手动去翻**。

### 2.4 匿名卷与具名卷

- `-v 卷名:/路径` 是**具名卷**（推荐，能 `volume ls/inspect`）；
- `-v /容器内路径`（不写卷名）会生成一个**匿名卷**，容器删除时匿名卷默认也删掉，适合一次性中间数据。

---

## 第三部分 绑定挂载（Bind Mount）

### 3.1 把宿主机的目录/文件直接挂进去

Bind Mount 把宿主机上的**任意目录或文件**映射到容器内，宿主机和容器**实时双向同步**：

```bash
# 挂载宿主机当前目录到容器的网站根目录
docker run -d --name web -v "$PWD/html":/usr/share/nginx/html nginx
# --mount 写法等价
docker run -d --name web \
  --mount type=bind,source="$PWD/html",target=/usr/share/nginx/html nginx
```

> **注意**：Bind Mount 用的是**绝对路径**（裸目录名会被当成卷）。`$(pwd)` 是开发时的常用招。

### 3.2 典型用途

- **把源码目录挂进容器**：改个文件，容器里立刻可见，开发时不必反复 `docker build`；
- **传配置文件**：把宿主机上的 nginx.conf、redis.conf 挂进容器覆盖默认配置；
- **与宿主共享大文件/日志目录**。

---

## 第四部分 数据共享与代码开发调试（重点、难点）

### 4.1 多容器共享同一个卷

多个容器挂同一个卷，即可共享数据。比如两个 web 容器用同一个卷作根目录，改一份、两个都变：

```bash
docker volume create webdata
docker run -d --name site1 -v webdata:/usr/share/nginx/html -p 8081:80 nginx
docker run -d --name site2 -v webdata:/usr/share/nginx/html -p 8082:80 nginx
docker exec -it site1 bash -c 'echo shared > /usr/share/nginx/html/x.html'
curl http://localhost:8082/x.html       # site2 也能看到 shared!
```

### 4.2 基于数据共享的"热开发"（重点）

**开发调试的最高频场景**：把**完整的源码目录**绑定挂载进容器，挂到程序工作时读取的路径，于是"改代码 → 容器里立即生效"，甚至配合热重载工具自动重启服务，完全不用每次改完都重新构建镜像：

```bash
# 以 Flask 应用为例
docker run -d -p 8000:8000 \
  -v "$PWD/app":/app \
  flask-app python app.py --reload
```

改一个 `.py` 文件 → 刷新页面即生效。**这就是"基于数据共享做开发"**：镜像只提供运行环境，代码通过 bind mount 实时"喂"给容器。

> **对比一下**：构建型工作流（改代码→build→run）适合"交付"，共享型工作流（挂代码→改即生效）适合"开发"。两者都很常用，针对不同阶段。

### 4.3 卷的权限与只读挂载

- 默认可读写；只读挂载可在挂载参数加 `:ro`，防止容器内误改宿主机文件（如配置只读）：

```bash
docker run -d -v "$PWD/conf":/etc/nginx/conf.d:ro nginx
```

---

## 第五部分 数据卷 vs 绑定挂载 怎么选

| 维度 | 数据卷 Volume | 绑定挂载 Bind Mount |
|---|---|---|
| 管理方 | Docker 管理位置 | 宿主上任意路径 |
| 是否可见 | 隐藏在 /var/lib/docker | 就是你指定的目录, 直观可见 |
| 跨容器共享 | ✓ 方便 | ✓ 用同一路径 |
| 持久性 | 独立于容器 | 同样独立于容器 |
| 备份迁移 | 有 volume 命令/拷贝 | 就是普通目录 |
| 适用 | 生产、有状态数据(DB) | **开发调试**、传配置 |

> **决定原则**：拿不准就用 Volume；要做"开发调试、实时改代码、直接看文件"就用 Bind Mount。

---

## 第六部分 实战一：数据卷让数据跨容器存活

**目标**：亲手演示"容器删了、卷还在"，验证 Volume 的持久性。

**第 1 步：创建并挂载卷**

```bash
docker volume create webdata
docker volume ls                       # 看到 webdata
docker volume inspect webdata          # 看它的 Mountpoint
```

**第 2 步：写入数据**

```bash
docker run -d --name site1 -v webdata:/usr/share/nginx/html -p 8081:80 nginx
docker exec -it site1 bash -c 'echo persist > /usr/share/nginx/html/p.txt'
curl http://localhost:8081/p.txt       # 访问到 persist
```

**第 3 步：删容器, 再挂同一卷重建**

```bash
docker rm -f site1
docker run -d --name site2 -v webdata:/usr/share/nginx/html -p 8082:80 nginx
curl http://localhost:8082/p.txt       # persist 还在! 数据被卷留下来
```

**第 4 步：清理**

```bash
docker rm -f site2
docker volume rm webdata
```

---

## 第七部分 实战二：绑定挂载做"热开发"

**目标**：把宿主机源码目录挂进容器，改代码即时生效，体验"基于数据共享的开发调试"。

**第 1 步：准备一个宿主机目录**

```bash
mkdir -p ~/dev/demo
echo '<h1>Demo site</h1>' > ~/dev/demo/index.html
```

**第 2 步：整目录挂载进 nginx 根目录**

```bash
docker run -d --name dev -p 8080:80 \
  -v "$HOME/dev/demo":/usr/share/nginx/html nginx
curl http://localhost:8080/            # 看到 Demo site
```

**第 3 步：改宿主机文件, 容器内立刻可见（不必重建）**

```bash
echo '<h1>Updated!</h1>' > ~/dev/demo/index.html
curl http://localhost:8080/            # 立刻变成 Updated! —— 无 build
docker exec -it dev cat /usr/share/nginx/html/index.html   # 容器内同步
```

> 这就是最经典的"代码共享开发"：镜像只装环境，代码实时挂进容器，改完即生效。

**第 4 步：只读挂载再演示**

```bash
docker run -d --name dev2 -p 8081:80 -v "$HOME/dev/demo":/usr/share/nginx/html:ro nginx
docker exec -it dev2 bash -c 'echo x > /usr/share/nginx/html/index.html'  # 报错只读
```

---

## 第八部分 总结

| 方面 | 要点 |
|---|---|
| 数据痛点 | 可写层**随容器销毁而消失** → 有状态应用需持久化 |
| 三种方式 | Volume（Docker管）/ Bind Mount（宿主任意路径）/ tmpfs（内存） |
| 数据卷命令 | `create / ls / inspect / rm / prune` + `-v 卷:路径` 或 `--mount` |
| 绑定挂载 | `-v /绝对路径:/容器路径` 或 `--mount type=bind,...`；实时双向同步 |
| 共享 | 多容器挂同一卷/同一路径即可共享数据 |
| 热开发 | 挂源码目录 → 改代码即时生效, 免反复 build (配 :ro 可保宿主机文件只读) |
| 选型 | 拿不准用 Volume; 开发调试/直改代码用 Bind Mount |

> **一句话点透**：容器的"易销毁"是优点也是坑——把数据挂到容器外面（卷/宿主目录），就能既享受"用坏重开"的便利、又不丢数据。这与你数据库、文件服务的持久化是同一件事。

## 下一步

下一讲开始**部署编程语言**（C/C++、Java）：用 Dockerfile 把程序源码连同运行环境打包成镜像，再像前面一样 build → run。设计良好的 Dockerfile 是本讲"镜像=只读模板 + 可写数据层"的集中体现。