# Artifact Center — 内网离线部署指南

这份文档适合这种情况：

- 你的服务器在内网，不能访问 GitHub、Docker Hub、npm。
- 你有一台能联网的 Windows 电脑。
- 内网服务器已经安装好 Docker 和 Docker Compose。

如果内网服务器还没有 Docker，先让运维同事安装 Docker；这一步比较像服务器基础环境准备，不建议第一次部署应用时一起折腾。

## 你要准备什么

准备两台机器：

| 机器              | 用途                     |
| ----------------- | ------------------------ |
| 联网 Windows 电脑 | 构建镜像，生成离线部署包 |
| 内网 Linux 服务器 | 导入镜像，启动服务       |

最终你会得到一个文件夹：

```text
offline-deploy/
├── artifact-center-images.tar
├── compose.offline.yml
└── deploy/
    └── .env
```

把这个文件夹拷到内网服务器，就可以部署。

## 第一步：在联网 Windows 电脑上打包

打开 PowerShell，进入项目目录：

```powershell
cd D:\MyCode\artifact-center
```

构建前端镜像：

```powershell
docker build -t artifact-center-web:0.1.0 .
```

构建后端镜像：

```powershell
docker build -t artifact-center-api:0.1.0 .\apps\api
```

拉取数据库镜像：

```powershell
docker pull postgres:16-alpine
```

创建离线部署目录：

```powershell
New-Item -ItemType Directory -Force .\output\offline-deploy\deploy
```

导出镜像包：

```powershell
docker save `
  artifact-center-web:0.1.0 `
  artifact-center-api:0.1.0 `
  postgres:16-alpine `
  -o .\output\offline-deploy\artifact-center-images.tar
```

复制启动配置：

```powershell
Copy-Item .\compose.offline.yml .\output\offline-deploy\compose.offline.yml
Copy-Item .\deploy\.env.example .\output\offline-deploy\deploy\.env
```

现在离线包在：

```text
D:\MyCode\artifact-center\output\offline-deploy
```

## 第二步：修改配置

用记事本打开：

```text
D:\MyCode\artifact-center\output\offline-deploy\deploy\.env
```

至少修改这些值：

```dotenv
POSTGRES_PASSWORD=改成一个数据库密码
JWT_SECRET=改成一串很长的随机字符串
ADMIN_NAME=Artifact Center Admin
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=改成管理员登录密码
APP_ORIGIN=http://内网服务器IP:8080
APP_PORT=8080
```

示例：

```dotenv
POSTGRES_PASSWORD=ArtifactDb_2026_Strong
JWT_SECRET=artifact-center-jwt-secret-please-change-to-a-long-random-string-2026
ADMIN_NAME=Artifact Center Admin
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin_ChangeMe_2026
APP_ORIGIN=http://192.168.1.50:8080
APP_PORT=8080
```

注意：

- `APP_ORIGIN` 要写浏览器实际访问地址。
- 如果服务器 IP 是 `192.168.1.50`，就写 `http://192.168.1.50:8080`。
- 首次登录后，请立刻修改管理员密码。

## 第三步：把离线包拷到内网服务器

把整个文件夹拷到服务器，例如放到：

```text
/opt/artifact-center/offline-deploy
```

服务器上的目录应该长这样：

```text
/opt/artifact-center/offline-deploy/
├── artifact-center-images.tar
├── compose.offline.yml
└── deploy/
    └── .env
```

## 第四步：在内网服务器导入镜像

SSH 登录服务器，进入离线包目录：

```bash
cd /opt/artifact-center/offline-deploy
```

导入镜像：

```bash
docker load -i artifact-center-images.tar
```

确认镜像已经存在：

```bash
docker images | grep artifact-center
docker images | grep postgres
```

## 第五步：启动系统

在服务器执行：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml up -d
```

查看服务状态：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml ps
```

正常情况下你会看到三个服务：

```text
postgres
api
web
```

## 第六步：打开网页

浏览器访问：

```text
http://内网服务器IP:8080
```

例如：

```text
http://192.168.1.50:8080
```

使用 `.env` 里的管理员账号登录：

```text
账号：admin
密码：你设置的 ADMIN_PASSWORD
```

## 常用命令

查看运行状态：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml ps
```

查看日志：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml logs -f
```

只看后端日志：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml logs -f api
```

停止服务，但保留数据：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml down
```

重新启动：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml up -d
```

## 数据存在哪里

生产环境有两类重要数据：

| 数据                        | Docker 卷                        |
| --------------------------- | -------------------------------- |
| 数据库                      | `artifact-center_postgres_data`  |
| 上传的 APK / EXE / ZIP 文件 | `artifact-center_artifact_files` |

不要执行：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml down -v
```

`down -v` 会删除数据库和上传文件。

## 以后怎么升级

升级时重复这条流程：

1. 在联网 Windows 电脑重新构建镜像。
2. 重新导出 `artifact-center-images.tar`。
3. 拷到内网服务器。
4. 服务器执行 `docker load -i artifact-center-images.tar`。
5. 服务器执行：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml up -d
```

API 容器启动时会自动执行数据库迁移。

## 常见问题

### 访问不了网页

先看服务是否启动：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml ps
```

再检查服务器防火墙是否放行 `8080` 端口。

### 登录失败

确认你用的是 `deploy/.env` 里的：

```text
ADMIN_USERNAME
ADMIN_PASSWORD
```

如果数据库里已经创建过管理员，后续修改 `.env` 里的 `ADMIN_PASSWORD` 不会自动改旧管理员密码。

### 上传文件后文件在哪里

生产环境上传文件在 Docker 卷：

```text
artifact-center_artifact_files
```

不是项目目录里的 `data/files`。

### 镜像导入后还是启动失败

看日志：

```bash
docker compose --env-file deploy/.env -f compose.offline.yml logs -f api
```

常见原因是 `deploy/.env` 里的 `POSTGRES_PASSWORD`、`JWT_SECRET`、`APP_ORIGIN` 没填好。
