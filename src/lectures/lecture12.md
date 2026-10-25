# Docker 部署 Web 服务（Apache、Tomcat、Nginx）

## 目标

- 理解 Web 服务（中间件）的部署本质上与应用部署一样：选镜像 → 挂配置/网站 → 端口映射
- **重点**：掌握部署 **Apache（httpd）**：改配置、网页根目录、源码挂载
- 掌握部署 **Tomcat**：部署 `war` 包、访问 webapps、manager
- 掌握部署 **Nginx**：静态站点、配置文件挂载、反向代理
- 熟练用"**配置 + 网页/应用挂进容器**"（bind mount）来定制服务，而不是改镜像

---

## 第一部分 Web 服务是什么、怎么部署

### 1.1 三类"耳熟能详"的 Web 服务

| 服务 | 官方镜像 | 一句话定位 |
|---|---|---|
| **Apache** | `httpd` | 最经典的老牌 Web 服务器，静态页 + 模块化 |
| **Tomcat** | `tomcat` | Java 的 servlet 容器，跑 Java Web（war） |
| **Nginx** | `nginx` | 高性能静态服务器 + 反向代理/负载均衡 |

部署它们的思路和前面**完全一致**：拉镜像 → `docker run -p` 映射端口；要定制就**把配置文件、网站目录挂进容器**（bind mount），尽量不改镜像本体。

### 1.2 一个共同的套路

```
docker run -d -p 宿主端口:容器端口  镜像
   └ 定制时再加 -v 挂载(配置/网站/应用)
```

下面三个各看一遍"默认跑起来 + 怎么定制"。

---

## 第二部分 部署 Apache（重点）

### 2.1 默认跑起来

```bash
docker run -d --name my-apache -p 8080:80 httpd:2.4
curl http://localhost:8080      # 显示 It works! 默认页
```

容器内关键路径：
- 网页根目录（DocumentRoot）：`/usr/local/apache2/htdocs`
- 配置文件：`/usr/local/apache2/conf/httpd.conf`

### 2.2 换自己的网站（挂载根目录）

把自己的静态站挂到 DocumentRoot，浏览器立即访问：

```bash
mkdir -p my-site
echo '<h1>My Apache Site</h1>' > my-site/index.html

docker run -d --name my-apache -p 8080:80 \
  -v "$PWD/my-site":/usr/local/apache2/htdocs \
  httpd:2.4
curl http://localhost:8080      # 显示 My Apache Site
```

### 2.3 加配置（挂载 httpd.conf 有关模块/虚拟主机）

改配置通常挂一份宿主上的配置文件覆盖容器默认的：

```bash
# 宿主准备一个自定义 httpd.conf(基于官方默认复制再改)
docker cp my-apache:/usr/local/apache2/conf/httpd.conf ./httpd.conf
# ...在 httpd.conf 里改 ServerName、启用模块...

docker run -d --name my-apache -p 8080:80 \
  -v "$PWD/my-site":/usr/local/apache2/htdocs \
  -v "$PWD/httpd.conf":/usr/local/apache2/conf/httpd.conf \
  httpd:2.4
```

> **要点**：改配置切记要保证 Apache 能加载成功——可先用 `docker exec` 进容器跑 `httpd -t` 校验语法，再重载。

---

## 第三部分 部署 Tomcat

### 3.1 跑起默认 Tomcat

```bash
docker run -d --name my-tomcat -p 8080:8080 tomcat:10
curl http://localhost:8080      # 默认首页
```

容器内关键路径：
- Web 应用部署目录：`/usr/local/tomcat/webapps`（把 `.war` 丢进去即自动部署）
- 配置文件：`/usr/local/tomcat/conf/server.xml`

### 3.2 部署一个 Java Web 应用（war 包）

把 `sample.war` 放进 webapps，Tomcat 自动解压并发布：

```bash
mkdir -p apps && cp sample.war apps/
docker run -d --name my-tomcat -p 8080:8080 \
  -v "$PWD/apps/sample.war":/usr/local/tomcat/webapps/sample.war \
  tomcat:10
curl http://localhost:8080/sample/   # 访问到刚部署的应用
```

> 没有 war 也能先自己造一个最小 `index.html` 目录练手；下一讲案例二专门做 Tomcat 部署 Java Web。

---

## 第四部分 部署 Nginx

### 4.1 静态站点（最常用）

```bash
mkdir -p web && echo '<h1>Nginx Site</h1>' > web/index.html
docker run -d --name my-nginx -p 8080:80 \
  -v "$PWD/web":/usr/share/nginx/html \
  nginx:latest
curl http://localhost:8080      # 显示 Nginx Site
```

容器内关键路径：
- 站点根目录：`/usr/share/nginx/html`
- 配置文件：`/etc/nginx/nginx.conf`（含 `/etc/nginx/conf.d/*.conf`）

### 4.2 自定义配置与反向代理

改配置建议专门放一份自定义 `conf.d` 配置，用挂载覆盖默认的 conf 目录，例如做反向代理把 `/api` 转给一个后端容器：

```bash
cat > proxy.conf <<'EOF'
server {
    listen 80;
    location /api/ {
        proxy_pass http://my-backend:5000/;
    }
    location / {
        root /usr/share/nginx/html;
    }
}
EOF

docker run -d --name my-nginx -p 8080:80 \
  --network mynet \
  -v "$PWD/web":/usr/share/nginx/html \
  -v "$PWD/proxy.conf":/etc/nginx/conf.d/default.conf \
  nginx:latest
```

> Nginx 容器靠 `proxy_pass` 就能充当前端网关，把请求按路径分发给后端容器——这也是"容器互联"的实战应用。

---

## 第五部分 三个怎么选

| 维度 | Apache(httpd) | Tomcat | Nginx |
|---|---|---|---|
| 定位 | 通用 Web 服务器 | Java 应用容器 | 高性能静态 + 反代 |
| 适合 | 静态页、传统虚拟主机 | Java Web / war | 静态站、代理、负载均衡 |
| 站点根目录 | htdocs | webapps(war) | html |
| 配置 | httpd.conf | server.xml | nginx.conf / conf.d |
| 启动检查 | `httpd -t` | 访问 manager | `nginx -t` |

> **一句话选型**：跑 Java Web 用 Tomcat；纯静态或要"代理、负载均衡"用 Nginx；传统 Apache 老项目/需要模块定制时用 Apache。三者都支持"网页/配置挂进容器"，随时换内容不用改镜像。

---

## 第六部分 实战一：Apache + Nginx 各搭一个静态站（作业）

**目标**：分别用 Apache 和 Nginx 跑起一个自己写的静态网站，并通过 bind mount 换内容，掌握"中间件 + 挂载"的定制套路。

**第 1 步：准备一个网站目录**

```bash
mkdir -p my-site && echo '<h1>Hello Web</h1>' > my-site/index.html
```

**第 2 步：Apache 版**

```bash
docker run -d --name my-apache -p 8080:80 \
  -v "$PWD/my-site":/usr/local/apache2/htdocs httpd:2.4
curl http://localhost:8080
```

**第 3 步：Nginx 版**

```bash
docker run -d --name my-nginx -p 8081:80 \
  -v "$PWD/my-site":/usr/share/nginx/html nginx:latest
curl http://localhost:8081
```

**第 4 步：改内容不重建**

```bash
echo '<h1>Changed!</h1>' > my-site/index.html
curl http://localhost:8080   # Apache 也变
curl http://localhost:8081   # Nginx 也变
```

---

## 第七部分 实战二：Tomcat 部署一个 Java Web（预习下一讲案例二）

**目标**：给 Tomcat 挂载一份 `index.html` 当"web 应用"，跑通"war/webapp 目录 → 访问路径"的关系。

**第 1 步：造一个最简单 web app 目录**

```bash
mkdir -p myapp && echo '<h1>Hi Tomcat</h1>' > myapp/index.html
```

**第 2 步：挂到 webapps 并访问**

```bash
docker run -d --name my-tomcat -p 8082:8080 \
  -v "$PWD/myapp":/usr/local/tomcat/webapps/myapp tomcat:10
curl http://localhost:8082/myapp/    # 访问 /myapp 下的首页
```

> webapps 下的目录名即访问路径：文件夹 `myapp` → URL `/myapp/`。下一讲案例二把真正的 war 打进去，流程完全相同。

---

## 第八部分 总结

| 方面 | 要点 |
|---|---|
| 共同套路 | 选镜像 + `-p` 端口 + `-v` 挂配置/网站/应用 |
| Apache | `httpd` · DocumentRoot=htdocs · config=httpd.conf · `httpd -t` 校验 |
| Tomcat | `tomcat` · war 放 **webapps** 自动部署 · 目录名=访问路径 |
| Nginx | `nginx` · 站点=html · 配置=conf.d · `proxy_pass` 做反代 |
| 定制原则 | 尽量**挂载**进容器，不改镜像；换内容即生效 |
| 选型 | Java→Tomcat；静态/代理→Nginx；传统/模块→Apache |

> **一句话点透**：Web 中间件和应用一样，本质是"镜像里装着那个软件的运行环境"，我们把**网站、war、配置文件"喂"给它**（挂载）就行。学会 Apache 的挂载套路，Tomcat、Nginx 只是换了几个路径和配置文件的名称。

## 下一步

下一讲部署**主流数据库**（Redis、MySQL、MongoDB）：有状态服务，讲镜像选型、端口、用户名密码与持久化数据卷——把前面所有知识（网络、持久化）用到数据库上。