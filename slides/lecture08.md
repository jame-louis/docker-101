---
theme: default
title: Docker 网络实现·实战
info: |
  ## Docker 网络实现(实践) 教学幻灯片
  Docker 101 第 8 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# Docker 网络实现 · 实战
## 第 8 讲

<!-- 讲者备注：【空镜】开场钩子。提问: 容器是隔离的, 那外部怎么访问到它? 容器之间又怎么按名字找到彼此? 本讲三件事: 出口(-p)、对内(互联)、解析(DNS)。 -->

---
transition: slide-left
---

## 目标

上一讲的理论, 动手做成三件事

- 外部访问: `-p / -P` 端口映射各种形态
- 容器互联: `--link` 对比**自定义网络**
- 配置 DNS: `--dns / --dns-search`
- 完成"两容器互联 + 外部访问"实验并截图

<!-- 讲者备注：【全景】总览三幕剧。复盘上一讲的桥与自定义网络, 本讲全落在动手。 -->

---
layout: section
---

# 一、外部访问容器
> 出口要开个"门"

<!-- 讲者备注：【转场】第一幕幕卡。难点开场: 容器隔离, 外部进不来, 启动时用 -p 开一扇门。 -->

---

# 隔着网段, 外部如何进得来?

> 容器IP是内网网段(172.17.x.x), 外部摸不到
> 答案是启动时用 `-p` 把宿主端口绑到容器端口

<!-- 讲者备注：【特写】点破前提。默认 bridge 里宿主机和外部都访问不到容器内网IP, 必须在 run 时映射, 启动后改不了, 只能重建。 -->

---

# -p 前是宿主机, 后是容器

```bash
docker run -d -p 8080:80 nginx
#       宿主机8080 → 容器80
curl http://localhost:8080
```

> 流量先到宿主机8080, 再被 iptables 转进容器80

<!-- 讲者备注：【特写】端口映射的读法。左边谁写谁决定外部从哪进。访问宿主机IP:端口即可。 -->

---

# 不写端口? 就随机送你一个

```bash
docker run -d -P nginx              # 随机映射所有EXPOSE端口
docker run -d -p 80 nginx          # 只映射80, 宿主端口随机
docker ps    # PORTS: 0.0.0.0:32768->80/tcp
```

> 随机端口适合临时看一眼, 固定端口才对外

<!-- 讲者备注：【特写】随机端口机制。-P 或只写容器端口则宿主机端口随机(29000+)。开发时临时开, 正式对外要写死。 -->

---

# 还能绑定地址、映射多端口

```bash
docker run -d -p 127.0.0.1:8080:80 nginx   # 只许本机
docker run -d -p 80:80 -p 443:443 myapp    # 多端口混用
```

> 左地址决定"绑定哪张网卡", 多写几个 -p 就开几扇门

<!-- 讲者备注：【特写】增强形态。绑 127.0.0.1 只服务本机; 多个 -p 叠加服务多个端口。 -->

---
layout: section
---

# 二、容器互联
> 让容器按"名字"找到彼此

<!-- 讲者备注：【转场】第二幕幕卡。出口开好之后, 对内让容器互相认识。两种互联方式上桌。 -->

---

# 互联不是记IP, 是认一个"稳定名字"

- 容器IP会变, 不适合写死
- 期待: 用一个名字, 稳定地找到另一台容器

> 两条路: 古老的 `--link`, 现代的自定义网络

<!-- 讲者备注：【特写】提出互联的诉求。互联=给容器一个可靠的名字去定位对方。引出两种实现。 -->

---

# 方式一: --link (旧式)

```bash
docker run -d --name db mysql
docker run -d --name web --link db:db nginx
docker exec -it web ping db     # web 认识 db
```

- 在 web 的 hosts 里**手动写一条** db→IP 的映射
- **单向**: 只对挂了 --link 的容器生效

<!-- 讲者备注：【特写】--link 原理。会在源容器注入目标容器IP映射+环境变量, 但点对点单向, 链条一多就难维护, Docker 已不推荐。 -->

---

# 方式二: 自定义网络 (推荐)

```bash
docker network create appnet
docker run -d --name db  --network appnet mysql
docker run -d --name web --network appnet nginx
docker exec -it web ping db            # 直接 ping 名字
docker exec -it db getent hosts web    # 反过来也认(双向)
```

> 相关容器接进同一张网, 名字自动当域名

<!-- 讲者备注：【特写】推荐方式。同网即同"机房", 内嵌 DNS 自动解析, 双向、免配置、新增容器自动发现。这是下下讲 Compose 的地基。 -->

---

# 一表看清两条路

| 维度 | --link | 自定义网络 |
|---|---|---|
| 方向 | 单向、点对点 | **双向、任意到任意** |
| 解析 | 写死在 hosts | 内嵌 **DNS** |
| 新增容器 | 要重建/加link | 自动发现 |
| 归属 | 旧式, 了解 | **官方推荐** |

<!-- 讲者备注：【全景】两路对比收束。结论一句话: 自定义网络自带 DNS, 把容器接到同一张网, 互联就完成了。 -->

---
layout: section
---

# 三、配置 DNS
> 容器问谁要地址?

<!-- 讲者备注：【转场】第三幕幕卡。互联靠名字, 名字靠DNS解析, 那 DNS 又是哪天配置的? 本幕讲给容器配解析。 -->

---

# 容器默认继承宿主机的 DNS 设置

> 不加配置, resolv.conf 的 nameserver 就是宿主机的
> 想固定/想换目标 → 给容器显式指定

<!-- 讲者备注：【特写】默认行为。容器生成时 resolv.conf 继承宿主机, 一般来说能用。需要稳定或不同目标时显式配。 -->

---

# --dns 指定服务器, --dns-search 设搜索域

```bash
docker run -d --name web \
  --dns 8.8.8.8 \
  --dns-search mycorp.example \
  nginx

docker exec -it web cat /etc/resolv.conf
# nameserver 8.8.8.8
# search mycorp.example
```

<!-- 讲者备注：【特写】两条参数。--dns 定 nameserver; --dns-search 让短名自动补全域名后缀。--add-host 还能手动塞一条 hosts。 -->

---
layout: section
---

# 四、实战一
## 外部访问容器
> 把 -p 的花样都过一遍

<!-- 讲者备注：【转场】第四幕幕卡。第一幕的 -p 形态落成命令练习, 顺便印证"启动后改不了"。 -->

---

# 固定、随机、本机、多端口

```bash
docker run -d --name web -p 8080:80 nginx
curl localhost:8080                # 固定端口 ✓

docker run -d --name web2 -P nginx
docker ps                          # 看 PORTS 随机端口
curl localhost:那个随机端口        # 能访问 ✓

docker run -d --name web3 -p 127.0.0.1:8081:80 nginx
docker run -d --name multi -p 80:80 -p 8000:80 nginx
```

<!-- 讲者备注：【特写】四款形态一次跑通。顺手验证: 想换映射, 必须 rm 后带新 -p 重建, 启动中改不了。 -->

---
layout: section
---

# 五、实战二
## 容器互联 (作业)
> --link 与自定义网络, 再对比

<!-- 讲者备注：【转场】第五幕幕卡。亲手实现 web 找 db 两种方式, 截图记录, 写进实验报告。 -->

---

# web 找 db: 旧式与推荐各来一遍

```bash
# A: --link
docker run -d --name db --network legacynet mysql:8
docker run -d --name web --network legacynet --link db:db nginx
docker exec -it web cat /etc/hosts    # 有 db 条目
docker exec -it web ping db           # 通 ✓

# B: 自定义网络
docker run -d --name db --network appnet mysql:8
docker run -d --name web --network appnet nginx
docker exec -it web ping db           # 也通 ✓
docker exec -it db getent hosts web   # 双向 ✓
```

<!-- 讲者备注：【特写】两种方式并排跑。A 单向只认 db; B 双向互相认。把 ping 成功与 hosts 内容截图, 对比结论写进报告。 -->

---
layout: section
---

# 六、实战三
## 配置 DNS
> 显式指定与默认对比

<!-- 讲者备注：【转场】第六幕幕卡。小实验: 带 --dns 与不带, 各看 resolv.conf。 -->

---

# 配了显式的, 就听显式的

```bash
docker run -d --name dnsbox \
  --dns 8.8.8.8 --dns-search example.test nginx
docker exec -it dnsbox cat /etc/resolv.conf
# nameserver 8.8.8.8, search example.test

docker run -d --name defaultbox nginx
docker exec -it defaultbox cat /etc/resolv.conf
# 继承宿主机的 nameserver
```

<!-- 讲者备注：【特写】配与不配对比一目了然。显式给的是"容器自己的解析", 不配则跟随宿主机。 -->

---
transition: slide-left
---

# 一张表带走全部要点

| 方面 | 要点 |
|---|---|
| 外部访问 | 启动时 `-p` 映射; `-P` 随机; 可绑地址、可多端口; **启动后改不了** |
| 端口读法 | `-p 前宿主机、后容器`; 写死固定, 不写随机 |
| 容器互联 | `--link`(单向) vs **自定义网络**(双向、DNS) |
| DNS | `--dns` nameserver · `--dns-search` 搜索域 · 不配则继承宿主 |
| 命令 | `-p/-P` · `network create/connect` · `ps` 看 PORTS |

<!-- 讲者备注：【全景】收束全片。外部 -p 开入口, 内部网络按名互联, --dns 定解析。至此容器"既隔离又统一"。 -->

---
transition: slide-left
---

# 容器能连起来了, 可分写进去会"一键清零"

> 下一步: 数据卷与持久化 —— 让容器里的数据不随删除而消失

<!-- 讲者备注：【空镜】悬念收尾。网络通了, 但容器可写层删了就没。下讲引入数据卷, 把"临时"变"有状态"。 -->

---
layout: section
---

# 谢谢大家

Q & A

<!-- 讲者备注：【空镜】片尾致谢, 留提问时间。 -->