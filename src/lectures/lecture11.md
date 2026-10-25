# Docker 部署编程语言·Python 与 R

## 目标

- 理解解释型语言部署与编译型（C/C++、Java）的差别：**没有"显式编译"，直接放运行时**
- **重点**：掌握 Docker 部署 **Python 程序**的完整流程（官方镜像、`requirements.txt` 装依赖、启动命令）
- 掌握部署 R 程序：`r-base` 官方镜像 + 安装 R 包 + `Rscript`
- 理解镜像分层与依赖顺序对**构建缓存 / 镜像体积**的影响

---

## 第一部分 解释型语言：比编译型"轻"在哪

### 1.1 关键差别

上一讲的 C/C++、Java 都要"先编译再运行"，所以要**多阶段构建**（把编译器留在构建镜像里）。而 Python、R 是**解释型**语言：运行时的机器直接解释源码、边读边执行，**没有单独的编译产物**。

```
编译型(C/Java):  源码 --编译--> 产物(二进制/jar) --运行时--> 运行
解释型(Python/R):源码 -----------------直接--> 运行时(解释器) 运行
```

因此部署解释型语言，通常**不需要多阶段构建**：直接拿一个官方**运行时镜像**（自带解释器），把源码和依赖清单放进去，最后写清启动命令即可。镜像天然干净。

### 1.2 解释型部署的通用三步

1. **选官方运行时镜像**：`python`、`r-base` 都是官方镜像，自带解释器；
2. **装依赖**：Python 用 `requirements.txt` + `pip install`；R 用 `install.packages()` / `renv`；
3. **写启动命令**：`CMD` / `ENTRYPOINT` 决定容器起来后跑什么。

---

## 第二部分 部署 Python 程序（重点）

### 2.1 官方镜像

- `python:3.12-slim`：精简版，体积小、够用；
- `python:3.12-alpine`：更小，但部分包要编译、可能有兼容问题；
- 生产建议 `-slim` 起步。

### 2.2 从最小例子到依赖管理

**一个最朴素的 Python 脚本**：

```bash
# hello.py
print("Hello from Python in Docker!")
```

**Dockerfile**：

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY hello.py .
CMD ["python", "hello.py"]
```

```bash
docker build -t hello-py .
docker run --rm hello-py        # Hello from Python in Docker!
```

### 2.3 有第三方依赖的工程（重点）

真实项目几乎都有依赖，用 `requirements.txt` 列出，Dockerfile 里 `pip install` 安装：

```bash
# requirements.txt
Flask==3.0.0
```

**app.py**（一个 Flask 小应用）：

```python
from flask import Flask
app = Flask(__name__)

@app.route("/")
def home():
    return "Hello from Flask in Docker!"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
```

**Dockerfile**：

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt   # 先装依赖
COPY app.py .
EXPOSE 5000
CMD ["python", "app.py"]
```

**构建与运行**：

```bash
docker build -t flask-app .
docker run -d -p 5000:5000 flask-app
curl http://localhost:5000     # Hello from Flask in Docker!
```

> **顺序有讲究**：先 `COPY requirements.txt` 再 `RUN pip install`、最后才 `COPY app.py`。因为 **Docker 按层缓存**——依赖没变就不重装；若先拷贝全部代码，改一行代码也会触发整层（含装依赖）重做，卡在 `pip` 上叫苦。运行 web 服务记得 `host="0.0.0.0"`，否则容器外访问不到。

### 2.4 ENTRYPOINT vs CMD（小知识）

- `CMD`：启动命令，可被 `docker run ... 命令` **覆盖**；
- `ENTRYPOINT`：固定的可执行入口，CMD 变成它默认参数。

```dockerfile
ENTRYPOINT ["python", "app.py"]          # 入口固定
CMD ["--port", "5000"]                   # 默认参数, 运行时可改
```

---

## 第三部分 部署 R 程序

### 3.1 官方镜像 r-base

R 的官方运行时镜像是 **r-base**，自带 `R` 与 `Rscript`（命令行运行 R 脚本）。部署思路与 Python 完全同构：放大本体 + 装 R 包 + 用 `Rscript` 启动。

**hello.R**：

```r
print("Hello from R in Docker!")
```

**Dockerfile**：

```dockerfile
FROM r-base:4.4
WORKDIR /work
COPY hello.R .
CMD ["Rscript", "hello.R"]
```

```bash
docker build -t hello-r .
docker run --rm hello-r        # [1] "Hello from R in Docker!"
```

### 3.2 安装 R 包后跑数据分析（了解）

需要第三方 R 包时，先装包再跑分：脚本分析完把结果写到**数据卷/宿主目录**，便于取出（呼应数据持久化）：

```R
# analyze.r
install.packages("dplyr", repos="https://cran.r-project.org")  # 生产请放 Dockerfile 里装
library(dplyr)
write.csv(data.frame(x=1:3, y=4:6), "/out/result.csv")
```

```dockerfile
FROM r-base:4.4
WORKDIR /work
COPY analyze.r .
RUN Rscript -e 'install.packages("dplyr", repos="https://cran.r-project.org")'
CMD ["Rscript", "analyze.r"]
```

```bash
mkdir -p out
docker run --rm -v "$PWD/out":/out hello-r
cat out/result.csv     # 结果落在宿主机
```

> R 常用场景是**数据分析/出报表**：容器跑数、`-v` 把结果导到宿主机，一批工作告一段落容器可弃——很符合"易销毁 + 数据在外"的哲学。

### 3.3 Python 与 R 部署对比

| 维度 | Python | R |
|---|---|---|
| 官方镜像 | `python:3.12-slim` | `r-base` |
| 依赖 | `requirements.txt` + pip | `install.packages()` |
| 启动 | `python app.py` | `Rscript xxx.R` |
| 常用场景 | Web(Flask/FastAPI)、脚本 | 数据分析、出报表 |
| 关键点 | web 要 `host="0.0.0.0"` | 结果用 `-v` 导出 |

---

## 第四部分 实战一：部署一个 Flask Web 应用（作业）

**目标**：把带第三方依赖的 Python Web 应用打进镜像并跑起来，掌握"先装依赖、后放代码"的层缓存写法。

**第 1 步：建目录**

```bash
mkdir -p py-demo && cd py-demo
```

**第 2 步：三个文件**

`requirements.txt`：

```
Flask==3.0.0
```

`app.py`：

```python
from flask import Flask
app = Flask(__name__)
@app.route("/")
def home():
    return "<h1>Hello Flask from Docker</h1>"
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
```

`Dockerfile`：

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 5000
CMD ["python", "app.py"]
```

**第 3 步：构建并访问**

```bash
docker build -t flask-app .
docker run -d -p 5000:5000 --name flk flask-app
curl http://localhost:5000        # 看到 Hello Flask
docker logs flk                   # 看 Flask 访问日志
```

**第 4 步：体会类缓存（可选）**

```bash
# 再次 build, 因 requirements.txt/依赖没变, pip install 这步直接命中缓存, 秒过
docker build -t flask-app .
```

---

## 第五部分 实战二：部署一个 R 脚本把结果写出来

**目标**：用 r-base 跑一段 R 分析，并通过 `-v` 把结果导出到宿主机。

**第 1 步：写 R 脚本**

`analyze.r`：

```r
library(dplyr)
df <- data.frame(name=c("alice","bob"), score=c(90, 85))
write.csv(df %>% filter(score > 80), "/out/top.csv", row.names = FALSE)
```

**第 2 步：Dockerfile（先装包）**

```dockerfile
FROM r-base:4.4
WORKDIR /work
COPY analyze.r .
RUN Rscript -e 'install.packages("dplyr", repos="https://cran.r-project.org")'
CMD ["Rscript", "analyze.r"]
```

**第 3 步：运行并取结果**

```bash
mkdir -p out
docker build -t hello-r .
docker run --rm -v "$PWD/out":/out hello-r
cat out/top.csv      # 结果落在宿主机 out/
```

---

## 第六部分 总结

| 方面 | 要点 |
|---|---|
| 解释型 vs 编译型 | 无"显式编译"→ **不需要多阶段**，直接放运行时镜像 |
| 通用三步 | 官方镜像 + 装依赖 + 写启动命令(CMD/ENTRYPOINT) |
| Python | `python:3.12-slim` · `requirements.txt` + pip · `CMD ["python", "app.py"]` |
| Python Web | 先 `COPY requirements` 再 `pip` 后 `COPY 代码`（**层缓存**）；`host="0.0.0.0"` |
| R | `r-base` · `install.packages()` · `Rscript xxx.R` |
| 结果导出 | R 分析结果用 `-v 宿主:容器/out` 导出到宿主机 |
| 启动命令 | `CMD` 可覆盖 · `ENTRYPOINT` 固定入口 |

> **一句话点透**：今天没有多阶段、没有编译——解释型语言直接把"官方运行时镜像 + 依赖 + 源码 + 启动命令"四件事写进 Dockerfile 就成了。相比昨天的 C/Java，这就是"轻"：镜像更小、构建更快、心智更省。

## 下一步

下一讲部署 **Web 服务**：Apache、Tomcat、Nginx 三个耳熟能详的服务器软件，看看"中间件类镜像"怎么选、怎么配、怎么挂装网站与虚拟主机。