---
theme: default
title: 部署数据库
info: |
  ## Docker 部署主流数据库 教学幻灯片
  Docker 101 第 13 讲
class: text-center
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
---

# Docker 部署数据库
## Redis · MySQL · MongoDB

<!-- 讲者备注：【空镜】开场钩子。提问: 前面部署的东西删了能重建, 数据库删了呢? 引出"有状态服务必须持久化"。 -->

---
transition: slide-left
---

## 目标

数据库是有状态服务, 三件标配要记牢

- 数据库特性: 删容器数据就没 → 必须**数据卷**
- 三件标配: `-v 数据目录` + `-e 账号密码` + `-p 端口`
- Redis(重点): redis-cli 进终端验证
- MySQL(重点): root 密码 + mysql 客户端

<!-- 讲者备注：【全景】总览三幕剧。第一幕数据库特殊性(vs 前几讲); 第二幕 Redis 与 MySQL; 第三幕 MongoDB 与排查; 两个实战。 -->

---
layout: section
---

# 一、数据库的特殊性
> 别把数据和容器绑在一起

<!-- 讲者备注：【转场】第一幕幕卡。先讲清"为什么数据库不能学前面的无状态玩法"。 -->

---

# 前面删了能重建, 数据库删了数据全没

- Web、语言应用: 可写层丢了, 重建即可
- 数据库: 数据就在可写层里 **随容器销毁而消失**

> 所以数据库部署 = 基础模板 + 数据卷持久化

<!-- 讲者备注：【特写】点出数据库 vs 无状态应用的差别。用"删容器丢数据"刺痛一下, 引出三件标配。 -->

---

# 三件标配, 一个模板填空

```bash
docker run -d --name [名] \
  -p 宿主端口:容器端口 \     # 让外面能连
  -e 环境变量 \              # 账号/密码/初始库
  -v 数据卷:/数据目录 \      # 数据别随容器丢
  [官方镜像]
```

> 三库都一样, 只是换镜像、端口、数据目录、客户端

<!-- 讲者备注：【全景】模板。数据库部署就是把这三样填进 run 命令。后面每个库都是填空。 -->

---
layout: section
---

# 二、Redis (重点)
> 最轻的有状态服务

<!-- 讲者备注：【转场】第二幕幕卡。Redis 打头, 讲持久化 + redis-cli 验证。 -->

---

# 默认跑起来, exec 进终端就能连

```bash
docker run -d --name my-redis -p 6379:6379 redis:7
docker exec -it my-redis redis-cli ping    # PONG
```

> 端口6379 · 数据目录 /data · 客户端 redis-cli

<!-- 讲者备注：【特写】Redis 极简起。docker exec + redis-cli 即"进入容器终端连接"。 -->

---

# 挂数据卷 + 设密码, 才算"像样"

```bash
docker run -d --name my-redis \
  -p 6379:6379 \
  -v redisdata:/data \
  redis:7 --requirepass mypass --appendonly yes

docker exec -it my-redis redis-cli -a mypass
> SET city beijing
> GET city      # "beijing"
```

<!-- 讲者备注：【特写】Redis 持久化+密码。--requirepass 设密码, --appendonly AOF 增强持久化, -v 挂 /data。作业核心在这里。 -->

---

# 删容器再启, 数据靠卷活着

```bash
docker rm -f my-redis
docker run -d --name my-redis -p 6379:6379 \
  -v redisdata:/data redis:7 --requirepass mypass --appendonly yes
docker exec -it my-redis redis-cli -a mypass GET city  # 还是 beijing
```

> 验证"删容器, 数据不丢"

<!-- 讲者备注：【特写】持久性实测。rm 重建后 GET 返回值还在 = 卷起作用了。作业加分项。 -->

---
layout: section
---

# 三、MySQL (重点)
> 密码写进环境变量

<!-- 讲者备注：【转场】第三幕幕卡。MySQL 必配 root 密码, 是重点。 -->

---

# 必配 MYSQL_ROOT_PASSWORD, 否则起不来

```bash
docker run -d --name my-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=demo \            # 可选: 自动建库
  -v mysql-data:/var/lib/mysql \
  mysql:8
```

> 端口3306 · 数据目录 /var/lib/mysql

<!-- 讲者备注：【特写】MySQL 三要素。root 密码是硬条件; MYSQL_DATABASE 免手动建库; 数据卷必挂。 -->

---

# exec 进终端, 建库建表写读

```bash
docker exec -it my-mysql mysql -uroot -proot123
mysql> CREATE DATABASE shop;
mysql> USE shop;
mysql> CREATE TABLE users(id INT PRIMARY KEY, name VARCHAR(20));
mysql> INSERT INTO users VALUES (1, 'tom');
mysql> SELECT * FROM users;
```

> 一律 `-e MYSQL_ROOT_PASSWORD` 起, 用 mysql 客户端连

<!-- 讲者备注：【特写】MySQL 连入操作。cre 建库建表写读, 客户端是 mysql。注意 -p密码不要留空格。 -->

---

# 常见报错排查

| 现象 | 处理 |
|---|---|
| 容器反复重启 | 没设 root 密码 / 旧数据不匹配 → `docker logs` |
| Access denied | 确认 `-e` 密码与连接一致 |
| 端口占用 | 换宿主端口, 如 `-p 3307:3306` |

<!-- 讲者备注：【特写】排查套路。数据库起不来先 docker logs, 八成是环境变量或数据目录。 -->

---
layout: section
---

# 四、MongoDB (了解)
> 同套路, 换词

<!-- 讲者备注：【转场】第四幕幕卡。MongoDB 一看就会, 只是换个镜像和客户端。 -->

---

# mongo 镜像 + mongosh 客户端

```bash
docker run -d --name my-mongo \
  -p 27017:27017 \
  -v mongodata:/data/db \
  mongo:7

docker exec -it my-mongo mongosh
> db.site.insertOne({name:"docker"})
> db.site.find()
```

> 端口27017 · 数据目录 /data/db · 客户端 mongosh

<!-- 讲者备注：【特写】MongoDB 同构。和前面一模一样, 记三元组即可。 -->

---

# 三库速览, 一个套路

| 库 | 镜像 | 端口 | 数据目录 | 客户端 |
|---|---|---|---|---|
| Redis | redis | 6379 | /data | redis-cli |
| MySQL | mysql | 3306 | /var/lib/mysql | mysql |
| MongoDB | mongo | 27017 | /data/db | mongosh |

> 记住"端口 + 数据目录 + 客户端", 三库通用

<!-- 讲者备注：【全景】三库对照表收束。三个三元组就是今天全部记忆点。 -->

---
layout: section
---

# 五、实战一
## 部署并连接 Redis (作业)
> 进入容器终端, 读写验证

<!-- 讲者备注：【转场】第五幕幕卡。作业核心, 一步步走 Redis。 -->

---

# 获取镜像, 起带持久化的 Redis

```bash
docker pull redis:7
docker run -d --name my-redis -p 6379:6379 \
  -v redisdata:/data \
  redis:7 --requirepass mypass --appendonly yes

docker exec -it my-redis redis-cli -a mypass
> PING           # PONG
> SET city beijing
> GET city       # "beijing"
> exit
```

<!-- 讲者备注：【特写】作业主线。拉镜像、起容器、exec 进终端、PING/SET/GET 验证。这些都要截图。 -->

---
layout: section
---

# 六、实战二
## 部署并连接 MySQL
> 建库建表, 数据落卷

<!-- 讲者备注：【转场】第六幕幕卡。MySQL 实战收官。 -->

---

# 建一张表, 写完删容器仍能读到

```bash
docker run -d --name my-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 -v mysql-data:/var/lib/mysql mysql:8

docker exec -it my-mysql mysql -uroot -proot123
mysql> CREATE DATABASE shop; USE shop;
mysql> CREATE TABLE users(id INT PRIMARY KEY, name VARCHAR(20));
mysql> INSERT INTO users VALUES (1,'tom'); SELECT * FROM users;

# 删容器→重建→数据还在
docker run -d --name my-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 -v mysql-data:/var/lib/mysql mysql:8
docker exec -it my-mysql mysql -uroot -proot123 \
  -e "USE shop; SELECT * FROM users;"     # tom 还在
```

<!-- 讲者备注：【特写】MySQL 全流程。建库建表写读 + 删重建验证持久化。 -->

---
transition: slide-left
---

# 一张表带走全部要点

| 方面 | 要点 |
|---|---|
| 数据库特性 | 有状态 → 删容器数据没了 → **必须数据卷** |
| 三件标配 | `-v 数据目录` + `-e 账号密码` + `-p 端口` |
| Redis | 6379 · /data · redis-cli · --requirepass |
| MySQL | 3306 · /var/lib/mysql · MYSQL_ROOT_PASSWORD |
| MongoDB | 27017 · /data/db · mongosh |
| 进终端 | `docker exec -it 容器 客户端` 三库统一 |
| 排查 | 起不来先 `docker logs` |

<!-- 讲者备注：【全景】收束全片。记住三元组: 端口、数据目录、客户端。 -->

---
transition: slide-left
---

# 数据卷是数据库的"保险柜", 容器只是临时来拿货的

> 下一步: 两讲综合案例 —— 先用 Docker 做静态网站测试, 再做 Java Web 应用上 Tomcat, 把全部所学串起来

<!-- 讲者备注：【空镜】悬念收尾。数据库收官, 下两讲是综合案例。 -->

---
layout: section
---

# 谢谢大家

Q & A

<!-- 讲者备注：【空镜】片尾致谢, 留提问时间。 -->