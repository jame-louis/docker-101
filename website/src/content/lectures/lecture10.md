---
title: 部署语言 C/C++ 与 Java
lectureNumber: 10
draft: false
slidevUrl: slides/lecture10
---
# Docker 部署编程语言·C/C++ 与 Java

## 目标

- 建立"部署 = 用 Dockerfile 把源码 + 运行环境打包成镜像"的整体思路
- 掌握**多阶段构建**（multi-stage build）：在构建镜像里编译，在精简镜像里运行
- **重点**：掌握 Docker 部署 **Java 程序**（JDK/JRE 取舍、编译 java + 打包 jar + 运行）的完整流程
- **知识拓展**：掌握 `ENV` 指令设置环境变量（如 `JAVA_HOME`），理解它与"部署 Java 之前要把环境装好"的关系

---

## 第一部分 部署的思路：镜像里装着"程序 + 环境"

### 1.1 部署到底在做什么

"用 Docker 部署一个程序"，一句话说就是：

> **写一个 Dockerfile，把"程序代码 + 它运行所需要的环境"一起打进镜像，然后用 `docker build` / `docker run` 让它跑起来。**

难点在于：每种语言的"运行环境"不一样，而编译型语言（C/C++、Java）还多一个"先编译"的步骤。学习路径就是：**先在宿主机把程序调通 → 把这个流程写进 Dockerfile → 交给 Docker 自动完成。**

### 1.2 一张路线图

```
Dockerfile(描述构建) --docker build--> 镜像 --docker run--> 运行的容器
     │                                        │
     └ 把"环境+代码+启动命令"打进镜像           └ 环境/依赖已就绪, 只执行
```

---

## 第二部分 部署 C/C++（编译型入门）

### 2.1 C/C++ 部署的难点

C/C++ 编译后是可执行二进制，但这份二进制依赖编译它的**库（libc、头文件）**和**体系结构**。最稳的部署是：**用一个带编译器的基础镜像编译，再把编译产物拷到干净的精简运行时镜像里**——这就是"多阶段构建"。

### 2.2 多阶段构建（Multi-stage build）

一个 Dockerfile 里写多个 `FROM`，只有最后一个 `FROM` 的产物会被保留，前面的阶段都是"工具人"（叫 build stage）。语法核心是 `COPY --from=阶段名`。

```dockerfile
# ===== 阶段一: 编译环境 golang/gcc 等 =====
FROM gcc:12 AS build
WORKDIR /src
COPY . .
RUN gcc -o hello hello.c          # 编译出可执行文件

# ===== 阶段二: 精简运行环境 =====
FROM debian:bookworm-slim
COPY --from=build /src/hello /usr/local/bin/hello
CMD ["hello"]
```

### 2.3 完整小例子：Hello.c

**Hello.c**：

```c
#include <stdio.h>
int main() {
    printf("Hello from C in Docker!\n");
    return 0;
}
```

**Dockerfile**：

```dockerfile
FROM gcc:12 AS build
WORKDIR /src
COPY hello.c .
RUN gcc -o hello hello.c

FROM debian:bookworm-slim
COPY --from=build /src/hello /usr/local/bin/hello
CMD ["hello"]
```

**构建并运行**：

```bash
docker build -t hello-c .
docker run --rm hello-c        # 输出 Hello from C in Docker!
```

> **优势**：最终镜像只有几十 MB（不含编译器），编译所需的 gcc/头文件停留在阶段一，不进最终镜像。这是 C/C++（以及一切需要编译的语言）部署的标准姿势。

---

## 第三部分 部署 Java（重点）

### 3.1 Java 部署要拆成两步看

Java 分"编译"和"运行"：源文件 `.java` 先被 `javac` 编译成字节码 `.class`，再打包成 `.jar`，之后用 JVM 运行。环境上还分 **JDK**（含编译器和 JVM）与 **JRE**（只含运行 JVM）。部署取舍：

| 环境 | 包含 | 用途 |
|---|---|---|
| **JDK** | javac + jvm + 工具 | 编译（构建阶段需要） |
| **JRE** | 只有 jvm | 运行（运行阶段只用它，更小） |

> 现代官方镜像常用 **eclipse-temurin**（OpenJDK 的商业友好发行版）：`eclipse-temurin:17-jdk`（构建）与 `eclipse-temurin:17-jre`（运行）。

### 3.2 Java 部署的两种形态（重点）

**形态 A：源码编译运行**（简单教学用例）

```dockerfile
# 构建阶段
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY Hello.java .
RUN javac Hello.java

# 运行阶段
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/Hello.class .
CMD ["java", "Hello"]
```

```bash
docker build -t hello-java .
docker run --rm hello-java      # 输出 Hello from Java!
```

**形态 B：Maven 打包 jar 再运行**（工程化、重点）

真实 Java 项目用 Maven/Gradle 构建出 `.jar`，再用 JRE 运行。多阶段可以很优雅：

```dockerfile
# 阶段一: 用 maven 镜像装依赖 + 打 jar
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline        # 预下载依赖(缓存层)
COPY src ./src
RUN mvn package -DskipTests           # 产出 target/app.jar

# 阶段二: 用 jre 运行
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

```bash
docker build -t my-java-app .
docker run -d -p 8080:8080 my-java-app
```

> **要点**：构建阶段用 `maven` 镜像，运行阶段只放从上面拷来的 `app.jar` + `jre` → 镜像小、启动快。`COPY pom.xml` 先于 `COPY src` 是为了利用层缓存，依赖不变就不重新下载。

### 3.3 知识拓展：部署 Java 前的 ENV 环境（重点）

Java 程序在编译/运行时往往需要读环境变量，最典型的就是 **`JAVA_HOME`**（JVM 安装路径）和其它配置。这在 Dockerfile 里用 **`ENV`** 指令设置：

```dockerfile
FROM eclipse-temurin:17-jre
ENV JAVA_HOME=/opt/java/openjdk \   # 设 JVM 路径
    APP_HOME=/app                    # 应用配置
ENV TZ=Asia/Shanghai                 # 时区这类运行参数
WORKDIR $APP_HOME
COPY app.jar .
CMD ["java", "-jar", "app.jar"]
```

- **`ENV 键=值`** 设置镜像环境变量，**运行容器时也会带进去**，程序里用 `System.getenv("JAVA_HOME")` 就能读到；
- 有些东西**不该写死在镜像里**（密码、环境标签），用 `docker run -e 键=值` 动态传：

```bash
docker run -e DB_URL=jdbc:mysql://db:3306/app \
  -e JAVA_OPTS="-Xmx512m" my-java-app
```

> **一句话**：`ENV` 把"环境"固化进镜像（编译/运行都要的环境）；`-e` 在运行时按需覆盖（这台机的个性配置）。部署 Java 前想好"哪些环境是公共的、哪些是这台机器独有的"。

---

## 第四部分 实战一：部署一个 C 程序

**目标**：亲手完成 C 程序的**多阶段构建**，感受"编译大镜像、运行小镜像"。

**第 1 步：建目录与源码**

```bash
mkdir -p c-demo && cd c-demo
cat > hello.c <<'EOF'
#include <stdio.h>
int main(){ printf("C in Docker OK\n"); return 0; }
EOF
```

**第 2 步：写多阶段 Dockerfile**

```dockerfile
FROM gcc:12 AS build
WORKDIR /src
COPY hello.c .
RUN gcc -o hello hello.c

FROM debian:bookworm-slim
COPY --from=build /src/hello /usr/local/bin/hello
CMD ["hello"]
```

**第 3 步：构建并运行**

```bash
docker build -t hello-c .
docker run --rm hello-c            # C in Docker OK
docker images                      # 看镜像很小(几十MB, 无编译器)
```

---

## 第五部分 实战二：部署一个 Java jar 应用（作业）

**目标**：走通"源码 → 编译 → jar → 镜像 → 运行"，掌握 Java 的工程化部署，并体验 `ENV` 环境变量。

**第 1 步：一个最小可编译的 Java 工程**

```bash
mkdir -p java-demo/app && cd java-demo
```

**`app/pom.xml`**（最小 Maven 工程）：

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>demo</groupId>
  <artifactId>app</artifactId>
  <version>1.0</version>
  <packaging>jar</packaging>
  <build><finalName>app</finalName></build>
</project>
```

**`app/src/main/java/demo/Hello.java`** 精简版：

```java
package demo;
public class Hello {
    public static void main(String[] a) {
        String who = System.getenv().getOrDefault("WHO", "world");
        System.out.println("Hello " + who + " from Java!");
    }
}
```

**第 2 步：写多阶段 Dockerfile（含 ENV）**

```dockerfile
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre
ENV WHO=world
WORKDIR /app
COPY --from=build /build/target/app.jar app.jar
CMD ["java", "-jar", "app.jar"]
```

**第 3 步：构建与运行**

```bash
docker build -t hello-java .
docker run --rm hello-java            # Hello world from Java!
docker run --rm -e WHO=Docker hello-java   # Hello Docker from Java!
```

> 同一个 jar，靠 `-e` 动态改变 `WHO` → 展示"镜像里的 ENV 默认值 + 运行时可覆盖"。

**第 4 步：观察多阶段的好处**

```bash
docker images | grep hello-java      # 遇很小的 jre 镜像
docker history hello-java            # 看镜像分层: build 阶段的文件没有进最终镜像
```

---

## 第六部分 总结

| 方面 | 要点 |
|---|---|
| 部署思路 | Dockerfile 把 **代码 + 环境** 打成镜像 → build → run |
| 编译型难点 | 产物依赖编译库/架构 → 用**多阶段构建**隔离编译与运行 |
| 多阶段 | 多个 `FROM`，`COPY --from=阶段名` 只把需要的产物带过去，最终镜像精简 |
| C/C++ | gcc 镜像编译 → slim 镜像运行；`COPY --from=build /src/hello ...` |
| Java 环境 | JDK(编译) vs JRE(运行)；官方镜像常用 **eclipse-temurin** |
| Java 部署 | 源码 javac / Maven 打包 jar → jre 运行；`COPY pom.xml` 先行利用层缓存 |
| ENV 环境 | `ENV` 固化进镜像；`docker run -e` 运行时覆盖；`JAVA_HOME` 等典型变量 |

> **一句话点透**：所有"部署语言"是同一套心法——**环境归镜像、代码进镜像、启动命令写清楚**。编译型（C 多阶段、Java 打 jar）只多一个"先编译再拷产物"的步骤。学会了 C 与 Java，其它语言就都是换汤不换药。

## 下一步

下一讲部署 **Python 与 R**：解释型语言省去"显式编译"，多半直接用官方运行时镜像 + `pip install` 依赖，是一条和今天不同的、更"轻"的部署路线。