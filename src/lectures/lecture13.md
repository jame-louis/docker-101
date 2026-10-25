# Docker 部署主流数据库（Redis、MySQL、MongoDB）

## 目标

- 理解数据库是**有状态服务**：必须配**数据卷持久化** + 环境变量（账号密码）+ 端口映射
- **重点**：掌握部署 **Redis**：持久化卷、`redis-cli` 进入终端验证
- **重点**：掌握部署 **MySQL**：`MYSQL_ROOT_PASSWORD`、`-v` 数据目录、`mysql` 客户端连接
- 了解部署 **MongoDB**：数据目录、`mongosh` 连接
- 掌握通用排查：容器内 `exec` 进终端、看日志、`docker exec` 连客户端

---

## 第一部分 数据库部署的特殊性

### 1.1 为什么数据库不一样

前面部署 Web/语言应用时可写层丢了无所谓、重建即可；但**数据库删了 = 数据全没了**。所以部署数据库有三件标配：

1. **数据卷持久化**：把数据目录挂到卷，容器重建数据不丢（呼应数据持久化讲）；
2. **环境变量**：账号、密码、初始化库名，靠启动环境变量传进去；
3. **端口映射**：让应用/客户端能连到它（通常默认端口：Redis 6379、MySQL 3306、MongoDB 27017）。

### 1.2 每次部署的通用模板

```bash
docker run -d --name [名] \
  -p [宿主端口]:[容器默认端口] \
  -e [环境变量] \
  -v [数据目录]:/数据目录 \
  [官方镜像]
```

下面三个都是这模板的填空。

---

## 第二部分 部署 Redis（重点）

### 2.1 默认跑起来

```bash
docker run -d --name my-redis -p 6379:6379 redis:7
docker exec -it my-redis redis-cli ping    # 返回 PONG
```

- 官方镜像 `redis`，容器内默认端口 6379；
- `docker exec` 进容器运行 `redis-cli` 即可连上本示例里的 Redis。

### 2.2 持久化：挂数据目录 + 设置密码

数据默认存在容器内可写层，删容器就没了。挂一个数据卷持久化，并建议用密码：

```bash
docker run -d --name my-redis \
  -p 6379:6379 \
  -v redisdata:/data \          # Redis 数据目录 /data
  redis:7 --requirepass mypass \
  --appendonly yes              # 开启 AOF 持久化(可选增强)
```

连上来验证：

```bash
docker exec -it my-redis redis-cli
127.0.0.1:6379> AUTH mypass           # 认证
OK
127.0.0.1:6379> SET k1 v1
OK
127.0.0.1:6379> GET k1
"v1"
```

### 2.3 验证"数据靠卷存活"

```bash
docker rm -f my-redis                  # 删容器
docker run -d --name my-redis -p 6379:6379 \
  -v redisdata:/data redis:7 --requirepass mypass --appendonly yes
docker exec -it my-redis redis-cli -a mypass GET k1   # 还是 v1!
```

> **作业核心**：这一条就是"进入容器终端连接 Redis 并验证"——`docker exec -it` + `redis-cli`，`SET` 再 `GET`。

---

## 第三部分 部署 MySQL（重点）

### 3.1 必配环境变量

MySQL 首次启动要设 `MYSQL_ROOT_PASSWORD`（root 密码），否则容器起不来：

```bash
docker run -d --name my-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=demo \          # 可选: 自动建库
  -e MYSQL_USER=user -e MYSQL_PASSWORD=user123 \  # 可选: 建普通用户
  mysql:8
```

容器内默认端口 3306，数据目录 `/var/lib/mysql`。

### 3.2 挂数据卷持久化

不挂卷，MySQL 数据随容器删除而消失。生产务必挂卷：

```bash
docker run -d --name my-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -v mysql-data:/var/lib/mysql \
  mysql:8
```

### 3.3 进入终端连接并操作

```bash
docker exec -it my-mysql mysql -uroot -proot123
mysql> SHOW DATABASES;
mysql> CREATE DATABASE testdb;
mysql> USE testdb;
mysql> CREATE TABLE t(id INT, name VARCHAR(20));
mysql> INSERT INTO t VALUES (1,'hello');
mysql> SELECT * FROM t;
```

> 在容器内连接本机的 MySQL，用 `docker exec` + `mysql -uroot -p密码` 即可；外部应用则通过 `-p 宿主:3306` 面向宿主机连接。

### 3.4 常见报错排查

| 现象 | 原因/处理 |
|---|---|
| 容器反复重启 | 没设 `MYSQL_ROOT_PASSWORD`；或已有旧数据目录未匹配环境变量 → `docker logs my-mysql` 看原因 |
| `Access denied` | 密码/权限不对，确认 `-e` 变量与连接命令一致 |
| 端口占用 | `-p 3306:3306` 与宿主机已有端口冲突，换宿主端口如 `3307` |

---

## 第四部分 部署 MongoDB（了解）

### 4.1 默认跑起来 + 持久化

```bash
docker run -d --name my-mongo \
  -p 27017:27017 \
  -v mongodata:/data/db \          # 数据目录 /data/db
  mongo:7
```

- 默认端口 27017，数据目录 `/data/db`；
- 可选 `-e MONGO_INITDB_ROOT_USERNAME/PASSWORD` 设管理员。

### 4.2 进入终端连接

```bash
docker exec -it my-mongo mongosh
test> show dbs
test> db.site.insertOne({name:"docker"})
test> db.site.find()
```

### 4.3 三库速览

| 数据库 | 镜像 | 默认端口 | 数据目录 | 终端客户端 |
|---|---|---|---|---|
| **Redis** | `redis` | 6379 | `/data` | `redis-cli` |
| **MySQL** | `mysql` | 3306 | `/var/lib/mysql` | `mysql` |
| **MongoDB** | `mongo` | 27017 | `/data/db` | `mongosh` |

> 三者完全同一套路：`-p` + `-e`（密码/账号）+ `-v`（数据卷）。记住"每库的端口 + 数据目录 + 客户端命令"即可。

---

## 第五部分 实战一：部署并连接 Redis（作业核心）

**目标**：获取 Redis 镜像，起一个带持久化的 Redis，`docker exec` 进入容器终端用 `redis-cli` 连接并验证读写。

**第 1 步：拉取并启动**

```bash
docker pull redis:7
docker run -d --name my-redis \
  -p 6379:6379 \
  -v redisdata:/data \
  redis:7 --requirepass mypass --appendonly yes
docker ps        # 确认 Up
```

**第 2 步：进入容器终端连接**

```bash
docker exec -it my-redis redis-cli -a mypass
127.0.0.1:6379> PING        # PONG
127.0.0.1:6379> SET city beijing
OK
127.0.0.1:6379> GET city    # "beijing"
127.0.0.1:6379> exit
```

**第 3 步：验证持久化（作业加分项）**

```bash
docker rm -f my-redis
docker run -d --name my-redis -p 6379:6379 \
  -v redisdata:/data redis:7 --requirepass mypass --appendonly yes
docker exec -it my-redis redis-cli -a mypass GET city   # 还应是 beijing
```

---

## 第六部分 实战二：部署并连接 MySQL

**目标**：起一个带持久化的 MySQL，进终端建库建表并写入读取。

**第 1 步：启动（含 root 密码与数据卷）**

```bash
docker run -d --name my-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -v mysql-data:/var/lib/mysql \
  mysql:8
docker logs my-mysql | tail -20     # 等初始化完成
```

**第 2 步：进终端连接**

```bash
docker exec -it my-mysql mysql -uroot -proot123
mysql> SHOW DATABASES;
mysql> CREATE DATABASE shop;
mysql> USE shop;
mysql> CREATE TABLE users(id INT PRIMARY KEY, name VARCHAR(20));
mysql> INSERT INTO users VALUES (1, 'tom');
mysql> SELECT * FROM users;
mysql> exit
```

**第 3 步：验证数据落卷**

```bash
docker rm -f my-mysql
docker run -d --name my-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -v mysql-data:/var/lib/mysql mysql:8
docker exec -it my-mysql mysql -uroot -proot123 -e "USE shop; SELECT * FROM users;"   # tom 还在
```

---

## 第七部分 总结

| 方面 | 要点 |
|---|---|
| 数据库特性 | **有状态**：删容器数据就没了 → 必须数据卷持久化 |
| 三件标配 | `-v` 数据目录 + `-e` 账号密码 + `-p 默认端口` |
| Redis | `redis` · 6379 · /data · `redis-cli` · `--requirepass`/`--appendonly` |
| MySQL | `mysql` · 3306 · /var/lib/mysql · `MYSQL_ROOT_PASSWORD` · `mysql` 客户端 |
| MongoDB | `mongo` · 27017 · /data/db · `mongosh` |
| 进终端连接 | `docker exec -it 容器 客户端` 三家的统一姿势 |
| 排查 | `docker logs` 看启动失败/初始化；端口占用换宿主端口 |

> **一句话点透**：数据库部署 = 基础部署模板（`-p` + `-e`）+ 一个"数据别随容器丢"的 `-v` 数据卷。记住"端口、数据目录、客户端命令"这组三元组，三个库（及其它所有库）就能一路通用。

## 下一步

接下来的**两讲案例**把前面所有知识串起来：案例一用 Docker 在**测试中**使用静态网站（构造 Sample 网站并跑起来验证）；案例二做**基于 Docker 的 Java Web 应用**（打 war、上 Tomcat）。都是"综合题"。