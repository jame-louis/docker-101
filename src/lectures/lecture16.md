# 复习：全课程总结与回顾

## 目标

- 把 16 讲的所有概念、命令、实战串成一张**记忆地图**
- 按"三大基本概念 → 网络 → 数据 → 部署"四条主线横向回顾
- 梳理**机考/综合实操**最常考的动手场景与排查套路
- 完成从"会用命令"到"能独立排查部署"的收束

---

## 第一部分 课程主线图

拿一个"Web 应用 + 数据库"的真实场景，串起全部所学：

```
Dockerfile 写"应用+环境" ──build──> 镜像 ──pull/push──> 仓库(Docker Hub/私有)
                                        │
                              run ├─ -p 端口映射(对外)
                                  ├─ --network 自定义网络(容器互联)
                                  └─ -v 数据卷/绑定挂载(数据持久化)
                                        │
                                  容器(隔离进程, namespace)
```

一句话：**镜像定义"装什么"，容器决定"怎么跑"，仓库管"分分发"，网络让它们连起来，数据卷让它们留得住。**

---

## 第二部分 复习一：三大基本概念（镜像 / 容器 / 仓库）

### 2.1 镜像 Image

- 只读模板、分层存储（`COPY`/`RUN` 每步一层）；用 **Dockerfile** 定义，`docker build` 生成
- 常用指令：`FROM`（基础）、`WORKDIR`、`COPY`、`RUN`、`ENV`、`EXPOSE`、`CMD`/`ENTRYPOINT`（启动）
- **多阶段构建**：编译型语言把编译器留在"构建阶段"，最终镜像只带产物

```bash
docker build -t myapp .      # 构建
docker images                 # 看本地镜像
docker rmi myapp              # 删除
docker history myapp          # 看分层
```

### 2.2 容器 Container

- 镜像的**运行实例**，本质是被隔离的进程（namespace 隔离、共享宿主内核）
- 生命周期：`create → start → stop/start → rm`

```bash
docker run -d --name web -p 8080:80 nginx   # 起&映射
docker ps / -a                # 查看
docker stop / start / rm      # 停止/启动/删除
docker exec -it web sh        # 进容器
docker logs web               # 看日志
```

### 2.3 仓库 Registry

- Registry=服务器，Repository=里面的项目，镜像全名 `[地址]/[命名空间]/[名]:tag`
- Docker Hub 免登录 `pull`，`push` 需 `login` 且命名空间是自己的账号
- 本地私有仓库用 `registry:2` 一行起飞，`-v /var/lib/registry` 持久化

```bash
docker login && docker push 用户名/镜像:tag
docker pull 用户名/镜像:tag
```

---

## 第三部分 复习二：网络

### 3.1 四种模式

| 模式 | 用途 |
|---|---|
| **bridge**（默认） | 容器同处一个局域网，NAT 出口、`-p` 端口映射 |
| **host** | 直接复用宿主网络栈 |
| **none** | 无网络 |
| **container** | 复用另一个容器的网络 |

### 3.2 常用命令与套路

```bash
docker network ls / create / inspect / rm / connect / disconnect
docker run --network mynet ...                        # 接入自定义网
docker run -p 8080:80 ...                             # 端口映射(外部访问)
```

- **自定义网络带内嵌 DNS**：相关容器接进同一网络后，**容器名即主机名**，双向自动解析——这是推荐互联方式（`--link` 已是旧式）。
- 排查网络问题第一步：`docker network inspect <网> | grep -A6 Containers` 看谁在网里、什么 IP。

---

## 第四部分 复习三：数据持久化

### 4.1 容器数据不持久 → 挂载

| 方式 | 用途 |
|---|---|
| **数据卷 Volume** | Docker 管，跨容器共享，生产/有状态数据 |
| **绑定挂载 Bind Mount** | 宿主任意路径，开发调试、实时改代码 |
| tmpfs | 内存临时数据 |

```bash
docker volume create webdata
docker run -v webdata:/app/data ...                  # 卷
docker run -v "$PWD/site":/usr/share/nginx/html ...  # bind mount
docker volume ls / inspect / rm
```

### 4.2 数据库等有状态服务的标配

`-v 数据目录`（持久化）+ `-e 账号密码`（环境变量）+ `-p 默认端口`（对外）。记住三个三元组：

| 库 | 端口 | 数据目录 | 客户端 |
|---|---|---|---|
| Redis | 6379 | /data | redis-cli |
| MySQL | 3306 | /var/lib/mysql | mysql |
| MongoDB | 27017 | /data/db | mongosh |

---

## 第五部分 复习四：部署各种应用

### 5.1 部署心法（三句话）

1. **环境归镜像**：运行环境（解释器/JVM/服务器）由基础镜像提供；
2. **代码进镜像**：源码或产物 `COPY` 进镜像（或开发时 bind mount）；
3. **启动命令写清楚**：`CMD`/`ENTRYPOINT` 决定跑什么。

### 5.2 分语言一览

| 语言/服务 | 镜像 | 要点 |
|---|---|---|
| C/C++ | gcc + slim | **多阶段**：编译在 build 阶段，运行只带二进制 |
| Java | eclipse-temurin / tomcat | JDK 编译 · JRE 跑 jar · war 上 Tomcat |
| Python | python:slim | requirements.txt + pip；先依赖后代码（层缓存）；web 绑 0.0.0.0 |
| R | r-base | install.packages + Rscript；结果 -v 导出 |
| Web 服务 | httpd / tomcat / nginx | 挂网站、挂配置、war 进 webapps |
| 数据库 | redis / mysql / mongo | 数据卷 + 环境变量 + 端口 |

### 5.3 综合案例二连

- **案例一**：静态网站 → `nginx:alpine` + COPY → run → curl 测 → mount 改；
- **案例二**：Java 工程打 war → COPY 进 Tomcat → run → curl/logs/exec 验证。

两案共同套路：**Dockerfile 定义 → build 镜像 → run 容器 → mount 定制 → 验证**。

---

## 第六部分 机考 / 综合实操高频考点

### 6.1 必会的"十步动手"

```
1. docker pull 拉镜像 / docker images 看本地
2. docker build -t 名 .    (会写简单 Dockerfile: FROM/COPY/RUN/EXPOSE/CMD)
3. docker run -d -p 宿主:容器 --name 名 镜像
4. docker ps / -a 查状态
5. docker exec -it 名 sh|bash  进容器
6. docker logs 名 看日志
7. docker network create 名 + --network 互联
8. docker volume create 名 + -v 挂载持久化
9. docker stop / rm 清理
10. docker compose / 多容器: 相关服务进同一网络 + Nginx反代
```

### 6.2 高频排查套路

| 现象 | 一查 |
|---|---|
| 容器反复重启 | `docker logs` 看启动报错 |
| 外部访问不到 | `-p` 映射了吗? 服务监听 0.0.0.0 了吗? `docker ps` 看 PORTS |
| 容器互联失败 | 是否同一自定义网络? 用 `--network` + 容器名访问 |
| 数据一删就没 | 数据忘挂卷 → 加 `-v` |
| 端口冲突 | 换宿主端口, 如 `-p 3307:3306` |

### 6.3 调度口诀

> **外部 `-p`、内部网络按名连、数据不放可写层**——这三件事各只用一条命令记忆，就能覆盖绝大多数"部署完能不能用"的检验。

---

## 第七部分 总结与收束

| 主线 | 一句话 | 代表命令 |
|---|---|---|
| 镜像 | 只读模板，Dockerfile 定义 | `docker build -t 名 .` |
| 容器 | 镜像的隔离进程实例 | `docker run -p` / `exec` / `logs` |
| 仓库 | 镜像的存放与分发 | `login` / `push` / `pull` |
| 网络 | 让容器互联、对外暴露 | `network create` / `-p` |
| 数据 | 别让数据随容器消失 | `-v` / `docker volume` |
| 部署 | 镜像装环境、代码进镜像、命令写清 | 一门语言一个 Dockerfile |

> **最终一句话**：整门课就是"**把应用连同环境装进镜像，用容器把它隔离地跑起来，用仓库分发，用网络连接，用数据卷留住**"。能对着一个真实应用独立走通 Docker 这条链，就掌握了云平台开发的容器化基础。

祝大家机考顺利，从容实操！