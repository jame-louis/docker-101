---
theme: default
title: 部署 Web 服务
info: |
  ## Docker 部署 Web 服务 教学幻灯片
  Docker 101 第 12 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# Docker 部署 Web 服务
## Apache · Tomcat · Nginx

<!-- 讲者备注：【空镜】开场钩子。提问: 三个耳熟能详的服务器软件, 在 Docker 里怎么跑、怎么换网站? 引出"镜像+挂载"套路。 -->

---
transition: slide-left
---

## 目标

中间件也能"镜像 + 挂载"一条龙

- 共同套路: 选镜像 + `-p` 端口 + `-v` 挂载
- Apache(重点): httpd · htdocs · httpd.conf
- Tomcat: war 丢 webapps 自动部署
- Nginx: 静态站 + `proxy_pass` 反代

<!-- 讲者备注：【全景】总览三幕剧。第一幕共同套路与 Apache; 第二幕 Tomcat; 第三幕 Nginx 与选型; 两个实战。 -->

---
layout: section
---

# 一、Web 服务怎么部署
> 和应用一个套路

<!-- 讲者备注：【转场】第一幕幕卡。Web 中间件也是镜像, 部署思路和前面完全一样。 -->

---

# 三种耳熟能详的服务

| 服务 | 官方镜像 | 一句话定位 |
|---|---|---|
| **Apache** | `httpd` | 经典老牌 Web 服务器 |
| **Tomcat** | `tomcat` | Java servlet 容器(war) |
| **Nginx** | `nginx` | 高性能静态 + 反向代理 |

> 都是"拉镜像 + -p 映射 + 挂载定制"

<!-- 讲者备注：【全景】三服务总览。记住关键路径和后缀, 是今天重点。 -->

---

# 换内容不改镜像: 把网站/配置挂进容器

```bash
docker run -d -p 8080:80 镜像
# 定制时再加 -v:
#   -v "$PWD/静态站":/站点根目录
#   -v "$PWD/配置":/配置文件
```

> 镜像只装软件, 内容随时挂在外面

<!-- 讲者备注：【特写】核心方法论。每次只想"这个服务的网站目录、配置文件在哪", 挂上去即可。 -->

---
layout: section
---

# 二、Apache (重点)
> 传统 Web 的元老

<!-- 讲者备注：【转场】第二幕幕卡。Apache 打头阵, 摸清"站点根目录+配置"怎么挂。 -->

---

# 默认跑起来, 看两处路径

```bash
docker run -d --name my-apache -p 8080:80 httpd:2.4
curl localhost:8080        # It works!
```

- 站点根目录: `/usr/local/apache2/htdocs`
- 配置文件: `/usr/local/apache2/conf/httpd.conf`

<!-- 讲者备注：【特写】Apache 极简起跑。记两个关键路径, 就够定制了。 -->

---

# 挂上自己的网站

```bash
mkdir -p my-site && echo '<h1>My Apache</h1>' > my-site/index.html

docker run -d --name my-apache -p 8080:80 \
  -v "$PWD/my-site":/usr/local/apache2/htdocs \
  httpd:2.4
curl localhost:8080        # My Apache
```

> 改宿主文件, 页面随时变

<!-- 讲者备注：【特写】Apache 挂网站。htdocs 即根目录, bind mount 覆盖即可。 -->

---

# 改配置: 挂一份 httpd.conf

```bash
docker cp my-apache:/usr/local/apache2/conf/httpd.conf ./httpd.conf
# 在 httpd.conf 里改 ServerName、开模块...

docker run -d --name my-apache -p 8080:80 \
  -v "$PWD/my-site":/usr/local/apache2/htdocs \
  -v "$PWD/httpd.conf":/usr/local/apache2/conf/httpd.conf \
  httpd:2.4
```

> 改完用 `httpd -t` 校验语法再重载, 别把服务改崩

<!-- 讲者备注：【特写】Apache 配置挂载。改配置前先 docker cp 出来再改, 用 httpd -t 语法检查。 -->

---
layout: section
---

# 三、Tomcat
> Java 应用的家

<!-- 讲者备注：【转场】第三幕幕卡。Tomcat 部署 Java Web, war 是主角。 -->

---

# webapps 丢 war, 自动部署

```bash
docker run -d --name my-tomcat -p 8080:8080 tomcat:10
```

- Web 应用目录: `/usr/local/tomcat/webapps`
- 把 `.war` 放进去 → 自动解压发布

```bash
mkdir -p apps && cp sample.war apps/
docker run -d --name my-tomcat -p 8080:8080 \
  -v "$PWD/apps/sample.war":/usr/local/tomcat/webapps/sample.war \
  tomcat:10
curl localhost:8080/sample/    # 访问刚发布的应用
```

<!-- 讲者备注：【特写】Tomcat 部署 war。webapps 目录名 = 访问路径, war 丢进去自动发布。这是下一讲案例二的核心。 -->

---
layout: section
---

# 四、Nginx
> 静态王者 + 反代

<!-- 讲者备注：【转场】第四幕幕卡。Nginx 静态最快, 还能当网关反代。 -->

---

# 静态站挂 html 根目录

```bash
mkdir -p web && echo '<h1>Nginx Site</h1>' > web/index.html
docker run -d --name my-nginx -p 8080:80 \
  -v "$PWD/web":/usr/share/nginx/html \
  nginx:latest
curl localhost:8080        # Nginx Site
```

- 站点根目录: `/usr/share/nginx/html`
- 配置: `/etc/nginx/conf.d/*.conf`

<!-- 讲者备注：【特写】Nginx 挂静态站。html 是根目录, conf.d 放自定义 server 块。 -->

---

# proxy_pass 当网关, 反向给后端容器

```nginx
location /api/ { proxy_pass http://my-backend:5000/; }
location / { root /usr/share/nginx/html; }
```

```bash
docker run -d --name my-nginx -p 8080:80 \
  --network mynet \
  -v "$PWD/proxy.conf":/etc/nginx/conf.d/default.conf \
  nginx:latest
```

> Nginx 按路径分发请求 = 容器互联的实战

<!-- 讲者备注：【特写】反代实战。proxy_pass 按路径转发, --network 连后端容器。前端网关典型场景。 -->

---

# 一表攻三

| 服务 | 站点根目录 | 配置 | 适合 |
|---|---|---|---|
| Apache | htdocs | httpd.conf | 传统/模块 |
| Tomcat | webapps(war) | server.xml | Java Web |
| Nginx | html | conf.d | 静态/代理 |

> Java→Tomcat; 静态/反代→Nginx; 老项目/模块→Apache

<!-- 讲者备注：【全景】三楼选型。三个路径记清, 选型一句话。 -->

---
layout: section
---

# 五、实战一
## Apache + Nginx 双搭静态站 (作业)
> 一站点, 两个服务器各跑一遍

<!-- 讲者备注：【转场】第五幕幕卡。实战一: 亲手把同一静态站喂给两个中间件。 -->

---

# 一份静态站, 两个服务都吃到

```bash
mkdir -p my-site && echo '<h1>Hello Web</h1>' > my-site/index.html

# Apache
docker run -d --name my-apache -p 8080:80 \
  -v "$PWD/my-site":/usr/local/apache2/htdocs httpd:2.4
curl localhost:8080

# Nginx
docker run -d --name my-nginx -p 8081:80 \
  -v "$PWD/my-site":/usr/share/nginx/html nginx:latest
curl localhost:8081

echo '<h1>Changed!</h1>' > my-site/index.html   # 不必重建
curl localhost:8080  # Apache 变
curl localhost:8081  # Nginx 也变
```

<!-- 讲者备注：【特写】双服务挂同一站。绑定挂载让改内容即时生效, 佐证"改内容不重建"。 -->

---
layout: section
---

# 六、实战二
## Tomcat 挂一个 web 应用
> 预习案例二

<!-- 讲者备注：【转场】第六幕幕卡。Tomcat 练手, 为下讲案例做铺垫。 -->

---

# webapps 目录名 = 访问路径

```bash
mkdir -p myapp && echo '<h1>Hi Tomcat</h1>' > myapp/index.html

docker run -d --name my-tomcat -p 8082:8080 \
  -v "$PWD/myapp":/usr/local/tomcat/webapps/myapp tomcat:10
curl localhost:8082/myapp/    # 访问 /myapp
```

> 文件夹 myapp → URL /myapp/, 下一讲把里面的 war 换成真 Java 应用

<!-- 讲者备注：【特写】Tomcat 路由规律。webapps 下文件夹名即访问路径。预习案例二。 -->

---
transition: slide-left
---

# 一张表带走全部要点

| 方面 | 要点 |
|---|---|
| 套路 | 选镜像 + `-p` 端口 + `-v` 挂配置/网站 |
| Apache | htdocs 根 · httpd.conf · `httpd -t` |
| Tomcat | war 丢 webapps 自动部署 · 目录名=路径 |
| Nginx | html 根 · conf.d · proxy_pass 反代 |
| 定制 | 尽量挂载, 改内容不重建 |
| 选型 | Java→Tomcat; 静态/代理→Nginx; 传统→Apache |

<!-- 讲者备注：【全景】收束全片。中间件 = 软件镜像 + 我们喂进去的网站/配置。 -->

---
transition: slide-left
---

# 网站能挂, 配置能改, 动静只在一挂之间

> 下一步: 部署数据库(Redis、MySQL、MongoDB) —— 有状态服务, 派上用场的是网络与持久化

<!-- 讲者备注：【空镜】悬念收尾。Web 服务收官, 下讲数据库。 -->

---
layout: section
---

# 谢谢大家

Q & A

<!-- 讲者备注：【空镜】片尾致谢, 留提问时间。 -->