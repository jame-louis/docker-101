---
title: 案例一 测试静态网站
lectureNumber: 14
draft: false
slidevUrl: slides/lecture14
---
# 案例一：在测试中使用 Docker（静态网站）

## 目标

- 理解"用 Docker 做测试"：在隔离、可复现的环境里把网站跑起来并验证，测完即弃
- 掌握给**静态网站**写**初始 Dockerfile**，构建出镜像
- 掌握构建 **Sample 网站镜像** 与 **Tomcat 镜像** 两种形态
- 掌握从镜像构建容器，进入容器**修改网站内容**并验证生效
- 综合运用：镜像、容器、端口映射、bind mount、日志与 exec（前面全部所学）

---

## 第一部分 案例思路：为什么用 Docker 做测试

### 1.1 测试的诉求

想让一个新网站"先看看效果再上线"，最怕的是污染本机或环境不一：
- 本机装错依赖、版本冲突；
- 团队里每台机器环境不同，"在我这是好的"。

**Docker 测试**解决这两点：把"网站 + 它的运行环境"打进镜像，在任何机器上 `build → run` 都得到**同样**的结果；测完 `docker rm` 一弃了之，不碰本机环境。

### 1.2 本案例的三步走

```
① 写 Sample 网站的初始 Dockerfile → ② 构建镜像并跑起来验证 →
③ 从镜像构建容器, 进容器改网站, 再验证
```

每一步都紧扣前面学过的命令（Dockerfile 指令、`build`、`run -p`、`exec`、`logs`、bind mount）。

---

## 第二部分 Sample 网站的初始 Dockerfile

### 2.1 Sample 网站内容

先准备一个"待测试"的静态网站（Simple demo 页面），这里给一个最小站点：

```bash
site/
└── index.html
```

**index.html**：

```html
<!DOCTYPE html>
<html lang="zh">
<head><meta charset="utf-8"><title>Sample Site</title></head>
<body>
  <h1>Sample Static Site</h1>
  <p>Running inside Docker</p>
</body>
</html>
```

### 2.2 初始 Dockerfile（基于 Nginx）

静态网站最省事的宿主是 Nginx，初始 Dockerfile 只需：拉起精简 Nginx → 把网站文件放进站点根目录：

```dockerfile
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
```

> 用 `nginx:alpine`（精简）当基础镜像，`COPY` 把网站文件放进 Nginx 的默认根目录 `/usr/share/nginx/html`。如果网站有更多静态资源，`COPY ./site .` 整目录放进去即可。

### 2.3 一个更"工程化"的初始版本

把网站目录整体拷进去，再用 `EXPOSE` 声明端口、`CMD` 保持 Nginx 前台运行（`nginx:alpine` 镜像默认前台跑，无需手动起进程）：

```dockerfile
FROM nginx:alpine
COPY site/ /usr/share/nginx/html/
EXPOSE 80
```

---

## 第三部分 构建 Sample 网站镜像并测试

### 3.1 构建

```bash
mkdir -p site && cat > site/index.html <<'EOF'
<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>Sample</title></head>
<body><h1>Sample Static Site</h1><p>Running inside Docker</p></body></html>
EOF

cat > Dockerfile <<'EOF'
FROM nginx:alpine
COPY site/ /usr/share/nginx/html/
EOF

docker build -t sample-site .
```

### 3.2 运行容器并"测试"

```bash
docker run -d --name sample -p 8080:80 sample-site
curl http://localhost:8080          # 应返回 Sample 页面
docker logs sample                   # 看访问日志
docker exec -it sample ls /usr/share/nginx/html    # 确认文件在
```

> 测试结论：能返回页面、日志正常，就验证通过。测完可 `docker rm -f sample` 即弃，本机毫无痕迹。

---

## 第四部分 构建 Sample 网站 + Tomcat 镜像

不是所有网站都跑在 Nginx 上。**Java 环境下的静态站（或含 Java 后端的小站）常用 Tomcat 承接**。把网站作为 Web 资源放上 Tomcat，得到"Sample+Tomcat"镜像：

### 4.1 思路：网站= war/webapp，宿主= Tomcat

```dockerfile
FROM tomcat:10
# 把静态站作为 webapp 放进 /usr/local/tomcat/webapps/sample
COPY site/ /usr/local/tomcat/webapps/sample/
```

> webapps 下的目录名 `sample` 即访问路径 `/sample/`（呼应 Web 服务那讲的"目录名=路径"）。

### 4.2 构建并测试

```bash
docker build -t sample-tomcat .
docker run -d --name sample-tomcat -p 8080:8080 sample-tomcat
curl http://localhost:8080/sample/    # 访问到 Sample 页面
```

> **重要**：此时镜像里同时存在 `sample-site`（Nginx 版）和 `sample-tomcat`（Tomcat 版）两个镜像——同一个静态站，不同宿主。这正是"镜像封装环境"的体现。

---

## 第五部分 从镜像构建容器并修改网站

### 5.1 修改思路：改宿主文件 → 用 bind mount 重新喂进去（推荐）

最常用的修改方式：不改镜像，把改动后的网站目录**挂载**进容器立即生效：

```bash
# 修改宿主机上的站点文件
echo '<h1>v2 after edit</h1>' > site/index.html

# 用 bind mount 重启容器
docker rm -f sample
docker run -d --name sample -p 8080:80 \
  -v "$PWD/site":/usr/share/nginx/html \
  sample-site
curl http://localhost:8080       # 显示 v2 after edit
```

### 5.2 修改思路：直接进容器改（演示用）

也能 `docker exec` 进运行中的容器修改网站文件，改完刷页面即看到：

```bash
docker exec -it sample sh
# 容器内:
echo '<h1>edited inside container</h1>' > /usr/share/nginx/html/index.html
exit
curl http://localhost:8080       # 显示 edited inside container
```

> 但容器一删，改的就会丢——所以**长期/正式修改请用 bind mount 或重新 build 镜像**；`exec` 直改只适合临时的快速验证。

### 5.3 完整流程对比（交付用）

| 方式 | 是否建镜像 | 改动持久性 | 适用 |
|---|---|---|---|
| 改后 `docker build` 重建 | 是 | 持久 | 交付/上线 |
| **bind mount 挂载** | 仅首次 | 持久(文件在宿主) | 开发调试 |
| `docker exec` 进容器改 | 否 | **临时**(删容器即丢) | 快速验证 |

---

## 第六部分 实战：完整走一遍"构建→测试→修改→再验证"

**目标**：把本案例从头到尾做通，形成"用 Docker 测试静态网站"的完整工作流，并理解 Nginx 与 Tomcat 两种宿主形态。

**第 1 步：准备 Sample 网站**

```bash
mkdir -p site
echo '<h1>Sample v1</h1>' > site/index.html
```

**第 2 步：写初始 Dockerfile 并构建 Nginx 版**

```bash
cat > Dockerfile <<'EOF'
FROM nginx:alpine
COPY site/ /usr/share/nginx/html/
EOF
docker build -t sample-site .
```

**第 3 步：跑起来测试**

```bash
docker run -d --name sample -p 8080:80 sample-site
curl http://localhost:8080        # Sample v1
docker logs sample                # 看日志
```

**第 4 步：构建 Tomcat 版**

```bash
cat > Dockerfile.tomcat <<'EOF'
FROM tomcat:10
COPY site/ /usr/local/tomcat/webapps/sample/
EOF
docker build -t sample-tomcat -f Dockerfile.tomcat .
docker run -d --name sample-tc -p 8081:8080 sample-tomcat
curl http://localhost:8081/sample/     # 也看到 Sample v1
```

**第 5 步：修改网站并验证生效**

```bash
echo '<h1>Sample v2</h1>' > site/index.html
docker rm -f sample
docker run -d --name sample -p 8080:80 -v "$PWD/site":/usr/share/nginx/html sample-site
curl http://localhost:8080            # Sample v2 —— bind mount 立即生效
docker rm -f sample sample-tc         # 测试完毕, 容器即弃
```

---

## 第七部分 总结

| 方面 | 要点 |
|---|---|
| 案例目标 | 用 Docker 在隔离、可复现环境里**测试**网站，测完即弃，不污染本机 |
| Sample 初始 Dockerfile | `FROM nginx:alpine` + `COPY site/ /usr/share/nginx/html/` |
| 两种宿主 | Nginx（`sample-site`，路径 `/`）与 Tomcat（`sample-tomcat`，路径 `/sample/`） |
| 测试动作 | `docker run -p` → `curl` 验证 → `logs`/`exec` 佐证 |
| 修改网站 | 推荐 **bind mount** 喂新内容、即时生效; 正式用 build; `exec` 直改仅临时 |
| 综合运用 | Dockerfile / build / run -p / exec / logs / bind mount 全打通 |

> **一句话点透**：本案例把所有"零件"拧成一台机器——**Dockerfile 定义"网站+环境" → build 出镜像 → run 起来测试 → 用挂载改内容再测**。将来无论测什么 Web 应用，这都是一套可复现、可丢弃、不留痕的测试姿势。

## 下一步

下一讲**案例二**：基于 Docker 的 **Java Web 应用**——把静态的"壳"换成真正的 Java 工程（打 war 上 Tomcat、跑起来验证），是案例一的进阶版、也是课程的收官实战。