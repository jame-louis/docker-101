---
theme: default
title: 案例二 Java Web 应用
info: |
  ## 案例二: 基于 Docker 的 Java Web 应用 教学幻灯片
  Docker 101 第 15 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# 案例二 · 基于 Docker 的 Java Web 应用
## 第 15 讲

<!-- 讲者备注：【空镜】开场钩子。提问: 案例一网站的壳是静态的, 怎么让它变成真正会响应的 Java 应用? 引出"war 上 Tomcat"。 -->

---
transition: slide-left
---

## 目标

把 Java Web 工程打 war、上 Tomcat、跑起来验证

- 四步: 工程 → 打 war → 做 Tomcat 镜像 → 运行验证
- war 即"带 WEB-INF 结构的 ZIP"
- 两种制作途径: COPY 进镜像 vs 挂载 war
- 验证: curl / logs / exec 三件套

<!-- 讲者备注：【全景】总览三幕剧。第一幕准备工程打 war; 第二幕做 Tomcat 镜像; 第三幕运行验证; 收官综合实战。 -->

---
layout: section
---

# 一、把 Java 工程打包成 war
> 装进 webapps 的"集装箱"

<!-- 讲者备注：【转场】第一幕幕卡。war 是 Tomcat 认的部署包, 先讲它是怎么来的。 -->

---

# war = 带 WEB-INF 结构的 ZIP

```
javademo.war
└── WEB-INF/
    ├── web.xml            # servlet 映射
    └── classes/
        └── com/example/HelloServlet.class
```

> Tomcat 把 war 放进 webapps 即自动解压发布

<!-- 讲者备注：【特写】war 结构。war 就是个 ZIP, 关键是里面 WEB-INF 结构。web.xml 负责把 /hello 映射到 Servlet。 -->

---

# 编译 + 打 war

```bash
# ① 容器里编译 Servlet 拿 .class
docker run --rm -v "$PWD":/app -w /app \
  eclipse-temurin:17-jdk \
  javac -d /app/classes /app/HelloServlet.java

# ② 按 WEB-INF 摆放, 打成 war
jar cvf ../javademo.war .

jar tf javademo.war   # 检查: 应有 WEB-INF/web.xml
```

<!-- 讲者备注：【特写】编译打包。javac 要 JDK, 用容器编译到处可复现。jar cvf 从 build/ 打包。 -->

---
layout: section
---

# 二、制作 Tomcat 镜像 (重点)
> war 怎么进镜像

<!-- 讲者备注：【转场】第二幕幕卡。两种途径: 交付用 COPY, 开发用挂载。 -->

---

# 途径A: COPY war 进镜像(交付)

```dockerfile
FROM tomcat:10
COPY javademo.war /usr/local/tomcat/webapps/javademo.war
```

```bash
docker build -t java-web .
docker run -d --name jweb -p 8080:8080 java-web
curl localhost:8080/javademo/hello
```

> war 名即访问路径: javademo.war → /javademo/

<!-- 讲者备注：【特写】途径A。war 固化进镜像, 走到哪都一样, 交付友好。访问路径 = war 名。 -->

---

# 途径B: 运行后挂载 war(开发)

```bash
docker run -d --name jweb -p 8080:8080 \
  -v "$PWD/javademo.war":/usr/local/tomcat/webapps/javademo.war \
  tomcat:10
```

> 改 war 不用重建镜像; 两条路都让 war 落到 webapps

<!-- 讲者备注：【特写】途径B。bind mount 喂 war, 适合开发/临时部署。等价于途径A, 但 war 在外。 -->

---
layout: section
---

# 三、运行并验证 (重点)
> 三件套证明它"活着"

<!-- 讲者备注：【转场】第三幕幕卡。war 进了镜像, 怎么确认它真在容器里跑。 -->

---

# curl / logs / exec 三件套

```bash
docker build -t java-web .
docker run -d --name jweb -p 8080:8080 java-web

# ① HTTP 访问
curl localhost:8080/javademo/hello    # 返回页面

# ② 日志确认部署
docker logs jweb | grep -i deploy     # 看到 Deployed

# ③ 进容器看 webapps
docker exec -it jweb ls /usr/local/tomcat/webapps/
```

<!-- 讲者备注：【特写】验证三件套。curl 会响应 + logs 有 deploy + webapps 有文件 = 运行正常。某一步失败就看 logs。 -->

---

# 404? 先看 logs

```
docker logs jweb
# ... Deploying web application archive javademo.war
# ... Deployed application at context path [/javademo]
```

> 首次部署要几秒; 404 多半 war 没进 webapps 或还在解压

<!-- 讲者备注：【特写】排查。logs 会清楚写 deploy 与 deployed 两阶段。等几秒再访问即可。 -->

---
layout: section
---

# 四、收官实战
## 下载 Tomcat, 部署 war 验证 (作业)
> 全课程综合题

<!-- 讲者备注：【转场】第四幕幕卡。案例收官, 也是课程收官实战。 -->

---

# 一次走通

```bash
docker pull tomcat:10

echo 'FROM tomcat:10' > Dockerfile
echo 'COPY javademo.war /usr/local/tomcat/webapps/javademo.war' >> Dockerfile
docker build -t java-web .
docker run -d --name jweb -p 8080:8080 java-web

docker ps | grep jweb                    # Up
curl localhost:8080/javademo/hello       # 返回页面
docker logs jweb | grep -i deploy        # deployed
docker exec -it jweb ls /usr/local/tomcat/webapps/
```

<!-- 讲者备注：【特写】作业全流程。拉镜像→build→run→curl→logs→exec 一次走通, 每步都截图。 -->

---
transition: slide-left
---

# 一张表带走全部要点

| 方面 | 要点 |
|---|---|
| 目标 | Java 工程→war→Tomcat→运行验证 |
| war | WEB-INF 结构 + web.xml 映射 |
| 制作镜像 | A:COPY 交付 · B:挂载开发 |
| 访问路径 | war 名即路径 |
| 验证 | curl + logs deploy + exec |
| 排查 | 404 → 等部署完 + 看 logs |

<!-- 讲者备注：【全景】收束全片。案例二 = 全课程的"毕业设计"。 -->

---
transition: slide-left
---

# war 上了 Tomcat, 从静态壳到会响应的 Java 应用 — 完整的 Web 应用站住了

> 下一步: 复习 —— 把 16 讲串成一张记忆地图, 为机考与综合实操收尾

<!-- 讲者备注：【空镜】悬念收尾。案例二收官, 下讲复习总收束。 -->

---
layout: section
---

# 谢谢大家

Q & A

<!-- 讲者备注：【空镜】片尾致谢, 留提问时间。 -->