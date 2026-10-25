---
theme: default
title: 案例一 测试静态网站
info: |
  ## 案例一: 用 Docker 测试静态网站 教学幻灯片
  Docker 101 第 14 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# 案例一 · 用 Docker 测试静态网站
## 第 14 讲

<!-- 讲者备注：【空镜】开场钩子。提问: 网站做出来想先让人看效果, 又不想弄脏本机, 怎么破? 引出"Docker 隔离测试、测完即弃"。 -->

---
transition: slide-left
---

## 目标

把一套静态站在 Docker 里"测明白", 不留痕

- 测试诉求: 隔离、可复现、测完即弃
- Sample 初始 Dockerfile: `nginx:alpine` + COPY
- 两种宿主: Nginx 镜像 vs **Tomcat 镜像**
- 从镜像建容器, 改网站再验证

<!-- 讲者备注：【全景】总览三幕剧。第一幕为什么用 Docker 测试; 第二幕 Sample Dockerfile + 构建测试; 第三幕 Tomcat 版 + 改网站; 一个完整实战。 -->

---
layout: section
---

# 一、为什么用 Docker 测
> 试错不弄脏本机

<!-- 讲者备注：【转场】第一幕幕卡。先讲清测试诉求, 再讲实现。 -->

---

# 测试怕两件事: 污染本机、环境不一

- 装错依赖、版本冲突, 后患无穷
- "在我这是好的" —— 团队每台机器都不一

> Docker 把"网站+环境"打包: 走到哪都一样, 测完即弃

<!-- 讲者备注：【特写】测试痛点。Docker 的隔离 + 可复现正好对症。 -->

---

# 案例三步走

```
① 写 Sample 初始 Dockerfile
② 构建镜像, 跑起来并验证(curl)
③ 从镜像建容器, 改网站, 再验证
```

> 每步都用前面学过的命令, 是本课程"综合题"

<!-- 讲者备注：【全景】路线图。三步几乎含盖 Dockerfile/build/run/exec/logs/mount。 -->

---
layout: section
---

# 二、Sample 的初始 Dockerfile
> 静态站, Nginx 最省事

<!-- 讲者备注：【转场】第二幕幕卡。给静态站写初始 Dockerfile。 -->

---

# 两行搞定: 拉起 Nginx, 放进网站文件

```dockerfile
# site/index.html 已在本地
FROM nginx:alpine
COPY site/ /usr/share/nginx/html/
EXPOSE 80
```

> `COPY site/` 把整个静态站放进 Nginx 默认根目录

<!-- 讲者备注：【特写】初始 Dockerfile。用精简 nginx:alpine 当宿主, COPY 网站目录进根目录。EXPOSE 声明端口。 -->

---
layout: section
---

# 三、构建并测试 Sample 网站
> build → run → curl

<!-- 讲者备注：【转场】第三幕幕卡。把 Dockerfile 变成运行中的测试环境。 -->

---

# 一条龙验证

```bash
docker build -t sample-site .
docker run -d --name sample -p 8080:80 sample-site
curl localhost:8080        # 返回 Sample 页面 ✓
docker logs sample         # 看访问日志
docker exec -it sample ls /usr/share/nginx/html   # 文件在
```

> 能返回页面 + 日志正常 = 测试通过

<!-- 讲者备注：【特写】测试动作。curl 验页面、logs 佐证、exec 确认文件。测完 rm 即弃不污染本机。 -->

---
layout: section
---

# 四、Sample + Tomcat 镜像
> 换了块"宿主"

<!-- 讲者备注：【转场】第四幕幕卡。静态站也能放 Tomcat 上, 得到第二种形态。 -->

---

# 网站作为 webapp 放进 Tomcat

```dockerfile
FROM tomcat:10
COPY site/ /usr/local/tomcat/webapps/sample/
```

```bash
docker build -t sample-tomcat .
docker run -d --name sample-tc -p 8080:8080 sample-tomcat
curl localhost:8080/sample/    # 访问到 Sample
```

> webapps 下的目录名 = 访问路径(/sample/)

<!-- 讲者备注：【特写】Tomcat 版。webapps 目录名即 URL 路径, 呼应 Web 服务讲。同一个站, 两个镜像两种宿主。 -->

---
layout: section
---

# 五、从镜像建容器, 改网站
> 修改有三条路

<!-- 讲者备注：【转场】第五幕幕卡。网站要改, 哪种方式最合理? 讲修改的三种姿势。 -->

---

# 改网站: 从 bind mount 到 exec

```bash
# ① bind mount(推荐): 改宿主文件, 挂进去即时生效
echo '<h1>v2</h1>' > site/index.html
docker run -d --name sample -p 8080:80 \
  -v "$PWD/site":/usr/share/nginx/html sample-site
curl localhost:8080        # v2

# ② exec 直改: 进容器临时改(删容器就丢)
docker exec -it sample sh -c \
  'echo hi > /usr/share/nginx/html/index.html'
```

> 长期修改用 mount / 重建; exec 只配临时验证

<!-- 讲者备注：【特写】修改三选一。bind mount 持久且即效; exec 快但容器删了也没了; 正式交付用 build 重建。 -->

---

# 三路对比

| 方式 | 持久 | 适用 |
|---|---|---|
| 改后 `build` 重建 | ✓ | 交付/上线 |
| **bind mount** | ✓ | 开发调试 |
| `exec` 直改 | ✗ 删即丢 | 快速验证 |

> 结论: 要持久用 mount 或 build, exec 只在应急

<!-- 讲者备注：【全景】修改方式对照。交给学生一把选择尺。 -->

---
layout: section
---

# 六、完整实战
## 静态站测试收官
> 构建→测试→改→再测, 一次走通

<!-- 讲者备注：【转场】第六幕幕卡。把全程串成一条流畅的工作流。 -->

---

# 一次走到底

```bash
mkdir -p site && echo '<h1>Sample v1</h1>' > site/index.html

echo 'FROM nginx:alpine' > Dockerfile
cat >> Dockerfile <<'EOF'
COPY site/ /usr/share/nginx/html/
EOF
docker build -t sample-site .
docker run -d --name sample -p 8080:80 sample-site
curl localhost:8080        # Sample v1

echo '<h1>Sample v2</h1>' > site/index.html
docker rm -f sample
docker run -d --name sample -p 8080:80 \
  -v "$PWD/site":/usr/share/nginx/html sample-site
curl localhost:8080        # Sample v2 —— 无 build 即变
docker rm -f sample        # 测试完毕, 即弃
```

<!-- 讲者备注：【特写】完整工作流。v1→mount 改→v2, 全程无需重建镜像。演示"用 mount 改内容"的威力。 -->

---
transition: slide-left
---

# 一张表带走全部要点

| 方面 | 要点 |
|---|---|
| 测试诉求 | 隔离、可复现、**测完即弃** |
| 初始 Dockerfile | `nginx:alpine` + `COPY site/` 进根目录 |
| 两种宿主 | Nginx(`/`) vs Tomcat(`/sample/`) |
| 测试动作 | run -p → curl → logs/exec 佐证 |
| 改网站 | **bind mount**即时 · build 交付 · exec 应急 |
| 综合 | Dockerfile/build/run/exec/logs/mount 全打通 |

<!-- 讲者备注：【全景】收束全片。把学过的命令拧成一台"测试机器"。 -->

---
transition: slide-left
---

# 静态站测明白了, 下一步给网站装个"Java 引擎"

> 下一步: 案例二 —— 基于 Docker 的 Java Web 应用, 把这个壳替换成真正的 war 工程

<!-- 讲者备注：【空镜】悬念收尾。案例一收官, 案例二把静态壳换成 Java Web。 -->

---
layout: section
---

# 谢谢大家

Q & A

<!-- 讲者备注：【空镜】片尾致谢, 留提问时间。 -->