---
theme: default
title: Docker 数据卷与持久化
info: |
  ## Docker 持久化存储与数据共享 教学幻灯片
  Docker 101 第 9 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# Docker 数据卷与持久化
## 第 9 讲

<!-- 讲者备注：【空镜】开场钩子。提问: 上讲的数据库容器把数据写在容器里, 一删就没了怎么行? 引出"把数据挂到容器外面"。 -->

---
transition: slide-left
---

## 目标

让容器的"易销毁"也不再丢数据

- 数据痛点: 可写层 **随容器销毁而消失**
- 三种方式: Volume / Bind Mount / tmpfs
- 数据卷命令:`create / ls / inspect / rm`
- **热开发**: 挂源码目录, 改代码即时生效

<!-- 讲者备注：【全景】总览三幕剧。第一幕数据痛点与三种方式; 第二幕数据卷与绑定挂载; 第三幕共享与热开发; 两个实战。 -->

---
layout: section
---

# 一、数据为什么不持久
> 可写层随容器没了

<!-- 讲者备注：【转场】第一幕幕卡。先讲清痛点根源, 再给解药, 学生才记得住为什么需要卷。 -->

---

# 容器删了, 写在里面的数据也一起没了

```bash
docker run -d --name web -p 8080:80 nginx
docker exec -it web bash \
  -c 'echo hello > /usr/share/nginx/html/a.txt'
docker rm -f web          # 删容器
docker run -d --name web2 -p 8080:80 nginx
curl localhost:8080/a.txt  # 404! a.txt 没了
```

> 可写层 = 容器专属, 容器没了它就没了

<!-- 讲者备注：【特写】真实演示"一删全没"。这是新手最大的坑。数据库这类有状态应用绝不能接受, 于是需要把数据请出可写层。 -->

---

# 三招把数据"请出"可写层

| 方式 | 挂载源 | 用途 |
|---|---|---|
| **Volume** | Docker管理的位置 | DB、有状态数据 |
| **Bind Mount** | 宿主机任意目录 | 开发调试、传配置 |
| **tmpfs** | 内存 | 临时敏感数据 |

> 共同点: 把宿主机侧的存储, mount 进容器某个目录

<!-- 讲者备注：【全景】三种方式总览。核心思想一致: 数据存到容器之外, 容器只当"运行者"。 -->

---
layout: section
---

# 二、数据卷 Volume
> Docker 管的"外置硬盘"

<!-- 讲者备注：【转场】第二幕幕卡。第一招: 让 Docker 帮你管一块存储, 独立于容器而存在。 -->

---

# volume 是独立于容器的外部存储

```bash
docker volume create mydata     # 建卷
docker volume ls                # 列卷
docker volume inspect mydata    # 看细节(Mountpoint)
docker volume rm mydata         # 删卷
```

> 容器删除后卷还在, 挂上同一卷数据就回来

<!-- 讲者备注：【特写】volume 命令全家。卷的实体藏在 /var/lib/docker/volumes, 别手翻, 用 inspect 看就够了。 -->

---

# 把卷挂进容器: -v 或 --mount

```bash
docker run -d --name web \
  -v webdata:/usr/share/nginx/html nginx
# 等价、更清晰:
docker run -d --name web \
  --mount source=webdata,target=/usr/share/nginx/html nginx
```

> 卷不存在会自动建; 生产更推荐 --mount

<!-- 讲者备注：【特写】两种挂载写法。-v 简写、--mount 结构化。同一件事, 习惯用 --mount 可读性更好。 -->

---
layout: section
---

# 三、绑定挂载 Bind Mount
> 直接把宿主目录"借"给容器

<!-- 讲者备注：【转场】第三幕幕卡。第二招: 不绕道 Docker, 直接映射宿主机路径, 实时双向同步。 -->

---

# bind mount 实时同步宿主与容器

```bash
docker run -d --name web \
  -v "$PWD/html":/usr/share/nginx/html nginx
# --mount 写法:
docker run -d --name web \
  --mount type=bind,source="$PWD/html",target=/usr/share/nginx/html nginx
```

> 关键: 必须是**绝对路径**; 改宿主文件, 容器立刻同步

<!-- 讲者备注：【特写】bind mount 要点。裸目录名会被当卷, 必须用绝对路径。实时同步是它用于开发的原因。 -->

---
layout: section
---

# 四、共享与热开发
> 一卷多用, 一挂即改

<!-- 讲者备注：【转场】第四幕幕卡。真正的重点: 数据共享与开发调试。多容器共卷, 源码挂进来改即生效。 -->

---

# 多容器挂同一卷 = 共享

```bash
docker volume create webdata
docker run -d --name site1 -v webdata:/usr/share/nginx/html -p 8081:80 nginx
docker run -d --name site2 -v webdata:/usr/share/nginx/html -p 8082:80 nginx

docker exec -it site1 bash -c 'echo shared > .../x.html'
curl localhost:8082/x.html    # site2 也看到 shared!
```

> 一份数据, 多个容器共享读写

<!-- 讲者备注：【特写】共卷即共数据。改一份两个容器都变, 这是负载均衡/多副本共享状态的雏形。 -->

---

# 热开发: 源码目录挂进去, 改代码即时生效

```bash
docker run -d -p 8000:8000 \
  -v "$PWD/app":/app \
  flask-app python app.py --reload
```

> 改 `.py` → 刷新页面即生效, 免反复 `docker build`

<!-- 讲者备注：【特写】最关键场景。镜像只提供运行环境, 代码靠 bind mount 实时喂给容器。这是"镜像=只读模板"思想的应用。 -->

---

# 只读挂载, 防止容器内误改

```bash
docker run -d -v "$PWD/conf":/etc/nginx/conf.d:ro nginx
```

> `:ro` 让容器只能读, 宿主机配置不被容器碰坏

<!-- 讲者备注：【特写】权限细节。挂配置/密钥常用 :ro, 只读保护宿主文件。 -->

---

# Volume 还是 Bind Mount?

| 维度 | Volume | Bind Mount |
|---|---|---|
| 管理 | Docker管 | 宿主任意路径 |
| 可见性 | 隐藏在 /var/lib/docker | 直接可见 |
| 适用 | 生产、有状态DB | **开发调试、直改代码** |

> 拿不准用 Volume; 要实时改代码用 Bind Mount

<!-- 讲者备注：【全景】选型判断。一条决断线: 开发调试以直接可见、可改优先 → Bind Mount; 其它交给 Volume。 -->

---
layout: section
---

# 五、实战一
## 数据卷让数据跨容器活
> 删容器, 卷还在

<!-- 讲者备注：【转场】第五幕幕卡。亲手验证 Volume 持久性, 印象最深刻。 -->

---

# 删了重建, 数据被卷留下来

```bash
docker volume create webdata
docker run -d --name site1 -v webdata:/usr/share/nginx/html -p 8081:80 nginx
docker exec -it site1 bash -c 'echo persist > .../p.txt'
docker rm -f site1                          # 容器没了

docker run -d --name site2 -v webdata:/usr/share/nginx/html -p 8082:80 nginx
curl localhost:8082/p.txt                   # persist 还在!
docker volume rm webdata                    # 清理
```

<!-- 讲者备注：【特写】持久性实测。关键动作: rm 容器 → 挂同一卷重建 → 数据回来。这就是"持久化"。 -->

---
layout: section
---

# 六、实战二
## bind mount 做热开发
> 改宿主, 容器即变

<!-- 讲者备注：【转场】第六幕幕卡。实战二收官: 源码目录整挂, 改即生效, 建立开发手感。 -->

---

# 改一个文件, curl 立刻变

```bash
mkdir -p ~/dev/demo && echo '<h1>Demo</h1>' > ~/dev/demo/index.html

docker run -d --name dev -p 8080:80 \
  -v "$HOME/dev/demo":/usr/share/nginx/html nginx
curl localhost:8080            # Demo

echo '<h1>Updated!</h1>' > ~/dev/demo/index.html
curl localhost:8080            # Updated! 无 build
docker exec -it dev cat /usr/share/nginx/html/index.html  # 容器内同步
```

<!-- 讲者备注：【特写】热开发全流程。核心结论: 镜像装环境, 代码实时进容器, 改完即生效, 不必每次 rebuild。 -->

---
transition: slide-left
---

# 一张表带走全部要点

| 方面 | 要点 |
|---|---|
| 痛点 | 可写层随容器销毁而消失 |
| 三种方式 | Volume / Bind Mount / tmpfs |
| 数据卷 | create/ls/inspect/rm · `-v 卷:路径` · `--mount` |
| 绑定挂载 | 绝对路径 · 实时双向同步 · `:ro` 只读 |
| 共享 | 多容器挂同一卷/同一路径 |
| 热开发 | 挂源码目录 → 改代码即时生效 |

<!-- 讲者备注：【全景】收束全片。数据在容器外, 既享"易销毁"又"不丢数据"。 -->

---
transition: slide-left
---

# 数据留得住, 代码热更新 — 容器终于能"过日子"了

> 下一步: 部署编程语言(C/C++、Java)。Dockerfile 把源码+环境打成镜像, 用掉前面全部功夫

<!-- 讲者备注：【空镜】悬念收尾。数据持久化打通后, 下一讲按镜像部署语言应用, 是之前的集大成。 -->

---
layout: section
---

# 谢谢大家

Q & A

<!-- 讲者备注：【空镜】片尾致谢, 留提问时间。 -->