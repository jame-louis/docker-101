---
title: 容器
lectureNumber: 5
draft: false
---

# 容器

## 目标

- 理解容器是什么，以及它与镜像、虚拟机、宿主机进程的关系
- 掌握容器生命周期管理：`run`、`ps`、`stop`、`start`、`restart`、`rm`
- 掌握进入容器、查日志、查进程等常用操作：`exec`、`logs`、`top`、`stats`、`inspect`
- 理解前台/后台运行、端口映射、数据挂载等关键概念
- 能对照镜像完整走通"镜像 → 容器"的全流程

---

## 第一部分 什么是容器（重点）

### 1.1 容器的定义

**容器（Container）** 是**镜像的运行实例**：想象上一讲说的"图纸"变成了"房子"。它是真正在宿主机上以进程形式存在、可读可写、有自己独立运行环境的东西。

| 维度 | 镜像（Image） | 容器（Container） |
|---|---|---|
| 时机 | 构建时构造 | 运行时构造 |
| 本质 | 只读模板 | 模板的可运行实例 |
| 可写性 | 只读、不可改 | 可读可写、能执行、能挂载卷 |
| 生命周期 | 持久 | 可启动、可停止、可销毁 |

> 一个镜像是"图纸 + 环境样板"，容器就是**每一间照图纸盖出的、真正能住人的房子**。盖坏了拆掉重建，图纸（镜像）不受影响。

### 1.2 容器 vs 虚拟机（为什么容器"轻"）

这是初学者最容易混淆的地方。两者都是"隔离的运行环境"，但机制完全不同：

| 对比项 | 虚拟机（VM） | 容器（Container） |
|---|---|---|
| 隔离级别 | **硬件级**虚拟化 | **内核级**隔离（操作系统级） |
| 是否自带内核 | 每个 VM 带完整 Guest OS + 内核 | **没有内核**，共享宿主机内核 |
| 体积 | 以 GB 计 | 以 MB 计 |
| 启动速度 | 分钟级 | **秒级** |
| 资源占用 | 巨大（CPU/内存独占） | 极小，就是一个（几个）进程 |
| 隔离强度 | 极强（可跑不同内核/系统） | 较弱（共享同一内核），但通常够用 |

```
虚拟机：                        容器：
┌───────────────────┐         ┌────────────────────┐
│ VM 1 (Guest OS+内核) │         │ 容器1  ·  容器2  ·  容器3 │
│ VM 2 (Guest OS+内核) │         └─────────┬──────────┘
│ VM 3 (Guest OS+内核) │                   │ 共享
└───────────────────┘         ┌───────────┴─────────┐
        各带一个内核（重）            │ 宿主机一个内核（轻）│
```

**入门认真记**：容器里跑的**不是一台"小操作系统"**，而是宿主机上一个**被隔离的普通进程**。它靠 Linux 内核的 **namespace（命名空间）** 隔离资源视图、用 **cgroups（控制组）** 限制资源用量。所以我们常听到"**容器就是进程**"这句话。

### 1.3 容器为什么能"像一台小机器"

通过 namespace 隔离，容器内的进程只能"看得到"自己那一份资源视图，从而表现得像一台独立小机器：

| namespace | 隔离了什么 |
|---|---|
| PID | 进程号（容器内看到从 1 开始，看不到宿主其他进程） |
| Mount | 文件系统挂载点 |
| Network | 网络栈（独立网卡、IP、端口） |
| UTS | 主机名 |
| IPC | 进程间通信 |
| User | 用户和 UID |

> 这也是为什么容器内 `ps` 只看到自己的进程、`hostname` 显示的是容器 ID、`ifconfig` 看到的是自己的虚拟网卡——**不是真的独立系统，是"看起来独立"**。

### 1.4 容器的三个典型特征

1. **可写**：镜像只读，但每个容器在只读层之上有一层**可写容器层**（写时复制），容器内的改动写在这一层；
2. **隔离**：容器之间、容器与宿主机之间默认相互隔离，互不干扰；
3. **易销毁**：容器是廉价的、一次性的，用坏了删掉重建即可，远比虚拟机方便。

---

## 第二部分 容器生命周期管理（重点）

### 2.1 docker run —— 创建并启动容器

```bash
docker run [参数] <镜像> [命令]
docker run hello-world
docker run -it --name ubuntu1 ubuntu:22.04 /bin/bash   # 交互式进入容器
docker run -d --name web1 -p 8080:80 nginx             # 后台运行并映射端口
```

`run` 是最核心的命令，内部等价于三层动作：**`create`（创建）→ `start`（启动）→ 附加运行**。

| 常用参数 | 作用 |
|---|---|
| `-i` | 保持标准输入打开（配合 `-t` 用） |
| `-t` | 分配一个伪终端（TTY），可输入命令 |
| `-d` | 后台运行（detached），返回容器 ID 后终端可继续用 |
| `--name` | 给容器起名字（不指定则随机生成） |
| `-p 主机:容器` | 端口映射，把容器端口暴露到宿主机 |
| `-v` / `--mount` | 挂载数据卷或宿主机目录 |
| `--rm` | 容器退出后自动删除（适合一次性任务） |
| `--restart` | 设置容器重启策略 |

### 2.2 docker ps —— 查看容器

```bash
docker ps                 # 只看运行中的容器
docker ps -a              # 看所有容器（含已停止的）
docker ps -q              # 只打印容器 ID
```

| 常用参数 | 作用 |
|---|---|
| `-a` | 列出所有容器（默认只显示运行中的） |
| `-q` | 只输出容器 ID（常用于批量操作） |
| `--filter` | 按条件过滤，如 `--filter status=exited` |

输出示例：

```
CONTAINER ID   IMAGE       COMMAND       STATUS       PORTS                  NAMES
3a2c4d5e6f7    nginx       "nginx -g…"   Up 2 minutes 0.0.0.0:8080->80/tcp    web1
```

### 2.3 停止 / 启动 / 重启

```bash
docker stop <容器>       # 优雅停止（先发 SIGTERM，等待后 SIGKILL）
docker start <容器>      # 启动一个已停止的容器
docker restart <容器>    # 重启
```

> `<容器>` 可以是容器 ID 或容器名。`stop` 和 `kill` 的区别：`stop` 先给进程优雅终止信号，给时间保存状态；`kill` 直接 `SIGKILL` 强杀。

### 2.4 删除容器

```bash
docker rm <容器>                # 删除已停止的容器
docker rm -f <容器>             # 强制删除（即使正在运行）
docker rm $(docker ps -aq)      # 删除所有容器
```

> `rm` 删除的是容器（运行实例），**不影响镜像**。删除前若容器还在运行需加 `-f`，或先 `stop`。

### 2.5 生命周期全景图

```
docker create ──> 已创建(Created)
       │
       v
  docker start ──> 运行中(Running) ──docker stop/ kill──> 已停止(Exited)
       ^                                    │
       └───────────── docker restart ───────┘
                          │
                          v
                 docker rm ──> 彻底删除(Gone)
```

**常用状态**：`Created`（已创建未启动）→ `Up` / `Running`（运行中）→ `Exited`（已停止）→ `Removed`（已删除）。`docker ps -a` 的 STATUS 列直观反映这些状态。

---

## 第三部分 容器常用操作

### 3.1 docker logs —— 查看容器日志

```bash
docker logs <容器>            # 查看容器输出
docker logs -f <容器>         # 持续跟踪（Ctrl+C 退出）
docker logs --tail 50 <容器>  # 只看最后 50 行
```

> 适用于**后台运行（`-d`）**的容器——它们的 stdout/stderr 被 Docker 捕获，可用 `logs` 随时查看。

### 3.2 docker exec —— 进入正在运行的容器

```bash
docker exec -it <容器> /bin/bash    # 进入容器并打开 shell
docker exec <容器> ls /              # 在容器内执行单条命令后退出
```

> `exec` 在**正在运行的容器**内部执行命令，不重启容器。常用 `-it` 拿到交互式 shell。注意它和 `docker attach` 的区别：`attach` 是"附加到主进程"，`exec` 是"另起一个进程"（推荐）。

### 3.3 docker top / docker stats —— 看进程与资源

```bash
docker top <容器>            # 查看容器内运行的进程
docker stats                 # 实时查看所有容器 CPU/内存/网络/IO
```

### 3.4 docker inspect —— 查看容器元数据

```bash
docker inspect <容器>                         # 输出容器全部配置（JSON）
docker inspect -f '{{.State.Status}}' <容器>   # 用模板只取某字段
```

### 3.5 再谈 port 映射与卷挂载

**端口映射**：容器内部有自己独立网络栈，宿主机不能直接访问其端口，靠 `-p` 建立桥接。

```bash
docker run -d -p 8080:80 nginx
#       宿主机8080 → 容器80
```

**数据卷挂载**：容器可写层在容器删除后会丢失，想持久化数据需要用卷（Volume）或把宿主机目录挂进来。

```bash
docker run -d --name db -v /宿主机路径:/容器路径 mysql
docker volume ls
docker volume inspect <卷名>
```

> 卷挂载将在后续章节专讲，这里先知道"容器数据默认不持久、可用卷解决"即可。

---

## 第四部分 完整实例：nginx 容器全流程

在进入动手实践前，先用一个真实镜像串起上面的核心命令：

```bash
# 1. 运行一个后台 nginx 容器，映射 8080→80
docker run -d --name myweb -p 8080:80 nginx

# 2. 查看运行状态
docker ps

# 3. 查看日志
docker logs myweb

# 4. 访问测试（应返回 Welcome to nginx! 页面）
curl http://localhost:8080

# 5. 进入容器看看它长什么样
docker exec -it myweb /bin/bash
   ls /usr/share/nginx/html       # 容器内的网页文件
   cat /etc/os-release            # 确认容器里的系统
   exit

# 6. 停止、删除
docker stop myweb
docker rm myweb
docker ps -a                      # 确认已删除
```


---

## 第七部分 总结

| 方面 | 要点 |
|---|---|
| 容器本质 | 镜像的**运行实例**，本质是宿主机上一个被隔离的进程；靠 namespace 隔离、cgroups 限资源，**无内核、与宿主机共享内核**，因此比虚拟机轻得多 |
| 镜像 vs 容器 | 镜像只读模板（构造时），容器可写实例（运行时）；一个镜像可启动多个互不干扰的容器 |
| 生命周期 | `create → start → stop/start → rm`；配套 `restart`、`ps -a` 查看各状态 |
| 核心命令 | `run(-it/-d/-p/--name/--rm)`、`ps(-a)`、`stop/start/restart`、`rm`；辅以 `logs/exec/top/stats/inspect` |
| 关键概念 | `-d` 后台 + `logs` 看日志；`exec -it` 进入运行容器；`-p 主机:容器` 端口映射；**容器数据不持久，用卷卷化** |
| 总结 | HW04：实战一串起容器全生命周期；实践二体会"隔离"与"数据不持久"两大特性，并引入数据卷 |
| 下一步 | 卷（Volume）、网络（Network）、自定义网络与 Compose 编排 |

> 与上一讲对照记忆：**镜像（lecture04）= 图纸/模板，容器（本讲）= 照图纸盖出的、能跑能改、用坏即拆的房子。** 理解了"镜像是构建时的、容器是运行时的"这一组对称概念，后面的卷、网络、编排都水到渠成。