---
theme: default
title: 镜像仓库 Registry
info: |
  ## 镜像仓库 Registry 教学幻灯片
  Docker 101 第 6 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# 镜像仓库 Registry
## 第 6 讲

<!-- 讲者备注：【空镜】开场钩子。提问: 本机构建好的镜像, 怎么让别的机器/队友拿到? 引出"仓库=存图和发图的图书馆"。 -->

---
transition: slide-left
---

## 目标

让镜像跨机器、跨团队地流动起来

- 厘清:Registry(仓库) vs Repository(仓储) 的区别
- 读懂镜像**全名**: 三部分分段 + 默认值
- Docker Hub 闭环:`build → tag → login → push → pull → run`
- 用 `registry` 镜像**一行起飞**本地私有仓库

<!-- 讲者备注：【全景】总览三幕剧。第一幕认识仓库与全名; 第二幕 Docker Hub; 第三幕本地私有仓库; 两个实战走闭环。 -->

---
layout: section
---

# 一、什么是镜像仓库
> 存放并分发镜像的"图书馆", 命名靠全名

<!-- 讲者备注：【转场】第一幕幕卡。立起"仓库=存图图书馆"的比喻, 本幕讲 Registry/Repository、全名与公私取舍。 -->

---

# Registry 是"店", Repository 是"货架上的一个 App"

| 概念 | 中文 | 作用 | 类比 |
|---|---|---|---|
| **Registry** | 镜像仓库/注册中心 | 存放分发镜像的**服务器** | 应用商店 |
| **Repository** | 仓储/命名空间项目 | 仓库里按名组织的一个镜像集合 | 商店里的一个 App |

```
Registry(一台服务器)
├── repository: nginx  → 多个 tag: 1.25 / 1.26 / latest
├── repository: alpine
└── repository: 你的镜像名
```

<!-- 讲者备注：【全景】两词常被混用, 必须分清: Registry是服务, Repository是里面的项目。Docker Hub 是最著名公共 Registry。 -->

---

# 镜像全名, 其实是三段式地址

```
[仓库地址]/[命名空间]/[镜像名]:[标签]
registry   /  owner   /  repo  :  tag
docker.io/library/python:3.12-slim
```

| 部分 | 可省略? | 默认值 |
|---|---|---|
| 仓库地址 | 是 | `docker.io`(Docker Hub) |
| 命名空间 | 是 | `library`(官方空间) |
| 标签 | 是 | `latest` |

> `docker pull python:3.12-slim` ≡ `docker pull docker.io/library/python:3.12-slim`

<!-- 讲者备注：【特写】docker pull 一半工作就是拼全名找对服务器。三段可省略+默认值要记牢, 这是后面推私有仓库的关键。 -->

---

# 为什么需要仓库

| 需求 | 仓库如何满足 |
|---|---|
| 分发 | 不同机器/团队从同一处拉同一份镜像 |
| 备份 | 镜像集中托管, 不易丢 |
| 协作 | 推送即共享, 免去线下拷文件 |
| 版本管理 | 用 tag 管版本、namespace 分归属 |
| 私有化 | 企业自建, 镜像不出内网 |

<!-- 讲者备注：【全景】仓库解决"跨机器、跨团队、跨时间"三类问题。第5条私有化引出下面本地仓库。 -->

---
transition: slide-left
---

# 公共仓库 vs 私有仓库

| 维度 | Docker Hub(公共) | 私有仓库 |
|---|---|---|
| 访问 | 公开, 任人拉取 | 需认证 / 可信网络 |
| 成本 | 公共免费, 私有钱配额 | 自己掌控, 无配额 |
| 安全 | 有被污染风险 | 完全自控, 适内网 |
| 实现 | Docker Hub | Harbor · Nexus · 阿里云 ACR · 本讲 `registry` |

<!-- 讲者备注：【特写】取舍天平。教学/内网/绝密代码场景倒向私有。引出本讲重头戏: 本地 registry。 -->

---
layout: section
---

# 二、Docker Hub 与登录
> 默认公共仓库, 推需登录, 拉公共镜像不用

<!-- 讲者备注：【转场】第二幕幕卡。认识默认公共仓库 Docker Hub, 登录/搜索/命名空间红线三件事。 -->

---

# login 登录 · search 搜镜像

```bash
docker login            # 交互式输入 用户名/密码
docker logout           # 退出登录

docker search nginx                       # 搜官方镜像
docker search --filter=stars=100 alpine   # 按 Star 过滤
```

- 登录凭证存 `~/.docker/config.json`
- 推私有仓库要 login; 拉**公共**镜像不需要

<!-- 讲者备注：【特写】search 返回镜像名/描述/Star/官方标。给出本机没有的镜像也能搜到, 方便发现别人共享的镜像。 -->

---
transition: slide-left
---

# 推送的身份红线：命名空间必须是你自己

```bash
docker push myname/myimg:1.0   # ✅ 命名空间 = 你的账号
docker push ubuntu:1.0         # ❌ 无权推 library/ubuntu
```

> 镜像名里的命名空间 = 你, 才推得进; 否则被拒

<!-- 讲者备注：【特写】最常见的 push 失败原因。命名空间归属权决定能否推送。这也是为何要先 tag 加用户名。 -->

---
layout: section
---

# 三、Docker Hub 
## 推送/拉取完整流程
> build → tag → login → push → 异地 pull → run

<!-- 讲者备注：【转场】第三幕幕卡。给出全片核心闭环六步, 本幕把每一步落到命令。 -->

---
transition: slide-left
---

# 一波操作串起完整闭环

```bash
docker login                                          # ① 登录
docker build -t flask-demo:1.0 .                      # ② 构建
docker tag flask-demo:1.0 jamelouis/flask-demo:1.0    # ③ 加用户名
docker push jamelouis/flask-demo:1.0                   # ④ 推送

# 另一台机器的世界
docker pull jamelouis/flask-demo:1.0                   # ⑤ 拉取
docker run -d -p 5000:5000 jamelouis/flask-demo:1.0    # ⑥ 运行
```

> tag 只加别名不复制数据; 推送按**层**上传, 共享层可跳过

<!-- 讲者备注：【全景】映射 title 的六步闭环。逐层上传体现分层复用; 推成功即任意机器可拉。 -->

---
layout: section
---

# 四、本地私有仓库
> `registry` 镜像一行起飞, 镜像不出内网

<!-- 讲者备注：【转场】第四幕幕卡。公共仓库之外的私有方案: 一行起飞、前缀换目标、卷持久化。 -->

---

# 一行命令起一个私有仓库

```bash
docker pull registry:2
docker run -d --name myregistry -p 5000:5000 registry:2

docker ps                                    # 仓库容器在跑
curl http://localhost:5000/v2/               # 返回 {} 服务正常
```

> 适合: 教学实验 · 内网/离线 · 含私有代码 · 快速迭代

<!-- 讲者备注：【全景】Docker 官方 registry 镜像一条命令即私有仓库。四种适用场景逐个点, 呼应"为什么需要仓库"。 -->

---

# 推到本地：前缀一变, 目标即换

```bash
docker tag flask-demo:1.0 localhost:5000/flask-demo:1.0
docker push localhost:5000/flask-demo:1.0      # 打到本地!

docker rmi localhost:5000/flask-demo:1.0
docker pull localhost:5000/flask-demo:1.0      # 从本地拉回
```

> 全名里"仓库地址"字段的意义在此: 前缀 `localhost:5000/` 即本地

<!-- 讲者备注：【特写】最关键的实操认知: 改镜像名前缀=换仓库服务器。localhost 被 Docker 默认放行可直用。 -->

---
transition: slide-left
---

# 数据持久化: 挂一卷, 删容器数据不丢

```bash
docker run -d --name myregistry -p 5000:5000 \
  -v /opt/registry:/var/lib/registry \
  registry:2
```

- `/var/lib/registry` 是 registry 内部存镜像数据的目录
- 挂到宿主 `/opt/registry`, 删容器再启数据仍在

> 局域网其他主机访问, 需在客户端配 `insecure-registries`(了解即可)

<!-- 讲者备注：【特写】呼应容器讲"数据不持久"的痛点。HTTPS 提示: 生产用 Harbor+HTTPS 更稳; 本讲 localhost 教学即可。 -->

---
layout: section
---

# 五、仓库命令速查
> 一张表记牢 push/pull 的动静

<!-- 讲者备注：【转场】第五幕幕卡。命令收拢成速查表, 分核心(push/pull/tag/rmi)与按需(login/search)。 -->

---
transition: slide-left
---

# 命令一览

| 命令 | 作用 |
|---|---|
| `login` / `logout` | 登录 / 退出仓库 |
| `pull <全名>` | 从仓库拉取(默认 Docker Hub) |
| `push <全名>` | 推送到仓库 |
| `search <关键词>` | 在仓库搜索 |
| `tag <原名> <新名>` | 加别名/命名空间 |
| `rmi` | 删除本地镜像 |
| `curl host:5000/v2/_catalog` | 列本地仓库镜像列表 |

<!-- 讲者备注：【全景】push/pull/tag/rmi 为核心闭眼可打。login/logout/search 按需。_catalog 是本地仓库调试利器。 -->

---
layout: section
---

# 六、实战一
## 推一个镜像到 Docker Hub
> 走通"构建 → 推送 → 异地拉取"真正的完整闭环

<!-- 讲者备注：【转场】第六幕幕卡。实战一: 在公网把闭环一步步跑真, 落在自己账号与镜像页。 -->

---
transition: slide-left
---

# 打上自己的命名空间, 推送, 拉回验证

```bash
cd demo
docker build -t flask-demo:1.0 .          # ① 构建(见 Dockerfile 讲)
docker login                              # ② 登录

docker tag flask-demo:1.0 <你的用户名>/flask-demo:1.0   # ③ 加用户名
docker images                             # ④ 两条同 ID 别名共存

docker push <你的用户名>/flask-demo:1.0   # ⑤ 推送

docker rmi <你的用户名>/flask-demo:1.0    # ⑥ 删本地, 模拟没有它
docker pull <你的用户名>/flask-demo:1.0   # ⑦ 从 Hub 拉回
docker run -d -p 5000:5000 <你的用户名>/flask-demo:1.0
```

<!-- 讲者备注：【全景】③④点透"tag加别名不复制"。⑤逐层 Pushed+digest即成功。⑥⑦验证闭环后, 可去 hub.docker.com 看自己的镜像页。 -->

---
layout: section
---

# 七、实战二：搭建并体验本地私有仓库
> 不碰公网, 亲手推拉, 彻骨理解全名与地址

<!-- 讲者备注：【转场】第七幕幕卡。实战二: 私有仓库闭环 + 卷持久化, 把"地址字段"与"数据卷"参透。 -->

---

# 起仓库 → 推 alpine → 删本地 → 从仓库拉回

```bash
docker run -d --name myregistry -p 5000:5000 \
  -v /opt/registry:/var/lib/registry registry:2   # ① 起仓库
curl http://localhost:5000/v2/_catalog            # ② 空列表 []

docker tag alpine:3.20 localhost:5000/alpine:3.20 # ③ 加本地前缀
docker push localhost:5000/alpine:3.20             # ④ 推进仓库
curl http://localhost:5000/v2/_catalog            # ⑤ 见 "alpine"

docker rmi localhost:5000/alpine:3.20 alpine:3.20 # ⑥ 删本地两镜像
docker pull localhost:5000/alpine:3.20             # ⑦ 从本地拉回
docker run --rm localhost:5000/alpine:3.20 echo "hello"
```

<!-- 讲者备注：【全景】①②验证服务, ③④推到本地, ⑥⑦确认闭环成立。全程不碰公网, 直观看到 _catalog 反映仓库内容。 -->

---

# 数据靠卷幸存: 删仓库容器, alpine 还在

```bash
docker rm -f myregistry                 # ① 删仓库容器
curl -s http://localhost:5000/v2/_catalog | head   # ② 服务停, 访问失败

docker run -d --name myregistry -p 5000:5000 \
  -v /opt/registry:/var/lib/registry registry:2    # ③ 同一卷重建
curl http://localhost:5000/v2/_catalog              # ④ alpine 还在!
```

> 一行束清可选清场: `docker rm -f myregistry ; sudo rm -rf /opt/registry`

<!-- 讲者备注：【特写】④是关键一击: 容器没了数据在, 卷拯救了仓库。呼应容器讲"数据持久化用卷"。 -->

---
transition: slide-left
---

# 一张表带走全部要点

| 方面 | 要点 |
|---|---|
| 仓库 | Registry=服务器的"店", Repository=里面一个"App", 别混 |
| 镜像全名 | `[地址]/[空间]/[名字]:[标签]`, 省略默认 docker.io/library/latest |
| Docker Hub | 推需 login + 命名空间=自己; 拉公共镜像不用 |
| 完整流程 | build → tag → login → push →(异地)pull → run |
| 本地仓库 | `registry:2` 一行起飞; 前缀改 `localhost:5000/` 即推本地; 挂 `/var/lib/registry` 持久化 |

<!-- 讲者备注：【全景】收束全片。顺手把三讲串起来: 镜像=图纸, 容器=房子, 仓库=存图纸的图书馆。 -->

---

# 图纸有了, 房子会盖了, 图纸也流通了

> 下讲: 卷(Volume)、网络(Network)与 Compose 编排——让多容器协作成一套应用

<!-- 讲者备注：【空镜】悬念收尾。三讲讲"单个怎么造出来/跑起来/传出去", 下讲讲"一群怎么配合"。 -->

---
layout: section
---

# 谢谢大家

Q & A

<!-- 讲者备注：【空镜】片尾致谢, 留提问时间。 -->