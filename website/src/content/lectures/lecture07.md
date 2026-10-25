---
title: 容器网络原理
lectureNumber: 7
draft: false
slidevUrl: slides/lecture07
---

# Docker 网络实现（理论）

## 目标

- 理解"容器有独立网络栈"的本质：网络隔离由 namespace 提供，容器看自己像一台独立主机
- 掌握 Docker 的四种网络模式：`bridge`、`host`、`none`、`container`，会选、会取舍
- 理解默认 `bridge` 网络的结构：`docker0` 桥 + `veth` 对 + iptables NAT 端口映射
- **重点**：掌握 `docker network create` 的常用参数（`--driver`、`--subnet`、`--ip-range`、`--gateway`）
- **难点**：理解网络配置细节——指定 IP、自定义网络的内嵌 DNS、容器接入/脱离网络

---

## 第一部分 为什么需要"网络"（重新理解隔离）

### 1.1 矛盾：容器既独立、又要互相找得到

上一讲说过，容器通过 namespace 隔离，其中 **Network 命名空间**让每个容器拥有"自己的"网卡、IP、端口、路由表。对容器自己来说：

```
hostname 是容器 ID      ← UTS 隔离
ifconfig 只看到自己的网卡 ← Network 隔离
监听的端口只属于自己       ← 端口由网络栈决定
```

但如果完全隔离、老死不相往来，一个 `nginx` 容器和一个 `mysql` 容器就没法通信，也就组不成"一套应用"。所以 Docker 需要一套网络机制，让容器**既保持隔离、又能按需互通**。这就是本讲的主题。

### 1.2 一句话理解 Docker 网络

> **Docker 网络 = 一群"虚拟网卡 + 虚拟交换机（网桥）+ 一张路由/NAT 规则"的组合**，它把彼此隔离的容器网络栈连起来。

后面所有内容都是围绕这三个部件展开的：**网桥（bridge）**负责把容器连进同一个"局域网"，**veth 设备**是容器那端的"虚拟网线"，**iptables** 负责"出口/入口"的地址转换（NAT）。

---

## 第二部分 基本原理：容器网络栈从哪里来

### 2.1 三种网络命名空间事实

容器创建时就带着一个独立的网络命名空间，但这个"空间"里**没有任何实体物理网卡**，只有 Docker 给它装的虚拟设备。装什么，取决于你选哪种网络模式。

### 2.2 Docker 的四种网络模式（重点）

创建容器时用 `--network` 指定，默认不写就是 `bridge`：

| 模式 | 网络名 | 一句话定性 | 与宿主机关系 |
|---|---|---|---|
| **bridge** | `docker0`（默认） | 桥接式：容器同处一个虚拟局域网 | 通过 NAT 出口到外网，端口靠 `-p` 映射 |
| **host** | 无 | 直接复用宿主机的网络栈 | 容器跟宿主机同 IP、同端口表 |
| **none** | 无 | 没有网络，完全隔离 | 只有 loopback，无法对外通信 |
| **container** | 复用 | 共享另一个容器的网络栈 | 与指定容器同 IP、同端口表 |

> **选型直觉**：`bridge` 默认、最常用、能同时接多容器且可控；`host` 追求性能、想直接暴露端口时用；`none` 用于安全/离线容器；`container` 用于让两个容器共享同一份网络（如把容器挂在某个网络代理上）。

### 2.3 查看当前有哪些网络

```bash
docker network ls
```

输出会看到 `bridge`、`host`、`none` 三个内建网络，以及你之后手动创建的网络。

---

## 第三部分 默认 Bridge 网络的结构（核心）

### 3.1 三样东西构成一座"网桥"

默认 `bridge` 网络的工作原理，可以类比一台交换机加若干根网线：

```
        宿主机（一台服务器）
     ┌─────────────────────────────┐
     │      docker0  （虚拟网桥/交换机）     ← 桥设备，IP 172.17.0.1
     │       │        │        │
     │   veth0    veth1    veth2       ← 桥的端口（虚拟网线）
     │     │         │        │
     │ 容器A的网卡  容器B的网卡  容器C的网卡
     │  172.17.0.2  172.17.0.3  172.17.0.4
     └─────────────────────────────┘
```

- **docker0**：宿主机上的一个虚拟网桥（默认地址 `172.17.0.1`），相当于"交换机"。所有加入默认 bridge 的容器，都把自己的虚拟网卡接到这张"交换机"上。
- **veth 对（veth pair）**：一对"虚拟网线"，一端在桥（`veth0`…），另一端在容器里（容器内 `eth0`）。容器之间通过 `docker0` 互相转发。
- **IP 分配**：Docker 自动给容器从网段里分配 IP（默认 `172.17.0.2` 起）。

### 3.2 同桥容器默认互通

因为都接在同一张 `docker0` 上，**同一 bridge 网络里的容器默认可以互相 ping 通**——这就是"容器互联"的基础。

```bash
docker exec -it 容器A ping 容器B的IP   # 能通
```

### 3.3 出口外网靠 NAT

容器要访问外网（拉包、apt update 等），走的是宿主机的**iptables NAT**：容器发出去的包，被转成宿主机的 IP 出去，回来再转回来。

```bash
# 宿主机上需要开启转发(原理, 不必手敲)
sysctl net.ipv4.ip_forward     # 需要是 1, 否则容器出不去外网
```

### 3.4 外部访问容器靠 `-p` 端口映射

默认 bridge 下，**宿主机不能直接访问容器的 IP/端口**（那是另一个网段）。要对外提供服务，必须用 `-p` 把"宿主机端口 → 容器端口"映射出去，底层也是 iptables 端口转发：

```bash
docker run -d -p 8080:80 nginx
curl http://localhost:8080     # 访问宿主机8080 → 转发到容器80
```

> **核心矛盾再点一次**：隔离（自己独立 IP/端口）与对外服务（要让外部按宿主机端口找进来）之间，靠 `-p` 映射这座"桥"连接。详细实战在下一讲。

---

## 第四部分 创建网络参数（重点）

### 4.1 为什么需要自定义网络

默认 `bridge` 网络可以满足"互通"，但它有两个不便：

1. **IP 会变**：容器重启后 IP 可能重新分配，用 IP 相互引用很脆弱；
2. **不支持自动主机名解析**：默认 bridge 里，容器**不能**用容器名直接互相访问，只能靠 IP 或 `--link`。

自己 `docker network create` 一个 **自定义 bridge 网络**就能解决：自定义网络自带**内嵌 DNS**，容器之间可以直接用**容器名**访问——这比记 IP 可靠得多。这是本讲"重点中的重点"。

### 4.2 docker network create 常用参数

```bash
docker network create [参数] 网络名

docker network create -d bridge mynet            # -d/--driver 指定驱动, 默认 bridge
docker network create --subnet 172.20.0.0/16 mynet      # 指定网段/子网
docker network create --gateway 172.20.0.1 mynet        # 指定网关(桥地址)
docker network create --ip-range 172.20.5.0/24 mynet    # 限制给容器分配的IP池
```

| 参数 | 作用 | 说明 |
|---|---|---|
| `-d` / `--driver` | 网络驱动 | `bridge`、`host`、`none`、`overlay` 等 |
| `--subnet` | 子网 | 指定网段，如 `172.20.0.0/16` |
| `--gateway` | 网关 | 通常是该网段的第一个地址（桥地址） |
| `--ip-range` | IP 分配池 | 只从该子范围内给容器发 IP |
| `-o` | 选项 | 传驱动特有配置 |

### 4.3 查看/删除网络

```bash
docker network ls                      # 列出所有网络
docker network inspect mynet           # 查看网络细节(子网、已接容器、驱动)
docker network rm mynet                # 删除网络(需先断开其中容器)
```

> `docker network inspect mynet` 输出的 `Containers` 字段列出了"谁接在这个网里、拿到什么 IP"，是排查网络问题的第一站。

---

## 第五部分 网络配置细节（难点）

### 5.1 指定容器的 IP

在一个自定义网络里，可以给容器指定固定 IP（须落在这个网络的 `--subnet` 范围内、且在 `--ip-range` 允许内）：

```bash
docker network create --subnet 172.20.0.0/16 --ip-range 172.20.5.0/24 mynet
docker run -d --name web --network mynet --ip 172.20.5.10 nginx
docker inspect web | grep IPAddress    # 看到 172.20.5.10
```

> 固定 IP 适合做"我知道这台容器一定在哪个地址"的场景（如数据库白名单）。代价是生命周期要管理好，别多个容器抢同一 IP。

### 5.2 容器名即 DNS

把两个容器都接进同一个自定义网络后，它们直接用容器名互相访问：

```bash
docker run -d --name c1 --network mynet alpine sleep 1d 
docker run -it --name c2 --network mynet alpine sh 

> ping c1
```

> **这是自定义网络的核心价值**：容器名 = 内部可用的主机名（由 Docker 内嵌 DNS 解析），容器重启 IP 变了也不影响。下一讲的"容器互联"正式用它。

### 5.3 接入/脱离网络（connect / disconnect）

容器可以在运行中随时接入或脱离某个网络：

```bash
docker network connect mynet web       # 把 web 容器接进 mynet
docker network disconnect mynet web    # 把 web 容器移出 mynet
```

- 一个容器可以同时接多个网络；接多个网络意味着它有多个网卡/多个 IP，可同时对多个"局域网"提供服务；
- 脱离网络后容器与网络里其他容器不再直接互通。

### 5.4 给容器别名（--network-alias / --hostname）

- `--network-alias 别名`：在同一网络里给容器再起一个名字，别人可用别名访问它；
- `--hostname 名字`：设置容器内部看到的主机名（默认是容器 ID）。

```bash
docker run -d --name db --network mynet --network-alias database -e MYSQL_ROOT_PASSWORD='use-a-strong-password' mysql
docker exec app ping database          # 用别名 database 也能解析到 db
```

---

## 第六部分 实战一：看透默认 bridge 网络

**目标**：起两个容器进默认网络，观察它们同桥互通、并理解 NAT 与外网访问，建立"网络结构"的实感。

**第 1 步：查看现有网络**

```bash
docker network ls
```

**第 2 步：起一个容器, 看它的网卡与 IP**

```bash
docker run -d --name mynginx nginx
docker exec -it mynginx ip addr         # 容器内看到 eth0(172.17.x.x)
docker network inspect bridge | grep -A8 Containers   # 桥的视角看已接容器
```

**第 3 步：再起一个, 验证同桥互通（ping 容器的 IP）**

```bash
docker run -it --rm --name helper alpine sh
apk add --no-cache iputils              # 容器内装 ping 工具
ping 172.17.0.2        # 能通, 因为是同一张 docker0
```

**第 4 步：外部访问容器**

```bash
docker run -d --name web -p 8080:80 nginx
curl http://localhost:8080              # NAT + 端口映射把宿主机8080转到容器80
```

---

## 第七部分 实战二：创建并使用自定义网络

**目标**：亲手 `docker network create` 一个带内嵌 DNS 的自定义 bridge 网络，并用"容器名=主机名"实现靠谱的容器互联。这是下一讲 `--link` 与 Docker Compose 的底层原理。

**第 1 步：创建自定义网络**

```bash
docker network create --driver bridge \
  --subnet 172.20.0.0/16 --gateway 172.20.0.1 --ip-range 172.20.5.0/24 devnet
docker network ls                       # 出现 devnet
```

**第 2 步：把两个容器接进 devnet**

```bash
docker run -d --name web --network devnet nginx
docker run -d --name db  --network devnet -e MYSQL_ROOT_PASSWORD='use-a-strong-password' mysql
docker network inspect devnet | grep -A6 Containers
```

**第 3 步：用容器名互相访问（重点验证）**

```bash
docker exec -it db nslookup web         # 容器名被 DNS 解析成 IP
docker exec -it db curl http://web      # 直接用 web 名字访问 nginx
```

> 若容器里没有 `nslookup`/`curl`，用 `sh -c "getent hosts web"` 一样能看到解析结果。

**第 4 步：指定固定 IP 与别名**

```bash
docker run -d --name app --network devnet --ip 172.20.5.20 --network-alias backend python:alpine tail -f /dev/null
docker exec -it web sh -c "getent hosts backend"   # 别名也能解析
```

**第 5 步：清理**

```bash
docker rm -f mynginx web db app helper
docker network rm devnet
```

---

## 第八部分 总结

| 方面 | 要点 |
|---|---|
| 本质 | 网络隔离来自 **Network 命名空间**；容器自视为独立主机（独立 IP/网卡/端口） |
| 四种模式 | `bridge`（默认，推荐）/ `host`（复用宿主）/ `none`（无网）/ `container`（复用他人） |
| bridge 结构 | `docker0` 桥 + `veth` 对 + iptables；同桥互通、NAT 出口、`-p` 入口映射 |
| 创建网络 | `docker network create [-d bridge] [--subnet] [--gateway] [--ip-range] 名` |
| 核心价值 | 自定义网络**内嵌 DNS** → 容器名当主机名用，重启也不慌 |
| 配置细节 | 固定 `--ip`、运行中 `connect`/`disconnect`、`--network-alias` 别名、多网络接入 |
| 命令 | `ls` / `create` / `inspect` / `rm` / `connect` / `disconnect` |

> **一句话点透**：默认 `bridge` 能用但"只认 IP、不认名字"；**自定义网络**让容器之间靠名字互联、IP 变动无忧——这就是下一讲"容器互联"与之后 Docker Compose 的地基。要做成一整套多容器应用，先学会把容器"接进同一个自定义网络"。

## 下一步

下一讲（实践）将动手做：**外部访问容器**（`-p` 端口映射各种形态）、**容器互联**（`--link` 与自定义网络两种方式）、**配置 DNS**。本讲的理论是它的全部依据。