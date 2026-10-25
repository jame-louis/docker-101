---
theme: default
title: 复习
info: |
  ## 全课程复习 教学幻灯片
  Docker 101 第 16 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# 复习 · 全课程总结
## 第 16 讲

<!-- 讲者备注：【空镜】开场钩子。提问: 16 讲下来, 谁来一句话概括这门课在讲什么? 引出"镜像/容器/仓库 + 网络/数据/部署"记忆图。 -->

---
transition: slide-left
---

## 目标

把 16 讲拧成一张记忆地图

- 三大基本概念: 镜像 / 容器 / 仓库
- 网络 · 数据 · 部署 · 综合案例
- 机考/实操: 十步动手 + 排查套路
- 一条主线串起全部

<!-- 讲者备注：【全景】总览四幕。概念→网络数据→部署→综合, 最后给高频考点与排查。 -->

---

# 一图串起全部

```
Dockerfile ──build──> 镜像 ──push/pull──> 仓库
                          │
                run ├─ -p 端口(对外)
                    ├─ --network(互联)
                    └─ -v 数据卷(持久)
                          │
                       容器(隔离进程)
```

> 镜像定义"装什么", 容器决定"怎么跑", 仓库管"分发"

<!-- 讲者备注：【全景】主线图。一句话: 网络让它们连, 数据卷让它们留。 -->

---
layout: section
---

# 一、三大基本概念
> 镜像 · 容器 · 仓库

<!-- 讲者备注：【转场】第一幕幕卡。三块基石逐一回放。 -->

---

# 镜像: 只读模板, Dockerfile 定义

> 分层存储 · 每 COPY/RUN 一层
> 编译型语言用**多阶段构建**把编译器留在构建阶段

```bash
docker build -t myapp .
docker images / rmi / history
```

<!-- 讲者备注：【特写】镜像复习。FROM/WORKDIR/COPY/RUN/ENV/EXPOSE/CMD 一级一级。多阶段=镜像瘦身心法。 -->

---

# 容器: 镜像的运行实例, 隔离进程

| 动作 | 命令 |
|---|---|
| 起&映射 | `run -d -p` |
| 查看 | `ps` / `ps -a` |
| 启停删 | `stop/start/rm` |
| 进容器 | `exec -it` |
| 看日志 | `logs` |

> 生命周期: create→start→stop→rm

<!-- 讲者备注：【特写】容器命令表。namespace 隔离、共享内核是本质。 -->

---

# 仓库: 镜像的存放与分发

> 全名 `[地址]/[命名空间]/[名]:tag`
> push 需 login, 命名空间=自己账号; 本地用 registry:2

```bash
docker login && docker push 用户名/镜像:tag
docker pull 用户名/镜像:tag
```

<!-- 讲者备注：【特写】仓库复习。Registry vs Repository 别混; 全名三段+默认值。 -->

---
layout: section
---

# 二、网络 · 数据 · 部署
> 三大支柱

<!-- 讲者备注：【转场】第二幕幕卡。概念之后, 网络、数据、部署三根支柱。 -->

---

# 网络: 外部 -p, 内部按名连

- 四种模式: bridge(默认) / host / none / container
- **自定义网络带 DNS**: 同网容器名即主机名, 双向解析
- 外部访问靠 `-p 宿主:容器`

```bash
docker network create mynet
docker run --network mynet ...
docker network inspect mynet
```

<!-- 讲者备注：【特写】网络复习。--link 已旧式, 自定义网络是官方推荐互联。 -->

---

# 数据: 别让数据随容器消失

| 方式 | 用途 |
|---|---|
| **Volume** | 生产/有状态, 跨容器共享 |
| **Bind Mount** | 开发, 实时改代码 |
| tmpfs | 内存临时 |

```bash
docker volume create webdata
docker run -v webdata:/app/data ...
docker run -v "$PWD/site":/usr/share/nginx/html ...
```

<!-- 讲者备注：【特写】数据复习。承接"容器可写层删了就没了"。 -->

---
transition: slide-left
---

# 部署: 镜像装环境、代码进镜像、命令写清

| 语言/服务 | 镜像 | 一句话 |
|---|---|---|
| C/C++ | gcc + slim | **多阶段** |
| Java | temurin/tomcat | JDK编译·JRE跑·war上Tomcat |
| Python | python:slim | requirements+0.0.0.0 |
| R | r-base | Rscript+结果导出 |
| Web | httpd/tomcat/nginx | 挂网站配反代 |
| DB | redis/mysql/mongo | 卷+密码+端口 |

<!-- 讲者备注：【全景】部署一览。一门语言一个 Dockerfile, 心法统一。 -->

---
layout: section
---

# 三、综合案例复盘
> 静态站 + Java Web

<!-- 讲者备注：【转场】第三幕幕卡。两案例抽共性, 给收官手感。 -->

---

# 两案同套路

| 步骤 | 案例一(静态) | 案例二(Java) |
|---|---|---|
| 内容 | 静态 HTML | war 包 |
| 镜像 | nginx:alpine + COPY | tomcat + COPY war |
| 说明 | 路径 `/` | 路径 `/war名/` |
| 验证 | curl | curl/logs/exec |
| 改 | mount | mount/build |

> 共性: Dockerfile → build → run → mount → 验证

<!-- 讲者备注：【全景】两案例对照。揭示共同的"五段式"套路。 -->

---
layout: section
---

# 四、机考高频
> 十步动手 + 排查

<!-- 讲者备注：【转场】第四幕幕卡。给应考战术: 记十步 + 记住排查口诀。 -->

---

# 十步动手 + 排查口诀

```
pull → images → build → run -d -p → ps
→ exec → logs → network create → volume -v → rm
```

> 口诀: **外部 -p, 内部网络按名连, 数据不放可写层**

| 现象 | 一查 |
|---|---|
| 反复重启 | docker logs |
| 外部访问不到 | -p 映射? 0.0.0.0? |
| 互联失败 | 同一网络? 用名字? |
| 数据没了 | 忘挂 -v |
| 端口冲突 | 换宿主端口 |

<!-- 讲者备注：【特写】应考秘籍。十步动手逐条顺; 口诀三件事覆盖大多数"部署完能不能用"。 -->

---
transition: slide-left
---

# 一张表带走全部

| 主线 | 一句话 |
|---|---|
| 镜像 | 只读模板, 分层, Dockerfile 定义 |
| 容器 | 隔离进程实例, run/exec/logs |
| 仓库 | 存放与分发, login/push/pull |
| 网络 | -p 外部 · 网络按名连 |
| 数据 | -v 卷 / 挂载, 别丢数据 |
| 部署 | 环境进镜像·代码进镜像·命令写清 |

<!-- 讲者备注：【全景】六级记忆卡片。六行背完, 覆盖全课。 -->

---
transition: slide-left
---

# 学会这三件事, 就能部署一切: 连上、留住、跑起来

> 祝考试顺利! 现在是最从容的收束 —— Q&A + 实战答疑

<!-- 讲者备注：【空镜】收束。把课程落地到一句话能力: 网络连、数据留、镜像跑。留答疑时间。 -->

---
layout: section
---

# 谢谢大家

祝机考顺利 · Q & A

<!-- 讲者备注：【空镜】片尾致谢与祝福。16 讲全片收束。 -->