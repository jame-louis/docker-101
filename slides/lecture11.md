---
theme: default
title: 部署 Python 与 R
info: |
  ## Docker 部署编程语言(Python、R) 教学幻灯片
  Docker 101 第 11 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# Docker 部署语言 · Python 与 R
## 第 11 讲

<!-- 讲者备注：【空镜】开场钩子。提问: Python、R 部署和昨天的 C/Java 哪里不一样? 引出"解释型没有显式编译, 更轻"。 -->

---
transition: slide-left
---

## 目标

解释型语言, 直接放运行时镜像就跑

- 解释型 vs 编译型: **无显式编译 → 免多阶段**
- Python(重点): 官方镜像 + requirements + CMD
- R: r-base + 装包 + Rscript
- 层缓存顺序: 先装依赖、后放代码

<!-- 讲者备注：【全景】总览三幕剧。第一幕解释型理念; 第二幕 Python; 第三幕 R; 两个实战。 -->

---
layout: section
---

# 一、解释型更"轻"在哪
> 没有编译, 就没有"编译产物"

<!-- 讲者备注：【转场】第一幕幕卡。先回答"为什么今天不用多阶段"。 -->

---

# 编译型要产物, 解释型边解释边跑

```
编译型(C/Java): 源码 --编译--> 产物 --运行时--> 运行
                                   (编译器只在构建镜像)
解释型(Python/R): 源码 -----直接----> 解释器 运行
```

> 所以解释型: 官方运行时镜像 + 源码 + 启动命令, 就够了

<!-- 讲者备注：【全景】两类对比。今天的关键洞察: 没有编译产物, 就不需要多阶段构建那一步。 -->

---

# 解释型部署通用三步

1. 选**官方运行时镜像**: `python` / `r-base`
2. **装依赖**: `requirements.txt`+pip / `install.packages()`
3. 写**启动命令**: `CMD` / `ENTRYPOINT`

> 三部曲, 每个解释型语言都一样

<!-- 讲者备注：【特写】拆解通用流程。语言不同, 步骤同构。 -->

---
layout: section
---

# 二、部署 Python (重点)
> 镜像自带解释器

<!-- 讲者备注：【转场】第二幕幕卡。Python 是重点, 从零依赖到有依赖逐层加。 -->

---

# 一个零依赖脚本就三行

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY hello.py .
CMD ["python", "hello.py"]
```

```bash
docker build -t hello-py .
docker run --rm hello-py    # Hello from Python!
```

<!-- 讲者备注：【特写】极简例。python-slim 精简镜像自带解释器, COPY 脚本 + CMD 启动即可。 -->

---

# 有依赖: requirements.txt 先装、代码后放

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .                     # 先拷依赖清单
RUN pip install --no-cache-dir -r requirements.txt   # 再装
COPY app.py .                               # 最后放代码
EXPOSE 5000
CMD ["python", "app.py"]
```

> 顺序决定**层缓存**: 依赖没变, 就不会重跑 pip

<!-- 讲者备注：【特写】层缓存的关键顺序。若先 COPY 全部代码, 改一行就触发 pip 整层重做。先放 requirements 依赖不变则秒过。 -->

---

# Web 应用记住 host 0.0.0.0

```python
# app.py
from flask import Flask
app = Flask(__name__)
@app.route("/")
def home():
    return "Hello Flask in Docker!"
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
```

> 容器外要能访问, 必须监听 0.0.0.0, 不是 127.0.0.1

<!-- 讲者备注：【特写】抓小坑。默认绑定 127.0.0.1 只在容器内可达, 映射端口对外就失败。0.0.0.0 = 接受所有接口。 -->

---

# ENTRYPOINT 固定入口, CMD 当默认参数

```dockerfile
ENTRYPOINT ["python", "app.py"]   # 入口写死
CMD ["--port", "5000"]            # 默认参数, 运行时能改
```

- `CMD`: 启动命令, 可被 `docker run ... 命令` 覆盖
- `ENTRYPOINT`: 固定的可执行入口

<!-- 讲者备注：【特写】两个指令分工。CMD 好替换, ENTRYPOINT 更刚性。配合用: 入口固定+参数可变。 -->

---
layout: section
---

# 三、部署 R
> 一个 r-base 镜像搞定

<!-- 讲者备注：【转场】第三幕幕卡。R 与 Python 同构, 重点在"结果导出"。 -->

---

# Rscript 跑脚本, 一个镜像出结果

```dockerfile
FROM r-base:4.4
WORKDIR /work
COPY hello.R .
CMD ["Rscript", "hello.R"]
```

```bash
docker build -t hello-r .
docker run --rm hello-r    # [1] "Hello from R!"
```

> 一样是: 镜像 + 装包 + 启动命令

<!-- 讲者备注：【特写】R 的极简例。r-base 自带 R/Rscript, 和 Python 三步一模一样。 -->

---

# 要装 R 包? 装完再把结果交给 -v

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
cat out/top.csv       # 结果落在宿主机
```

<!-- 讲者备注：【特写】R 装包 + 结果导出。数据分析跑完用 -v 把 /out 导到宿主目录, 呼应数据持久化。 -->

---

# Python 与 R 同物一表

| 维度 | Python | R |
|---|---|---|
| 镜像 | `python:3.12-slim` | `r-base` |
| 依赖 | pip + requirements | install.packages() |
| 启动 | `python app.py` | `Rscript xxx.R` |
| 场景 | Web/脚本 | 数据分析/报表 |
| 关键点 | web 绑 0.0.0.0 | 结果 -v 导出 |

<!-- 讲者备注：【全景】两语言对照。结构同构, 只是在镜像/依赖/启动这几栏换词。 -->

---
layout: section
---

# 四、实战一
## 部署 Flask (作业)
> 有依赖的 Python Web

<!-- 讲者备注：【转场】第四幕幕卡。Python 作业落地。 -->

---

# Flask 三步: 清单→安装→放码

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 5000
CMD ["python", "app.py"]
```

```bash
docker build -t flask-app .
docker run -d -p 5000:5000 --name flk flask-app
curl http://localhost:5000    # Hello Flask from Docker
docker logs flk
```

<!-- 讲者备注：【特写】Flask 完整实战。带依赖工程标准 Dockerfile + 运行验证。 -->

---
layout: section
---

# 五、实战二
## R 分析出报表
> 容器算, 结果进宿主

<!-- 讲者备注：【转场】第五幕幕卡。R 实战收官, 数据导出是重点。 -->

---

# 算完把结果挂出来

```r
# analyze.r
library(dplyr)
df <- data.frame(name=c("alice","bob"), score=c(90,85))
write.csv(df %>% filter(score > 80), "/out/top.csv", row.names=FALSE)
```

```bash
mkdir -p out
docker run --rm -v "$PWD/out":/out hello-r
cat out/top.csv      # alice,90  bob,85 —— 在宿主机
```

<!-- 讲者备注：【特写】R 全流程。容器跑分析写 /out, -v 导出到宿主机 out/, 容器用完即弃。 -->

---
transition: slide-left
---

# 一张表带走全部要点

| 方面 | 要点 |
|---|---|
| 解释型 | 无显式编译 → **免多阶段**, 直接运行时镜像 |
| 三步 | 官方镜像 + 装依赖 + 启动命令 |
| Python | requirements 先+code 后(**层缓存**) · 0.0.0.0 |
| R | r-base + install.packages + Rscript |
| 导出 | R 结果 -v 到宿主 |
| 命令 | CMD 可覆盖 · ENTRYPOINT 固定 |

<!-- 讲者备注：【全景】收束全片。解释型部署 = 昨天心法去掉"编译"这步。 -->

---
transition: slide-left
---

# 解释型的"轻", 是直接把解释器装进镜像

> 下一步: 部署 Web 服务(Apache、Tomcat、Nginx) —— 中间件类镜像, 讲怎么选、怎么配、怎么挂网站

<!-- 讲者备注：【空镜】悬念收尾。语言部署收官, 下讲 Web 服务中间件。 -->

---
layout: section
---

# 谢谢大家

Q & A

<!-- 讲者备注：【空镜】片尾致谢, 留提问时间。 -->