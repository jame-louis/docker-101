---
title: Dockerfile
lectureNumber: 3
slidevUrl: slides/lecture03
draft: false
---

## 第一部分 Dockerfile 基本结构（难点）

### 1.1 什么是 Dockerfile

Dockerfile 是一个**纯文本文件**，包含一系列指令（Instruction），Docker 引擎按顺序逐条执行，自动构建出镜像（Image）。它主要有两个用途：

- **对当前应用的描述**——清晰记录应用及其依赖；
- **指导 Docker 完成应用的容器化**——将应用打包为镜像。

Dockerfile 能实现开发和部署两个过程的无缝切换，要像重视代码一样重视它，并将其**纳入版本控制系统**。

### 1.2 命名与位置

- 文件名必须为 `Dockerfile`（大写 D），不能写成 `dockerfile` 或 `Docker file`；
- 通常放在**构建上下文（Build Context）**的根目录下。构建上下文是指包含应用文件（含 Dockerfile）的目录，`docker build` 会把该目录发送给 Docker 守护进程，`COPY` 只能取这个范围内的文件。

### 1.3 书写规则

| 规则 | 说明 |
|---|---|
| 注释 | 以 `#` 开头的行为注释行 |
| 指令格式 | `INSTRUCTION argument`，每行一条指令 |
| 大小写 | 指令不区分大小写，但**惯例使用大写**以提高可读性 |
| 执行顺序 | `docker build` 按行从上到下顺序执行 |
| 分层构建 | 部分指令（FROM、RUN、COPY）会创建新镜像层，其他指令（EXPOSE、WORKDIR、ENV、ENTRYPOINT 等）只增加元数据 |

**区分原则**：如果指令的作用是向镜像中**增添新的文件或程序**，就会新建镜像层；如果只是告诉 Docker **如何构建或如何运行**应用程序，就只增加镜像的元数据。

### 1.4 基本结构（四个组成部分）

一个典型的 Dockerfile 由以下四部分组成，顺序基本固定：

```dockerfile
# ① 基础镜像（必须是第一条有效指令）
FROM python:3.12-slim

# ② 元信息（维护者、标签）
LABEL maintainer="zhangsan@example.com"

# ③ 构建过程（安装依赖、拷贝文件、配置环境）
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# ④ 启动配置（容器运行时执行什么）
EXPOSE 8000
CMD ["python", "app.py"]
```

| 组成部分 | 作用 | 常用指令 |
|---|---|---|
| 基础镜像 | 指定从哪个镜像开始构建 | `FROM`（唯一必须的第一条指令） |
| 元信息 | 描述镜像作者、版本等 | `LABEL`、`MAINTAINER`（已废弃） |
| 构建过程 | 安装软件、复制代码、设置环境 | `RUN`、`COPY`、`ADD`、`ENV`、`WORKDIR` |
| 启动配置 | 容器启动时执行的命令 | `CMD`、`ENTRYPOINT`、`EXPOSE` |

### 1.5 难点：镜像分层（Layer）与构建缓存

这是 Dockerfile 最核心也最容易被忽视的概念：

- **每条创建文件/程序的指令都会生成一个只读层（layer）**，镜像就是这些层的堆叠；
- **层是可以缓存的**：`docker build` 时，如果某条指令及其之前的指令没有变化，Docker 直接复用缓存，跳过执行；
- **缓存失效会向后传导**：一旦某一层缓存未命中，其后的所有指令都不再使用缓存，必须重新构建。

由此引出两条重要的编写原则：

**原则一：按"变化频率"从低到高排列指令**——变化少的层放前面，变化多的层放后面。

```dockerfile
# 反面教材：先 COPY 全部代码，再装依赖
# 代码每改一行，pip install 的缓存就失效，构建极慢
COPY . .
RUN pip install -r requirements.txt

# 正确写法：依赖清单很少变 → 缓存命中率高；业务代码天天变 → 放最后
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
```

**原则二：能合并的 RUN 尽量合并**，减少层数、减小镜像体积。

```dockerfile
# 反面教材：三层，且中间层残留缓存垃圾
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get clean

# 正确写法：一层搞定，并清理缓存
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
```

---

## 第二部分 Dockerfile 常用指令（重点）

### 2.1 FROM —— 指定基础镜像

```dockerfile
FROM <镜像名>[:<标签>]
```

- 必须是 Dockerfile 中**第一条有效指令**（`ARG` 可以在它之前）；
- 指定构建所基于的父镜像，所有后续操作都在此基础上叠加；
- 推荐使用官方基础镜像，并选择体积较小的镜像（如 `alpine`、`-slim` 变体）；
- 一个 Dockerfile 可以出现多次 `FROM`，用于**多阶段构建**（见 3.6 节）。

```dockerfile
FROM python:3.12-slim
FROM ubuntu:22.04
FROM scratch            # 空镜像，用于运行静态编译的二进制（如 Go）
```

### 2.2 RUN —— 构建时执行命令

```dockerfile
RUN <命令>                              # shell 形式（默认 /bin/sh -c）
RUN ["可执行文件", "参数1", "参数2"]      # exec 形式（JSON 数组，不经过 shell）
```

- 只在**构建镜像时**执行，会创建新的镜像层；
- 每个 RUN 增加一层，应尽量合并指令以减少层数；
- 注意与 `CMD`（容器启动时执行）区分清楚。

```dockerfile
RUN apk add --update nodejs nodejs-npm
RUN pip install --no-cache-dir -r requirements.txt
```

### 2.3 COPY 与 ADD —— 复制文件

```dockerfile
COPY <源路径>... <目标路径>
COPY app.py /app/               # 复制单个文件
COPY . /app                     # 复制构建上下文所有文件（受 .dockerignore 控制）
COPY --chown=www:www . /app     # 复制时指定属主

ADD archive.tar.gz /opt/        # ADD 独有：自动解压本地 tar 包
ADD https://example.com/a.zip /tmp/   # ADD 独有：支持 URL 下载（不推荐）
```

- 两者都会创建新的镜像层；
- `COPY` 会检查被复制文件的 Checksum，文件内容变化则使缓存失效；
- **最佳实践：优先用 COPY**，语义明确；只有需要"自动解压"时才用 ADD。

### 2.4 CMD 与 ENTRYPOINT —— 容器启动命令（重点中的难点）

```dockerfile
CMD ["python", "app.py"]            # 容器默认启动命令，可被 docker run 参数覆盖
ENTRYPOINT ["python", "app.py"]     # 固定入口，docker run 的参数作为它的参数追加
```

| 对比项 | CMD | ENTRYPOINT |
|---|---|---|
| 作用 | 提供**默认**启动命令 | 定义**固定**入口程序 |
| `docker run img echo hi` | 被替换为 `echo hi` | 变成 `python app.py echo hi` |
| 覆盖方式 | 命令行参数直接覆盖 | 需用 `--entrypoint` 参数才能覆盖 |
| 典型用法 | 指定默认参数 | 指定可执行程序 |

补充规则：

- 一个 Dockerfile 只能有一个 `CMD`，若存在多个，只有最后一个生效；
- `CMD` 有三种形式：exec 形式（推荐）、shell 形式、为 ENTRYPOINT 提供默认参数的形式。

常见组合写法（入口固定、参数可换）：

```dockerfile
ENTRYPOINT ["ping"]
CMD ["localhost"]
# docker run img         → ping localhost
# docker run img 8.8.8.8 → ping 8.8.8.8
```

> 推荐统一使用 **exec 形式（JSON 数组）**：信号能正确传递，容器可以正常响应停止信号。shell 形式下 PID 1 是 sh，容易导致信号处理异常。

### 2.5 EXPOSE —— 声明端口

```dockerfile
EXPOSE <端口> [<端口>/<协议>...]
EXPOSE 8080
```

- 声明容器运行时监听的网络端口；
- 只记录元数据，**不会创建新的镜像层，也不会自动映射端口**；
- 真正的端口映射靠 `docker run -p 主机端口:容器端口`。

### 2.6 ENV 与 ARG —— 环境变量与构建参数

```dockerfile
ENV APP_ENV=production              # 构建期和运行期都存在
ENV PATH="/usr/local/bin:${PATH}"

ARG VERSION=1.0                     # 只在构建期存在
RUN echo "building version $VERSION"
```

```bash
docker build --build-arg VERSION=2.0 .   # 构建时传入
```

**区别**：`ENV` 会保留到容器运行时；`ARG` 构建完就消失，且可用 `--build-arg` 覆盖。

### 2.7 WORKDIR —— 设置工作目录

```dockerfile
WORKDIR /app       # 相当于 mkdir + cd，后续指令都在该目录下执行
```

- 只记录元数据，不创建新层；
- 永远不要用 `RUN cd /app`：每条 RUN 在独立的层里执行，`cd` 对后续指令无效。

### 2.8 其他常用指令速查

| 指令 | 作用 | 示例 |
|---|---|---|
| `LABEL` | 镜像元数据（键值对） | `LABEL maintainer="user@example.com"` |
| `USER` | 指定运行用户（安全加固） | `USER nginx` |
| `VOLUME` | 创建数据卷挂载点 | `VOLUME /data` |
| `HEALTHCHECK` | 容器健康检查 | `HEALTHCHECK CMD curl -f http://localhost/ \|\| exit 1` |
| `ONBUILD` | 为子镜像设置触发器指令 | `ONBUILD COPY . /app` |
| `SHELL` | 更换默认 shell | `SHELL ["/bin/bash","-c"]` |
| `MAINTAINER` | 维护者信息（已弃用，建议用 LABEL） | `MAINTAINER user@example.com` |

---

## 第三部分 实践教学：编写 Dockerfile 并构建镜像

### 3.1 入门剖析：官方 hello-world 镜像

**官方资源链接：**

- Docker Hub 官方镜像页：https://hub.docker.com/_/hello-world
- 源码仓库（GitHub）：https://github.com/docker-library/hello-world
- Dockerfile 直达链接（linux/amd64）：https://github.com/docker-library/hello-world/blob/master/amd64/hello-world/Dockerfile

**Dockerfile 完整内容**——只有三行，是 Docker 世界最小的镜像之一：

```dockerfile
FROM scratch
COPY hello /
CMD ["/hello"]
```

**逐行解读：**

| 指令 | 含义 |
|---|---|
| `FROM scratch` | 基础镜像是 `scratch`——一个完全为空的镜像，不含任何操作系统文件、没有 shell、没有库 |
| `COPY hello /` | 把构建上下文里的 `hello` 静态编译 C 可执行文件复制到镜像根目录（源码为仓库中的 `hello.c`，提前用 `gcc -static` 编译） |
| `CMD ["/hello"]` | 容器启动时执行 `/hello`，打印 "Hello from Docker!" 后进程退出、容器停止 |

**两个值得强调的点：**

1. **为什么容器跑完就退出？** 镜像基于 `scratch`，里面没有 bash/sh，唯一进程 `/hello` 打印完就结束了——这解释了"hello-world 容器为什么 keep 不住"。
2. **它是"分层 + exec 形式 CMD"的极简范例**：三条指令对应三层，`CMD` 用的是 exec 形式（JSON 数组），与最佳实践完全一致。该镜像还支持 amd64、arm64v8、s390x、riscv64 等十余种架构，每种架构目录下各有一份相同的 Dockerfile。

### 3.2 拓展思考：为什么空的 scratch 镜像能运行 hello？

这是理解"**容器不是虚拟机**"的关键一课，答案分两层。

**第一层：容器共享宿主机的内核，镜像里不需要操作系统。**

- 虚拟机：每个 VM 都要带完整的 Guest OS（含自己的内核），镜像以 GB 计；
- 容器：本质上是宿主机上的一个普通进程，只是用 namespace（隔离）和 cgroups（限资源）包装。**所有容器共用宿主机正在运行的 Linux 内核**，镜像里完全没有内核。

所以 `FROM scratch` 的"空"是指**用户空间为空**（没有 `/bin`、没有库、没有配置文件），但内核从来就不在镜像里——容器启动时直接复用宿主机内核提供的系统调用接口。`hello` 打印文字靠的就是直接向宿主机内核发起 `write` 系统调用。

这也解释了：为什么 hello-world 镜像只有约 13KB；为什么 Linux 镜像不能直接跑在 Windows 宿主机上（内核对不上）。

**第二层：`hello` 是静态编译的，不依赖任何动态库。**

| | 动态链接程序 | 静态链接程序（hello） |
|---|---|---|
| 依赖 | 需要 `/lib64/ld-linux.so`（动态加载器）+ `libc.so.6` 等共享库 | 所有代码（含 C 库）在编译时全部打包进二进制内部 |
| 在 scratch 里 | 启动即报错：找不到加载器 | 内核直接加载，系统调用直达内核，运行无阻 |

官方仓库中 `hello` 的构建方式大致为 `gcc -static -o hello hello.c`，`-static` 把 printf 等 C 库函数静态链入，得到自包含的 ELF 文件。执行流程极简：

```
docker run hello-world
   → 内核 execve("/hello")
   → ELF 直接映射进内存、开始执行
   → write(1, "Hello from Docker!...")   ← 直接对宿主机内核发系统调用
   → 进程退出，容器停止
```

**课堂演示建议**：`ldd hello` 输出 `not a dynamic executable`；对比 `/bin/ls` 的 `ldd` 输出会列出一串 `.so`——如果镜像里没有这些库，`ls` 根本起不来。这就是为什么用 `scratch` 做基础镜像的程序必须静态链接，也是多阶段构建"第二阶段 FROM scratch"能成立的前提。

### 3.3 实战一：Hello World（最简构建体验）

新建文件夹 `hello`，创建 `Dockerfile`：

```dockerfile
FROM alpine
CMD ["echo", "Hello World!"]
```

构建并运行：

```bash
$ docker build -t hello .
$ docker run --rm hello
Hello World!
```

- `-t hello`：为镜像打上标签（名称）；
- `.`：指定构建上下文为当前目录，Docker 会在此目录中寻找 Dockerfile。

### 3.4 实战二：Python Flask Web 应用（完整五步流程）

**第 1 步：准备应用文件**

```
demo/
├── Dockerfile
├── requirements.txt
└── app.py
```

`app.py`：

```python
from flask import Flask
app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello, Docker!"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
```

`requirements.txt`：

```
flask==3.0.3
```

**第 2 步：编写 Dockerfile**

```dockerfile
# 基础镜像：精简版 Python，体积小
FROM python:3.12-slim

# 元信息
LABEL maintainer="teacher@example.com" \
      description="Flask demo image"

# 工作目录
WORKDIR /app

# 先复制依赖清单，利用构建缓存
COPY requirements.txt .

# 安装依赖（合并命令、清理缓存）
RUN pip install --no-cache-dir -r requirements.txt

# 再复制业务代码
COPY app.py .

# 声明端口
EXPOSE 5000

# 启动命令（exec 形式）
CMD ["python", "app.py"]
```

**第 3 步：构建镜像**

```bash
cd demo
docker build -t flask-demo:1.0 .
```

预期输出（关键过程）：

```
[+] Building 12.3s (10/10) FINISHED
 => [1/5] FROM docker.io/library/python:3.12-slim
 => [2/5] WORKDIR /app
 => [3/5] COPY requirements.txt .
 => [4/5] RUN pip install --no-cache-dir -r requirements.txt
 => [5/5] COPY app.py .
 => exporting to image
 => => naming to docker.io/library/flask-demo:1.0
```

**第 4 步：验证镜像**

```bash
docker images                              # 查看镜像是否生成
docker run -d -p 5000:5000 flask-demo:1.0  # 启动容器并映射端口
curl http://localhost:5000                 # 应返回 Hello, Docker!
docker ps                                  # 查看运行中的容器
```

**第 5 步：体验缓存机制（课堂演示亮点）**

修改 `app.py` 后重新构建：

```bash
docker build -t flask-demo:1.0 .
```

观察输出：`pip install` 那一步显示 `CACHED`，秒级完成——因为 `requirements.txt` 没变，缓存直接命中。这就是"依赖层在前、代码层在后"写法带来的收益。

### 3.5 实战三：Node.js Web 应用（Alpine 版）

```dockerfile
# 第1阶段：指定基础镜像
FROM alpine

# 设置维护者信息（元数据）
LABEL maintainer="nigelpoulton@hotmail.com"

# 安装 Node.js 和 npm（会创建新镜像层）
RUN apk add --update nodejs nodejs-npm

# 将应用代码复制到镜像中（会创建新镜像层）
COPY . /src

# 设置工作目录（仅元数据）
WORKDIR /src

# 安装应用依赖（会创建新镜像层）
RUN npm install

# 声明容器监听端口（仅元数据）
EXPOSE 8080

# 设置容器启动入口程序（仅元数据）
ENTRYPOINT ["node", "./app.js"]
```

构建镜像：

```bash
$ docker image build -t web:latest .

# 构建过程输出示例
Step 1/8 : FROM alpine
latest: Pulling from library/alpine
 ---> 76da55c8019d
...
Step 8/8 : ENTRYPOINT node ./app.js
 ---> fc69fdc4c18e
Successfully built fc69fdc4c18e
Successfully tagged web:latest
```

验证并运行：

```bash
# 查看镜像
$ docker image ls
REPO    TAG       IMAGE ID          CREATED           SIZE
web     latest    fc69fdc4c18e      10 seconds ago    64.4MB

# 启动容器
$ docker container run -d \
    --name web1 \
    --publish 8080:8080 \
    web:latest
```

### 3.6 进阶：多阶段构建（进一步压缩镜像）

以 Go 程序为例，编译期需要完整的 SDK（约 1GB），运行期只需要一个二进制文件：

```dockerfile
# 第一阶段：编译
FROM golang:1.22 AS builder
WORKDIR /src
COPY . .
RUN go build -o /bin/server .

# 第二阶段：运行（只拷入编译产物）
FROM scratch
COPY --from=builder /bin/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
```

最终镜像从约 1GB 缩小到几 MB。要点：`AS builder` 给阶段命名，`COPY --from=builder` 跨阶段复制产物；第二阶段能基于 `scratch`，前提正是 3.2 节讲的"静态编译 + 共享宿主机内核"。

### 3.7 docker build 常用参数

| 参数 | 作用 |
|---|---|
| `-t, --tag` | 为镜像指定名称和标签，格式 `name:tag` |
| `-f` | 指定 Dockerfile 路径和名称（默认使用上下文中的 Dockerfile） |
| `--no-cache` | 构建时不使用缓存 |
| `--build-arg` | 设置构建时变量（对应 Dockerfile 中的 ARG） |
| `-q, --quiet` | 静默模式，只输出镜像 ID |
| `-m, --memory` | 设置构建内存上限 |

---

## 第四部分 总结

| 方面 | 要点 |
|---|---|
| 基本结构 | 大写 D 的 Dockerfile，从上到下逐条执行；FROM（基础镜像）→ 元信息 → 构建过程 → CMD/ENTRYPOINT（启动命令） |
| 分层原理 | FROM/RUN/COPY 创建镜像层，其他指令只记录元数据；层可缓存，缓存失效向后传导 |
| 指令重点 | RUN（构建时）vs CMD（运行时）；CMD（可覆盖）vs ENTRYPOINT（固定入口）；COPY 优先于 ADD；ENV（运行期保留）vs ARG（仅构建期） |
| 构建命令 | `docker build -t <镜像名>:<标签> .` → `docker run -p 主机端口:容器端口 <镜像>` |
| 最佳实践 | 合并 RUN 减少层数；不变指令放前面以利用缓存；优先选择 Alpine/slim 小体积基础镜像；CMD/ENTRYPOINT 用 exec 形式 |
| 底层认知 | 容器共享宿主机内核，镜像不含内核；scratch 空镜像能运行程序的前提是静态编译 |
