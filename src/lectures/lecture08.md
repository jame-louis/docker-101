# Docker 网络实现（实践）

## 目标

- **难点**：掌握容器外部访问的 `-p` 端口映射各种形态（映射指定端口、随机端口 `-P`、绑定宿主机地址、多端口）
- 掌握容器互联的两种方式：`--link`（旧式）与**自定义网络**（推荐），理解各自的原理
- 掌握容器网络 DNS 配置：`--dns`、`--dns-search`、理解容器内 `/etc/resolv.conf`
- 完成一个"两容器互联 + 外部访问"的完整实验并截图

---

## 第一部分 外部访问容器（难点）

### 1.1 前提回顾：为什么不能直接访问

上一讲说过，默认 `bridge` 网络的容器有自己的网段（如 `172.17.0.x`），宿主机和外部都**不能直接用容器的 IP 访问它**。想对外提供"服务"，必须在**容器启动时**用 `-p` / `-P` 把宿主机端口与容器端口绑起来。启动之后再想加映射是做不到的，只能删掉重建。

### 1.2 `-p` 的完整格式

```bash
# 最常用: 宿主机端口:容器端口
docker run -d -p 宿主机端口:容器端口 镜像

# 例: 宿主机8080 → 容器80
docker run -d --name web -p 8080:80 nginx
```

访问方式：`http://宿主机IP:8080`，流量被 iptables 转进容器的 80 端口。

### 1.3 不写宿主机端口：随机分配（-P / -p 只写容器端口）

宿主机端口不指定时，Docker 会**随机挑一个高位端口**（29000~32768 之间）映射过去：

```bash
docker run -d -P nginx                  # -P 把所有 EXPOSE 的端口都随机映射
docker run -d -p 80 nginx               # 只映射容器80, 宿主机端口随机
docker ps                               # 看 PORTS 列: 0.0.0.0:32768->80/tcp
```

用 `-P` 或只写容器端口时，端口会变，适合开发时"临时开一个看看"；正式对外要写死端口。

### 1.4 指定宿主机地址绑定

默认绑在宿主机所有网卡（`0.0.0.0`），也可指定只绑某个 IP：

```bash
docker run -d -p 127.0.0.1:8080:80 nginx     # 只允许本机访问
docker run -d -p 192.168.1.10:8080:80 nginx  # 只绑内网IP
```

### 1.5 映射多个端口

需求是"一个端口不够"时，给多个 `-p` 即可，可以混用多种形态：

```bash
docker run -d --name app \
  -p 80:80 -p 443:443 -p 3000:3000 \
  -p 127.0.0.1:3306:3306 \
  myapp
```

> **口诀**：`-p 前是宿主机、后是容器`，左边谁写谁决定"外部从哪进来"；想固定就写死，想临时就让它随机。

---

## 第二部分 容器互联（重点）

### 2.1 互联要解决什么问题

容器之间要互相发请求（web 找 DB），总得知道对方地址。最笨的办法是"记对方的 IP"，可 IP 会变、也不是给人记的。**容器互联 = 让容器能用一个稳定的名字找到彼此。**

### 2.2 方式一：--link（旧式，了解原理）

老版本的互联方式。启动一个容器时用 `--link 目标容器:别名`，Docker 会在源容器里写一条"目标→IP"的映射，并注入环境变量：

```bash
docker run -d --name db mysql
docker run -d --name web --link db:db nginx

docker exec -it web ping db     # web 里能用 db 这个名字
```

局限：`--link` 是**单向、点对点**的，只对"挂了 `--link` 的那个容器"生效，改了要重建，容器多了链条难维护。Docker 官方已不推荐，只作为了解。

### 2.3 方式二：自定义网络（推荐，反向重点）

上一讲的结论直接落地：把要互联的容器**都接进同一个自定义网络**，它们就自动能用**容器名**互相访问。这是 Docker 推荐的互联方式。

```bash
docker network create webnet
docker run -d --name db  --network webnet mysql
docker run -d --name web --network webnet nginx

docker exec -it web ping db      # 直接 ping 名字
docker exec -it db  curl http://web   # web 也是可用的主机名
```

优点：**双向、自动发现、不需要配置**，新增/重启容器都自动更新 DNS 解析。多容器应用（web + db + cache）都进同一网络，就能像"在同一机房"一样按名字调用。

### 2.4 两种方式对比

| 维度 | `--link` | 自定义网络 |
|---|---|---|
| 方向 | 单向、点对点 | **双向、任意到任意** |
| 解析 | 注入环境变量 + hosts | 内嵌 **DNS** 自动解析 |
| 新增容器 | 要重建/加 link | 自动发现, 无需改动 |
| 推荐度 | 旧式, 了解即可 | **官方推荐** |
| 原理 | 手动写死映射 | 网络自带域名系统 |

> **记住**：自定义网络自带 DNS，容器名即主机名，只管把相关容器"接到同一张网"。

---

## 第三部分 配置 DNS

### 3.1 容器内默认的 DNS

容器生成时，`/etc/resolv.conf` 里的 nameserver 来自两个来源：如果用了 `--dns` 则用它，否则继承**宿主机的 DNS 设置**。这决定容器解析 `hub.docker.com`、公司内网域名时问谁。

### 3.2 常用 DNS 配置

| 参数 | 作用 |
|---|---|
| `--dns 8.8.8.8` | 给容器指定 DNS 服务器 |
| `--dns-search 例.com` | 设置搜索域（自动补全域名后缀） |
| `--add-host a:192.168.1.2` | 手动往容器 hosts 里加一条映射 |

```bash
docker run -d --name web \
  --dns 8.8.8.8 \
  --dns-search mycorp.example \
  nginx

docker exec -it web cat /etc/resolv.conf    # 看到 nameserver 8.8.8.8, search mycorp.example
```

### 3.3 为什么要配 DNS

- 默认继承宿主机 DNS：在公司里往往就能直接用内网解析；
- 但宿主机 DNS 可能因为宿主机重启/网络接管而变，给容器**显式指定**更稳定可靠；
- 容器想用的解析目标（如公司内部服务域名）与宿主机不同时，必须显式给容器配自己的 DNS。

---

## 第四部分 实战一：外部访问容器

**目标**：用不同形式的 `-p` 把容器服务暴露给外部，吃透端口映射，并亲手印证"启动后再改端口是做不到的"。

**第 1 步：固定端口映射并访问**

```bash
docker run -d --name web -p 8080:80 nginx
curl http://localhost:8080          # 返回 nginx 欢迎页
```

**第 2 步：随机端口映射**

```bash
docker run -d --name web2 -P nginx
docker ps                           # PORTS 列显示 0.0.0.0:32768->80/tcp
curl http://localhost:32768         # 访问那个随机端口
```

**第 3 步：只允许本机访问**

```bash
docker run -d --name web3 -p 127.0.0.1:8081:80 nginx
curl http://127.0.0.1:8081         # 可以
# 换成局域网IP访问则不行(未绑定该网卡)
```

**第 4 步：多端口**

```bash
docker run -d --name multi -p 80:80 -p 8000:80 nginx
# -p 不限几对, 混用形态都行
```

**第 5 步：体验"启动后加不了映射"**

```bash
docker exec -it web bash            # 进容器重启 nginx 到别的端口, 外部依然走 8080
# 想换宿主映射? 必须 docker rm 后带新 -p 重建
```

---

## 第五部分 实战二：容器互联（--link 与自定义网络）

**目标**：用 `--link` 和自定义网络两种方式实现"web 找 db"，体会推荐方式的高下，并把过程截图（本讲作业）。

**方式 A：--link（旧式）**

```bash
docker network create legacynet
docker run -d --name db --network legacynet mysql:8
docker run -d --name web --network legacynet --link db:db nginx

docker exec -it web cat /etc/hosts         # 看到 db 的条目
docker exec -it web ping db                # 能 ping 通
```

**方式 B：自定义网络（推荐）**

```bash
docker network create appnet
docker run -d --name db  --network appnet mysql:8
docker run -d --name web --network appnet nginx

docker exec -it web ping db                # 一样能通, 且不改配置
docker exec -it db  getent hosts web       # 反过来也认识 web(双向)
```

**第 3 步：对比结论（写进实验报告）**

- A 只在挂了 `--link` 的 web 里写了 db 的映射（单向）；B 里双方都自动认识（双向）。
- B 新增第三个容器时无需任何改动，A 则要再加一条 `--link`。

---

## 第六部分 实战三：配置 DNS

**目标**：给容器显式指定 DNS 与搜索域，并验证 `resolv.conf` 生效。

**第 1 步：带 --dns / --dns-search 启动**

```bash
docker run -d --name dnsbox \
  --dns 8.8.8.8 --dns-search example.test \
  nginx
```

**第 2 步：查看容器内解析配置**

```bash
docker exec -it dnsbox cat /etc/resolv.conf
# nameserver 8.8.8.8
# search example.test
```

**第 3 步：与默认对比**

```bash
docker run -d --name defaultbox nginx
docker exec -it defaultbox cat /etc/resolv.conf   # 继承宿主机的 nameserver
```

---

## 第七部分 总结

| 方面 | 要点 |
|---|---|
| 外部访问 | 容器启动时用 `-p 宿主机:容器` 映射; `-P` 随机端口; 可绑定指定地址、可多端口; **启动后改不了, 得重建** |
| 端口记忆 | `-p 前是宿主机、后是容器`; 左边写死固定、不写则随机 |
| 容器互联 | `--link`(旧, 单向) vs **自定义网络**(推荐, 双向、DNS 自动解析) |
| 自定义网络 | 相关容器接进同一网络 → **容器名即主机名** |
| DNS 配置 | `--dns` 指定 nameserver、`--dns-search` 搜索域、`--add-host` 手动 hosts; 不配则继承宿主机 |
| 命令 | `-p/-P`、`docker network create/connect`, 排查 `ps` 看 PORTS · `exec cat /etc/resolv.conf` |

> **一句话点透**：本讲把上一讲的"理论"变成三件能动手的事——**对外**用 `-p` 开入口，**对内**用自定义网络让容器按名字互联，**解析**用 `--dns` 固定好 DNS。到这一步，你已经能让多个容器"既有隔离、又能像同一套系统一样配合"了。

## 下一步

下一讲进入**数据持久化**：容器里写了数据、一删就没了的问题，用数据卷 `-v` 和绑定挂载解决——把"临时"的容器变成"留得住数据"的有状态服务。