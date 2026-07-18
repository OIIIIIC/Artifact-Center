# Artifact Center API

Hono + PostgreSQL + 本地文件存储的后端（MVP）。

## 技术选型

| 层   | 选择                       | 说明                       |
| ---- | -------------------------- | -------------------------- |
| HTTP | Hono + `@hono/node-server` | 轻量、类型友好             |
| ORM  | Drizzle + drizzle-kit      | SQL 透明、迁移简单         |
| DB   | PostgreSQL 16 (Docker)     | 元数据唯一源               |
| Auth | JWT (`jose`) + bcrypt      | Bearer token，7 天有效     |
| 文件 | 本地目录 `data/files`      | `storage_key` 指向磁盘路径 |
| 校验 | Zod                        | 请求体验证                 |

## 快速启动

在仓库根目录：

```bash
# 1. 启动 Postgres（需 Docker Desktop 已启动）
# 若 docker.io 拉不动，可先：
#   docker pull public.ecr.aws/docker/library/postgres:16-alpine
#   docker tag public.ecr.aws/docker/library/postgres:16-alpine postgres:16-alpine
docker compose up -d

# 2. 安装 API 依赖
cd apps/api && npm install

# 3. 生成迁移（首次 / schema 变更后）
npm run db:generate

# 4. 迁移 + seed 演示账号
npm run db:setup

# 5. 开发服务
npm run dev
```

或根目录脚本：

```bash
npm run db:up
npm run db:setup   # 需已 npm install --prefix apps/api
npm run dev:api
```

- API: http://localhost:3001
- Health: `GET /health`
- 演示账号: `demo@enterprise.local` / `Demo@2026`

## 环境变量

见 `.env.example`。本地已提供 `.env`（勿提交密钥到生产）。

## 主要接口

| Method | Path                                | 说明                                |
| ------ | ----------------------------------- | ----------------------------------- |
| GET    | `/health`                           | 健康检查                            |
| POST   | `/auth/login`                       | 登录拿 JWT                          |
| GET    | `/auth/me`                          | 当前用户                            |
| PATCH  | `/auth/me`                          | 更新资料/头像（返回新 token）       |
| POST   | `/auth/change-password`             | 修改自己的密码                      |
| GET    | `/search?q=`                        | 全局搜索应用/制品                   |
| GET    | `/settings/retention`               | 保留策略 + 真实存储用量             |
| PATCH  | `/settings/retention`               | 更新保留策略（admin）               |
| POST   | `/settings/retention/run`           | 立即执行清理（admin）               |
| GET    | `/audit`                            | 操作记录（可按 applicationId 过滤） |
| GET    | `/users`                            | 用户列表（admin）                   |
| POST   | `/users`                            | 管理员创建用户                      |
| PATCH  | `/users/:id`                        | 改姓名/角色（admin）                |
| DELETE | `/users/:id`                        | 删除用户（admin）                   |
| POST   | `/users/:id/reset-password`         | 管理员重置密码                      |
| GET    | `/applications`                     | 应用列表                            |
| POST   | `/applications`                     | 创建应用                            |
| GET    | `/applications/:id`                 | 应用详情                            |
| PATCH  | `/applications/:id`                 | 更新应用                            |
| DELETE | `/applications/:id`                 | 删除应用                            |
| GET    | `/applications/:id/members`         | 应用成员列表                        |
| PUT    | `/applications/:id/members/:userId` | 添加或更新应用成员角色              |
| DELETE | `/applications/:id/members/:userId` | 移除应用成员                        |
| GET    | `/applications/:id/artifacts`       | 制品列表                            |
| GET    | `/applications/:id/releases`        | 发布记录与关联制品类型              |
| POST   | `/applications/:appId/artifacts`    | 上传（multipart）                   |
| GET    | `/artifacts/:id`                    | 制品元数据                          |
| PATCH  | `/artifacts/:id`                    | 更新渠道/状态/发布说明/标最新       |
| DELETE | `/artifacts/:id`                    | 删除制品（含文件）                  |
| GET    | `/artifacts/:id/download`           | 下载文件流                          |
| POST   | `/applications/:appId/shares`       | 创建分享链接（maintainer+）         |
| GET    | `/applications/:appId/shares`       | 分享列表                            |
| DELETE | `/shares/:id`                       | 吊销分享                            |
| GET    | `/public/shares/:token`             | 解析分享落地页                      |
| GET    | `/public/shares/:token/download`    | 经分享下载                          |

除 `/health`、`POST /auth/login`、服务端分享链接的 `/public/shares/*` 外均需 `Authorization: Bearer <token>`。

### 上传示例

```bash
curl -X POST http://localhost:3001/applications/<appId>/artifacts \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./app-release.apk" \
  -F "version=1.0.0" \
  -F "channel=stable" \
  -F "buildNumber=42" \
  -F "releaseNotes=首次发布" \
  -F "markLatest=true"
```
