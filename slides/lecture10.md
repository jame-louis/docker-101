---
theme: default
title: 部署 C/C++ 与 Java
info: |
  ## Docker 部署编程语言(C/C++、Java) 教学幻灯片
  Docker 101 第 10 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# Docker 部署语言 · C/C++ 与 Java
## 第 10 讲

<!-- 讲者备注：【空镜】开场钩子。提问: 一个 C 程序、一个 Java 程序, 凭什么能装进"一个壳"到处跑? 引出"环境+代码打进镜像"。 -->

---
transition: slide-left
---

## 目标

用 Dockerfile, 把程序和环境一起打包成镜像

- 部署心法: **代码 + 环境 → 镜像 → build → run**
- 编译型难点: C 用**多阶段构建**
- Java 部署: JDK/JRE · 打 jar · jre 运行
- 知识拓展: `ENV` 环境变量 + `JAVA_HOME`

<!-- 讲者备注：【全景】总览三幕剧。第一幕部署思路与多阶段; 第二幕 C; 第三幕 Java + ENV; 两个实战。 -->

---
layout: section
---

# 一、部署的心法
> 程序不是裸奔的, 它是"程序+环境"

<!-- 讲者备注：【转场】第一幕幕卡。先建立总纲: 部署 = 把代码和环境打进镜像, 再跑起来。 -->

---

# 部署 = Dockerfile 打三个东西

```
代码(源码/二进制)  +  环境(运行时/依赖)  +  启动命令
            │            │              │
            └────── 写进 Dockerfile ──────┘
                    │
              docker build → 镜像 → run
```

> 难题在"环境", 各语言不一样

<!-- 讲者备注：【全景】部署路线图。C 要编译器先编译, Java 要 JVM, 解释型要运行时。环境是每种语言的重点。 -->

---

# 编译型多一个"先编译"步骤

- C/C++: `.c` → 编译器 → 可执行二进制
- Java: `.java` → javac → `.class` → jar → JVM 运行
- 二进制/字节码**依赖编译时的环境**

> 最稳做法: 在构建镜像里编译, 再拷产物到精简镜像 —— **多阶段构建**

<!-- 讲者备注：【特写】点出编译型与解释型的差别。C 和 Java 都要"先编译", 所以引入多阶段。下一讲 Python/R 是解释型, 轻很多。 -->

---
layout: section
---

# 二、多阶段构建
> 编译的大镜像, 运行瘦下来

<!-- 讲者备注：【转场】第二幕幕卡。多阶段是编译型语言部署的骨架, 先讲清机制。 -->

---

# 一个 Dockerfile 多个 FROM, 只有最后的产物留下

```dockerfile
FROM gcc:12 AS build          # 阶段一: 编译工具人
WORKDIR /src
COPY hello.c .
RUN gcc -o hello hello.c

FROM debian:bookworm-slim     # 阶段二: 精简运行
COPY --from=build /src/hello /usr/local/bin/hello
CMD ["hello"]
```

> `COPY --from=阶段名` 只把编译产物带进最终镜像

<!-- 讲者备注：【特写】多阶段语法。前面 FROM 里编译写测试都行, 只有最后一个 FROM 进最终镜像。C 的最终镜像只有几十 MB, 不含 gcc。 -->

---

# 多阶段的好处: 最终镜像瘦

```
阶段一(build): gcc + 头文件 + 编译产物   →  ~1GB, 不要了
阶段二(runtime): 只放编译好的二进制      →  ~几十MB, 保留
```

> 环境与产物分清, 镜像小而稳

<!-- 讲者备注：【全景】直观对比。build 阶段再大也无所谓, 不进最终镜像是核心理念。所有需要编译的语言通用。 -->

---
layout: section
---

# 三、部署 C 程序
> 一波带走

<!-- 讲者备注：【转场】第三幕幕卡。把多阶段落到 C。 -->

---

# C 部署三连: 编译 → 拷产物 → 运行

```dockerfile
FROM gcc:12 AS build
WORKDIR /src
COPY hello.c .
RUN gcc -o hello hello.c

FROM debian:bookworm-slim
COPY --from=build /src/hello /usr/local/bin/hello
CMD ["hello"]
```

```bash
docker build -t hello-c .
docker run --rm hello-c    # C in Docker OK
```

<!-- 讲者备注：【特写】C 完整例。gcc 编译出二进制, slim 镜像只带二进制运行。libc 依赖由 bookworm 镜像提供。 -->

---
layout: section
---

# 四、部署 Java (重点)
> 先从"中间产物"认清 Java

<!-- 讲者备注：【转场】第四幕幕卡。Java 是重点。第一步先把 Java 的构建链和环境讲清, 才有下文。 -->

---

# Java 也要拆成 编译 + 运行

| 阶段 | 需要 | 干什么 |
|---|---|---|
| 构建 | **JDK**(含 javac) | 编译 .class → 打 jar |
| 运行 | **JRE**(只有JVM) | java -jar 跑起来 |

> 官方镜像: **eclipse-temurin**-17-jdk / -17-jre

<!-- 讲者备注：【全景】JDK vs JRE。构建要 javac 要 JDK, 运行只要 JVM 要 JRE。镜像一分为二, jre 更小。 -->

---

# 形态A: 简单源码编译运行

```dockerfile
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY Hello.java .
RUN javac Hello.java

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/Hello.class .
CMD ["java", "Hello"]
```

<!-- 讲者备注：【特写】最简单教学用例。javac 编译出 .class, jre 直接 java 运行。不含 Maven。 -->

---

# 形态B: Maven 打 jar 再运行 (工程化)

```dockerfile
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline        # 预下载依赖, 用缓存
COPY src ./src
RUN mvn package -DskipTests          # 出 target/app.jar

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

<!-- 讲者备注：【特写】工程化 Java 部署。maven 镜像打 jar, jre 跑 jar。pom.xml 先拷再拷 src, 是为层缓存——依赖没变就不重下。 -->

---
transition: slide-left
---

# 知识拓展: 部署 Java 前的 ENV 环境

```dockerfile
FROM eclipse-temurin:17-jre
ENV JAVA_HOME=/opt/java/openjdk \
    APP_HOME=/app
ENV TZ=Asia/Shanghai
WORKDIR $APP_HOME
COPY app.jar .
CMD ["java", "-jar", "app.jar"]
```

- `ENV` 把环境**固化进镜像**, 容器里也带得进去
- 个性化东西用 `docker run -e` 覆盖

```bash
docker run -e DB_URL=jdbc:mysql://db:3306/app my-java-app
```

<!-- 讲者备注：【特写】ENV 关键。JAVA_HOME 等公共环境写进镜像; 密码、标签这类用 -e 在运行时传。程序的 System.getenv() 都能读到。 -->

---
layout: section
---

# 五、实战一
## 部署 C 程序
> 多阶段一次走通

<!-- 讲者备注：【转场】第五幕幕卡。落地 C。 -->

---

# hello.c 进镜像, 一行命令跑起来

```bash
mkdir -p c-demo && cd c-demo
# hello.c: printf("C in Docker OK")

docker build -t hello-c .
docker run --rm hello-c        # C in Docker OK
docker images                  # 很小, 无编译器
```

<!-- 讲者备注：【特写】C 实战。关键是最后 docker images 看镜像瘦。 -->

---
layout: section
---

# 六、实战二
## 部署 Java jar (作业)
> Maven 打 jar → jre 运行

<!-- 讲者备注：【转场】第六幕幕卡。Java 作业。重点走完多阶段 + ENV。 -->

---

# 一个读环境变量的 Java 应用

```dockerfile
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml . && RUN mvn dependency:go-offline
COPY src ./src && RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre
ENV WHO=world
WORKDIR /app
COPY --from=build /build/target/app.jar app.jar
CMD ["java", "-jar", "app.jar"]
```

```java
// Hello.java
String who = System.getenv().getOrDefault("WHO", "world");
System.out.println("Hello " + who + " from Java!");
```

<!-- 讲者备注：【特写】Java 作业骨架。程序读 WHO 环境变量, Dockerfile 用 ENV 设默认。展示"镜像默认 + 运行覆盖"。 -->

---

# -e 一改, 同一个 jar 另一个说法

```bash
docker build -t hello-java .
docker run --rm hello-java               # Hello world from Java!
docker run --rm -e WHO=Docker hello-java # Hello Docker from Java!
docker images | grep hello-java          # jre 镜像, 很小
docker history hello-java                # 看不到 build 阶段文件
```

<!-- 讲者备注：【特写】验证。同一个 jar 两次运行不同输出 = ENV 被 -e 覆盖。history 证明多阶段没把编译产物带进最终镜像。 -->

---
transition: slide-left
---

# 一张表带走全部要点

| 方面 | 要点 |
|---|---|
| 心法 | **代码 + 环境 → Dockerfile → build → run** |
| 编译型 | 需要"先编译" → **多阶段构建** |
| 多阶段 | 多个 FROM, `COPY --from=` 只带走产物 |
| C | gcc 编译 → slim 运行, 镜像几十MB |
| Java | JDK 编译 / JRE 运行 · Maven 打 jar · eclipse-temurin |
| ENV | `ENV` 固化进镜像 · `-e` 运行时覆盖 · JAVA_HOME |

<!-- 讲者备注：【全景】收束全片。心法统一 + 编译型多一步。 -->

---
transition: slide-left
---

# 编译器重、运行时轻 — 镜像瘦身的心法, 一次学会管一年

> 下一步: 部署 Python 与 R —— 解释型, 没有"显式编译", 用官方运行时镜像 + pip 依赖清单, 更轻更短

<!-- 讲者备注：【空镜】悬念收尾。多阶段是编译型的心法, 下一讲解释型则完全不同。预告 Python/R。 -->

---
layout: section
---

# 谢谢大家

Q & A

<!-- 讲者备注：【空镜】片尾致谢, 留提问时间。 -->