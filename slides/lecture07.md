---
theme: default
title: Docker 网络实现·原理
info: |
  ## Docker 网络实现(理论) 教学幻灯片
  Docker 101 第 7 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# Docker 网络实现 · 原理
## 第 7 讲

<!-- 讲者备注：【空镜】开场钩子。提问: 一个 nginx 容器和一个 mysql 容器, 它俩怎么互相认识? 引出"容器又独立、又要互联"的核心矛盾。 -->

---
transition: slide-left
---

## 目标

让容器的"各自独立"里能互相找得到

- 本质: 网络隔离来自 **Network 命名空间**
- 四种模式:`bridge / host / none / container`
- `docker0` 桥 + `veth` 对 + iptables 的组成
- 创建网络 + **容器名即 DNS**

<!-- 讲者备注：【全景】总览三幕剧。第一幕为什么需要网络(隔离矛盾+四种模式); 第二幕默认 bridge 结构; 第三幕创建网络与配置细节; 两个实战。 -->

---
layout: section
---

# 一、为什么需要网络
> 容器既独立, 又要互通

<!-- 讲者备注：【转场】第一幕幕卡。立起核心矛盾: 隔离是常态, 互联是需求。网络就是平衡这两点的机制。 -->

---

# 上一讲"容器像小机器", 靠 namespace 隔离

- **Network 命名空间** → 每个容器有了"自己的"网卡 / IP / 端口
- `hostname` 是容器 ID · `eth0` 是自己的网卡 · 端口只属于自己
- 但完全隔离 → 组不成"一套应用"

> 既要各管各的, 又要按需牵手, 这就是网络

<!-- 讲者备注：【特写】回扣上一讲。隔离带来安全感, 可应用是组合的。四个 namespace 里 Network 负责"看起来独立", 本讲讲"独立之后怎么连起来"。 -->

---

# Docker 网络 = 虚拟网卡 + 网桥 + 一张 NAT 规则

```
容器A ──veth──> docker0 桥 <──veth── 容器B
                    │
               iptables/路由
                    │
                 宿主机网卡 ──> 外网
```

<!-- 讲者备注：【全景】三部件图示。veth=网线、docker0=交换机、iptables=出口/入口的翻译官。后面所有内容都是这三样的变体。 -->

---
layout: section
---

# 二、四种网络模式
> 一选模式, 二定结构

<!-- 讲者备注：【转场】第二幕幕卡。告诉学生: 容器生下来先选一个网络模式, 默认就是 bridge。本幕建立选型直觉。 -->

---

# 容器生下来先选一个网络模式

| 模式 | 定性 | 与宿主机 |
|---|---|---|
| **bridge** 默认 | 同处一个虚拟局域网 | NAT 出口 + `-p` 映射 |
| **host** | 直接复用宿主机网络 | 同 IP、同端口表 |
| **none** | 没有网络 | 只有 loopback |
| **container** | 复用另一个容器的 | 同 IP、同端口表 |

<!-- 讲者备注：【全景】四种模式一表打尽。选型直觉: 默认 bridge 最常用; host 图性能; none 保安全; container 想跟某容器走同一份网络。 -->

---
transition: slide-left
---

# 一行命令看现在有什么网

```bash
docker network ls
# bridge   host   none   (三个内建) + 你手动建的
```

<!-- 讲者备注：【特写】ls 是网络版 ps。三个内建网络 + 之后 create 的自定义网络, 都列在这里。 -->

---
layout: section
---

# 三、默认 bridge 的结构
> 一台"交换机"加几根"网线"

<!-- 讲者备注：【转场】第三幕幕卡。选好 bridge 后, 里面到底长什么样? 三个部件逐一登场。 -->

---

# docker0 是交换机, veth 是网线

```
   docker0 (172.17.0.1)    ← 桥/交换机
     │       │
  veth0    veth1           ← 虚拟网线
     │       │
  容器A     容器B
172.17.0.2 172.17.0.3
```

- 同桥容器**默认互通** (ping 容器 IP 能通)
- IP 由 Docker 自动分配

<!-- 讲者备注：【全景】桥+网线类比。docker0 是宿主上的虚拟网桥, veth pair 一端搭在桥、一端进容器。同桥=同局域网, 默认可互 ping。 -->

---

# 出口外网靠 NAT, 入口靠 -p 映射

```bash
# 出: 容器 → iptables NAT → 宿主机IP → 外网
sysctl net.ipv4.ip_forward      # 置 1 才能出去

# 入: 宿主机8080 → 容器80
docker run -d -p 8080:80 nginx
```

> 宿主机**不能直接**访问容器的 IP/端口, 靠 -p 桥接

<!-- 讲者备注：【特写】两个方向两座桥。出口: 容器借宿主机IP对外。入口: 外部只能摸到宿主机端口, 由 -p 转进容器。这页埋下一讲"外部访问容器"的钩子。 -->

---
layout: section
---

# 四、创建自定义网络
> 默认 bridge 只认 IP, 不认名字

<!-- 讲者备注：【转场】第四幕幕卡。自定义网络的唯一理由: 默认 bridge 用 IP 互联太脆弱, 自定义网络内嵌 DNS, 容器名直接当主机名。 -->

---

# 默认 bridge 的两个"别扭"

- IP 会变: 容器重启后可能换 IP
- 不认名字: 容器**不能**用容器名互访

> 用它互联, 地址动不动就断片

<!-- 讲者备注：【特写】指出默认桥的痛点。要是赶上下讲"容器互联", 这种脆弱引用是灾难。由此引出自定义网络。 -->

---

# docker network create 起一个"带 DNS 的局域网"

```bash
docker network create -d bridge mynet
docker network create --subnet 172.20.0.0/16 mynet
docker network create --gateway 172.20.0.1 mynet
docker network create --ip-range 172.20.5.0/24 mynet
```

| 参数 | 作用 |
|---|---|
| `-d/--driver` | 驱动(默认 bridge) |
| `--subnet` | 指定网段 |
| `--gateway` | 网关(桥地址) |
| `--ip-range` | 容器分配IP池 |

<!-- 讲者备注：【特写】四个参数逐个讲。subnet 划网段, gateway 是桥自己占的地址, ip-range 限定从哪个范围发 IP。不写就让 Docker 自动选。 -->

---

# 接进同一自定义网 → 容器名即主机名

```bash
docker run -d --name c1 --network mynet alpine sleep 1d 
docker run -it --name c2 --network mynet alpine sh 

> ping c1
```

> 内嵌 DNS: 把容器名解析成 IP, 重启也不慌

<!-- 讲者备注：【特写】核心价值实测。两个容器都 --network mynet 后, 彼此用名字访问, 不需要记 IP。这就是下一讲 --link 和 Compose 的底层。 -->

---
transition: slide-left
---

# 还能指定 IP、加别名、运行中断开

```bash
docker run -d --name db --network mynet \
  --ip 172.20.5.10                       # 固定 IP
  --network-alias database               # 加别名

docker network connect mynet web        # 运行中接入
docker network disconnect mynet web     # 运行中脱离
```

<!-- 讲者备注：【特写】配置细节三连。固定 IP 适合白名单; 别名让容器多一个名字; connect/disconnect 让容器运行中搬家, 一个容器可同时接多个网络。 -->

---
layout: section
---

# 五、实战一
## 看透默认 bridge
> 同桥互通 + NAT + 端口映射

<!-- 讲者备注：【转场】第五幕幕卡。实战一把第一幕的结构落到手: 两个容器互通、看网卡、做端口映射。 -->

---

# 同桥互通: 一个 ping 见真章

```bash
docker run -d --name mynginx nginx
docker exec -it mynginx ip addr        # 看 eth0 = 172.17.x.x
docker network inspect bridge \
  | grep -A8 Containers                # 桥视角看谁接在网里

docker run --rm -it alpine sh
apk add iputils && ping 172.17.0.x     # 同一 docker0, 通
```

<!-- 讲者备注：【特写】三条命令连起来看。容器内 eth0 是 docker 网的 IP, bridge inspect 显示每个容器拿到的地址。ping 通 = 同桥。 -->

---

# 外部访问: -p 把网关到容器

```bash
docker run -d --name web -p 8080:80 nginx
curl http://localhost:8080    # 宿主机8080 → 容器80
```

> NAT 出、-p 入, 一进一出两个方向

<!-- 讲者备注：【特写】补上 NAT 的"入口"半边。上一幕已讲, 这里亲手验证一次, 呼应 3.4 的 -p 桥。 -->

---
layout: section
---

# 六、实战二
## 创建并使用自定义网络
> 容器名当域名用

<!-- 讲者备注：【转场】第六幕幕卡。实战二收官: 起一个带 DNS 的自定义网络, 用名字互连——这是下讲与 Compose 的前置。 -->

---

# 一手建网, 一手把容器接进去

```bash
docker network create --driver bridge \
  --subnet 172.20.0.0/16 --gateway 172.20.0.1 \
  --ip-range 172.20.5.0/24 devnet

docker run -d --name web --network devnet nginx
docker run -d --name db  --network devnet -e MYSQL_ROOT_PASSWORD='use-a-strong-password' mysql
docker network inspect devnet | grep -A6 Containers
```

<!-- 讲者备注：【特写】建网 + 接入。subnet/gateway/ip-range 三个参数一次用全。inspect 确认 web、db 都拿到 devnet 的地址。 -->

---

# 容器名即主机名, 直接互访

```bash
docker exec -it db nslookup web        # 名字被解析
docker exec -it db curl http://web     # 用名字访问 nginx

docker run -d --name app --network devnet \
  --ip 172.20.5.20 --network-alias backend python:alpine tail -f /dev/null
docker exec -it web sh -c "getent hosts backend"  # 别名也行
```

<!-- 讲者备注：【特写】验证 DNS。nslookup/getent 都能把容器名解析成 IP。别名 backend 让 web 也能找到 app。 -->

---

# 一张表带走全部要点

| 方面 | 要点 |
|---|---|
| 本质 | 网络隔离来自 **Network 命名空间** |
| 模式 | bridge(默认)/ host / none / container |
| bridge | docker0 + veth + iptables; 同桥互通 · NAT 出 · -p 入 |
| 创建网络 | create -d --subnet --gateway --ip-range |
| 核心价值 | 自定义网络内嵌 DNS → **容器名即主机名** |
| 细节 | --ip 固定 · connect/disconnect · --network-alias |

<!-- 讲者备注：【全景】收束全片。这张记忆地图是下讲"容器互联、端口映射、DNS"的地基。 -->

---
transition: slide-left
---

# 默认网只认 IP, 交了学费才懂自定义网香

> 下一步: 外部访问容器、容器互联(--link)、配置 DNS —— 全部基于本讲的桥与自定义网络

<!-- 讲者备注：【空镜】悬念收尾。本讲给了"网"的理论, 下讲动手连。预告端口映射、--link 两种互联、DNS。 -->

---
layout: section
---

# 谢谢大家

Q & A

<!-- 讲者备注：【空镜】片尾致谢, 留提问时间。 -->