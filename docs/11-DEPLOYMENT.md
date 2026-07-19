# Ubuntu 生产部署

Artifact Center 的生产部署由三个容器组成：

- `web`：Nginx 托管前端，并将 `/api` 反向代理到 API
- `api`：编译后的 Node.js 服务，启动时自动执行数据库迁移
- `postgres`：PostgreSQL 16

PostgreSQL 数据与制品文件分别存放在 Docker 命名卷中，重新构建或升级容器不会删除数据。

## 1. 服务器要求

- 推荐 Ubuntu 22.04 / 24.04 或同等级 Linux 发行版
- Docker Engine 24+ 与 Docker Compose Plugin 2.20+
- 最低 2 核 CPU、4 GB 内存
- 制品实际需要的磁盘容量
- 对外开放应用端口，默认 `8080`

确认环境：

```bash
docker --version
docker compose version
```

## 2. Ubuntu 主机准备

以下命令以 Ubuntu 22.04 / 24.04 为例，使用具备 `sudo` 权限的运维账号执行。不要以 root 直接日常运行 Compose。

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
```

按 Docker 官方 Ubuntu 安装说明安装 Docker Engine 和 Compose Plugin。安装后将当前运维账号加入 `docker` 组，并重新登录 shell：

```bash
sudo usermod -aG docker "$USER"
newgrp docker
docker run --rm hello-world
docker compose version
```

若服务器通过 SSH 维护且应用直接暴露 `8080`，启用 UFW 时至少保留 SSH 与应用端口：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 8080/tcp
sudo ufw enable
sudo ufw status
```

使用域名与反向代理时，不应直接开放 `8080` 到公网；改为仅监听 `127.0.0.1:8080`，并由 HTTPS 反向代理开放 `80/443`。

## 3. 首次部署

```bash
git clone https://github.com/OIIIIIC/Artifact-Center.git
cd Artifact-Center

cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
```

编辑 `deploy/.env`：

- `POSTGRES_PASSWORD`：数据库密码，建议使用 URL 安全字符
- `JWT_SECRET`：执行 `openssl rand -hex 32` 生成
- `ADMIN_*`：首次启动创建的管理员账号；`ADMIN_USERNAME` 是账号登录名，`ADMIN_EMAIL` 仍可用于邮箱登录
- `APP_ORIGIN`：浏览器实际访问地址
- `APP_PORT`：主机监听端口

启动：

```bash
docker compose --env-file deploy/.env -f compose.prod.yml up -d --build
docker compose --env-file deploy/.env -f compose.prod.yml ps
```

查看启动日志：

```bash
docker compose --env-file deploy/.env -f compose.prod.yml logs -f api web
```

打开 `http://服务器地址:8080`，使用 `ADMIN_USERNAME` 或 `ADMIN_EMAIL` 与 `ADMIN_PASSWORD` 登录。

首次登录后应修改管理员密码。数据库已有管理员后，所有 `ADMIN_*` 可以从 `deploy/.env` 清空；后续启动会自动跳过管理员引导。

## 4. 域名与 HTTPS

生产环境建议在服务器现有的 Caddy、Traefik 或云负载均衡器上终止 HTTPS，再转发到 `127.0.0.1:8080`。

此时应配置：

```dotenv
APP_ORIGIN=https://artifacts.example.com
APP_PORT=8080
```

若只允许本机反向代理访问，可在 `compose.prod.yml` 中将端口映射调整为：

```yaml
ports:
  - '127.0.0.1:8080:80'
```

## 5. 升级

升级前先备份，然后执行：

```bash
git pull --ff-only
docker compose --env-file deploy/.env -f compose.prod.yml up -d --build
docker compose --env-file deploy/.env -f compose.prod.yml ps
```

API 容器启动时会先执行迁移，迁移成功后才启动服务。Web 容器会等待 API 健康检查通过。

## 6. 备份

创建备份目录：

```bash
mkdir -p backups
```

备份 PostgreSQL：

```bash
docker compose --env-file deploy/.env -f compose.prod.yml exec -T postgres \
  pg_dump -U artifact -d artifact_center -Fc > backups/database.dump
```

备份制品文件：

```bash
docker run --rm \
  -v artifact-center_artifact_files:/source:ro \
  -v "$PWD/backups:/backup" \
  alpine:3.21 \
  tar -czf /backup/artifacts.tar.gz -C /source .
```

数据库与制品文件应作为同一个备份批次保存，避免元数据和文件版本不一致。生产环境应将备份复制到另一台服务器或对象存储。

## 7. 恢复

停止 Web 与 API：

```bash
docker compose --env-file deploy/.env -f compose.prod.yml stop web api
```

恢复数据库：

```bash
cat backups/database.dump | docker compose --env-file deploy/.env -f compose.prod.yml exec -T postgres \
  pg_restore -U artifact -d artifact_center --clean --if-exists
```

恢复制品卷：

```bash
docker run --rm \
  -v artifact-center_artifact_files:/target \
  -v "$PWD/backups:/backup:ro" \
  alpine:3.21 \
  sh -c 'rm -rf /target/* && tar -xzf /backup/artifacts.tar.gz -C /target'
```

重新启动：

```bash
docker compose --env-file deploy/.env -f compose.prod.yml up -d
```

## 8. 运维检查

```bash
# 容器与健康状态
docker compose --env-file deploy/.env -f compose.prod.yml ps

# API 健康检查（通过 Web 反代）
curl -fsS http://127.0.0.1:8080/api/health

# 磁盘与 Docker 占用
df -h
docker system df
```

设置页的磁盘容量来自制品卷所在文件系统，并每 30 秒刷新。Docker 命名卷默认位于 Docker 数据目录，因此需要监控该目录所在磁盘。

## 9. 停止与删除

停止服务但保留数据：

```bash
docker compose --env-file deploy/.env -f compose.prod.yml down
```

不要在生产环境执行 `down -v`，它会删除 PostgreSQL 与制品文件卷。
