---
title: 案例二 Java Web 应用
lectureNumber: 15
draft: false
slidevUrl: slides/lecture15
---
# 案例二：基于 Docker 的 Java Web 应用

## 目标

- 综合运用：把 Java Web 工程**打包成 war** → 制作 **Tomcat 镜像** → 构建容器 → 运行并验证
- 掌握制作"装好 war 的 Tomcat 镜像"的两种途径：**直接把 war COPY 进镜像** vs **运行容器后挂载/deploy**
- 掌握 `docker build` / `docker run` / `docker exec` 验证"镜像是否在容器里正常运行"
- 完成课程**收官实战**：下载 Tomcat 镜像，部署 war，验证 Java Web 应用可访问

---

## 第一部分 案例目标与总体流程

### 1.1 案例二做什么

上一讲把"静态网站"放上了 Tomcat；这一讲**升级为真正的 Java Web 应用**：一个 Java 工程被编译、打包成 `.war`（Web Application Archive），再交给 Tomcat 跑起来。这是"部署 Java 的典型场景"。

### 1.2 四个步骤

```
① 准备 Java Web 工程 → ② 打包成 war →
③ 制作 Tomcat 镜像(把 war 放进去) → ④ 构建容器, 运行并验证
```

> 每一步都复用前面所学：Dockerfile、webapps 部署目录、端口映射、`exec`/`logs` 验证。

---

## 第二部分 准备 Java Web 工程并打包成 war

### 2.1 一个最小的 Java Web 工程

先造一个最简单的、能出响应的 Java Web 应用（用 Servlet）。需要的结构：

```
javademo/
├── webapp/
│   ├── WEB-INF/
│   │   ├── web.xml
│   │   └── classes/
│   │       └── com/example/HelloServlet.java  (编译后 .class)
│   └── index.jsp
└── ...
```

为让案例自包含、不依赖外部构建工具，我们用一个**纯 Servlet**：编译 `HelloServlet.java` 得到 `.class`，再手工打成 **war**。

**HelloServlet.java**（解码可读源码）：

```java
package com.example;
import javax.servlet.http.*;
import javax.servlet.*;

public class HelloServlet extends HttpServlet {
    public void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws java.io.IOException {
        resp.setContentType("text/html; charset=utf-8");
        resp.getWriter().println("<h1>Java Web 应用跑在 Docker 里</h1>");
    }
}
```

> 为了不把"搭 Maven 工程"变成本讲主线，这里用**手工编译 + 打 war** 的方式演示原理；真实项目再用 Maven 打包（第 10 讲已介绍）。

### 2.2 打包成 war（在容器里编译最省事）

war 本质就是一个带特定目录结构的 **ZIP**。用官方 Maven/或 JDK 容器编译并打包：

```bash
# 方案: 在临时 JDK 容器里编译 Servlet → 拿到 HelloServlet.class
docker run --rm -v "$PWD":/app -w /app \
  eclipse-temurin:17-jdk \
  javac -extdirs /app/dep -d /app/classes /app/HelloServlet.java
```

> 上面用到 `javac`（JDK 的编译器）。`dep` 里放 `servlet-api.jar`（Tomcat 自带，可从 `tomcat/lib` 拷出）。更常见的做法是在宿主机已装好 JDK 直接编译；容器方式的好处是到处可复现。

然后按 webapps 结构摆放并打成 war：

```bash
mkdir -p build/WEB-INF/classes/com/example
cp classes/com/example/HelloServlet.class build/WEB-INF/classes/com/example/
# 写最小 web.xml
cat > build/WEB-INF/web.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee" version="4.0">
  <servlet><servlet-name>hi</servlet-name>
    <servlet-class>com.example.HelloServlet</servlet-class></servlet>
  <servlet-mapping><servlet-name>hi</servlet-name>
    <url-pattern>/hello</url-pattern></servlet-mapping>
</web-app>
EOF

cd build && jar cvf ../javademo.war .   # 打包成 war
```

> `jar cvf xxx.war .` 从 `build/` 里打包出 war。验证结构：`jar tf javademo.war` 应看到 `WEB-INF/web.xml` 与 `WEB-INF/classes/...`。

---

## 第三部分 制作 Tomcat 镜像（重点）

### 3.1 途径 A：把 war COPY 进镜像（推荐，交付友好）

```dockerfile
FROM tomcat:10
COPY javademo.war /usr/local/tomcat/webapps/javademo.war
```

war 一放进 webapps，Tomcat 启动即自动解压发布，访问路径就是 **/javademo**。

```bash
docker build -t java-web .
docker run -d --name jweb -p 8080:8080 java-web
curl http://localhost:8080/javademo/hello    # 返回任务输出的标题
```

### 3.2 途径 B：运行容器后再挂载 war（适合灰测/不改镜像）

```bash
docker run -d --name jweb -p 8080:8080 \
  -v "$PWD/javademo.war":/usr/local/tomcat/webapps/javademo.war \
  tomcat:10
```

> 两种途径都等价：让 war 出现在 **webapps** 下。途径 A 把 war 固化进镜像、走到哪都一样（适合交付）；途径 B 运行时才喂 war、改 war 不用重建镜像（适合开发/临时部署）。

---

## 第四部分 构建容器、运行并验证（重点）

### 4.1 构建镜像并运行

```bash
docker build -t java-web .          # 内含 war
docker run -d --name jweb -p 8080:8080 java-web
docker ps                           # jweb 处于 Up
```

### 4.2 验证"镜像是否在容器里正常运行"

标准验证动作三件套：

```bash
# ① HTTP 访问验证
curl http://localhost:8080/javademo/hello    # 返回页面 = 应用在跑

# ② 日志确认
docker logs jweb | grep -i deploy             # 看到 webapp 已 deploy

# ③ 进入容器确认 war/webapp 在场
docker exec -it jweb ls /usr/local/tomcat/webapps/   # 看到 javademo 目录
```

> 若返回 404：多半 war 没进 webapps 或正在解压（Tomcat 首次部署需几秒），`docker logs` 会给出 `message= Deploying web application archive javademo.war` → `Deployed` 的过程。

---

## 第五部分 实战：Tomcat 部署 war 并验证（作业）

**目标**：下载 Tomcat 镜像，把 Java Web 工程打包成 war 构建容器，并验证镜像在容器中正常运行。

**第 1 步：拉取 Tomcat 镜像**

```bash
docker pull tomcat:10
```

**第 2 步：给你已有的 war 建 Dockerfile 并构建**

```bash
echo 'FROM tomcat:10' > Dockerfile
echo 'COPY javademo.war /usr/local/tomcat/webapps/javademo.war' >> Dockerfile
docker build -t java-web .
```

**第 3 步：运行容器并验证运行正常**

```bash
docker run -d --name jweb -p 8080:8080 java-web
docker ps | grep jweb           # Up
curl http://localhost:8080/javademo/hello   # 返回内容 = 正常
docker logs jweb | grep -i deploy            # 看到 deployed
docker exec -it jweb ls /usr/local/tomcat/webapps/   # javademo 在
```

**第 4 步：方式 B 走一遍（可选）**

```bash
docker run -d --name jweb2 -p 8081:8080 \
  -v "$PWD/javademo.war":/usr/local/tomcat/webapps/javademo.war \
  tomcat:10
curl http://localhost:8081/javademo/hello
```

---

## 第六部分 总结

| 方面 | 要点 |
|---|---|
| 案例目标 | 把 Java Web 工程打成 **war** → 上 **Tomcat** → 运行并验证 |
| 工程→war | 编译 Servlet 得到 `.class` → 按 `WEB-INF` 结构摆放 → `jar cvf xxx.war .` |
| Tomcat 镜像 | 途径A: `COPY war 进 webapps`（交付）; 途径B: `-v` 挂载 war（开发） |
| 访问路径 | war 名即路径: `javademo.war` → `/javademo/` |
| 验证 | `curl` 访问 + `docker logs ... deploy` + `docker exec` 看 webapps |
| 排查 | 404 → 看 logs 部署是否完成; 确认 war 是否在 webapps |

> **一句话点透**：本案例把全课程串成一条线——**Java 工程打成 war → 写进 Tomcat 镜像 → 跑起来用 `curl`/`logs`/`exec` 验证**。前端静态站（案例一）与后端 Java 应用（案例二）都进了 Docker，一个完整的 Web 应用从此可以在任何机器上复现运行。

## 下一步

下一讲**复习**：把 16 讲全部概念、命令、常见实战按"镜像/容器/仓库/网络/数据卷/部署"串成一张记忆地图，为机考与综合实操做最后梳理。