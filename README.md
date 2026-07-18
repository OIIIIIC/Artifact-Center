# Artifact Center

面向企业内网的现代化制品（Artifact）管理平台。

用于管理 Android APK / AAB、Windows EXE、ZIP 等构建产物；体验对标 Linear、GitHub、Vercel 等现代产品，而非传统 ERP 后台。

## 当前阶段

**P1 MVP — 前端产品页已齐 + 后端脚手架就绪**

- 文档规范：`docs/`
- **前端**：Vite + React + TS，应用目录 / 上传 / 详情 / 分享（当前仍可用 mock）
- **后端**：`apps/api` — Hono + PostgreSQL + 本地文件存储
- **首页**：`/` Applications（应用目录，非 Dashboard）

## 规范（必读）

| 文档                                           | 说明             |
| ---------------------------------------------- | ---------------- |
| [02-DESIGN](./docs/02-DESIGN.md)               | 设计准则         |
| [07-UI-PRINCIPLES](./docs/07-UI-PRINCIPLES.md) | UI 决策原则      |
| [08-DESIGN-SYSTEM](./docs/08-DESIGN-SYSTEM.md) | 设计系统执行规范 |
| [API README](./apps/api/README.md)             | 后端启动与接口   |

## 技术栈

**前端**

- React 19 · TypeScript · Vite
- Tailwind CSS v4 · shadcn/ui
- Framer Motion · Lucide · TanStack Query · React Router · Zustand

**后端（MVP）**

- Hono · Drizzle ORM · PostgreSQL 16
- JWT（jose）· bcrypt · 本地 `data/files` 存储

## 开发

### 前端

需同时运行后端（见下），Vite 将 `/api` 代理到 `http://localhost:3001`。

```bash
npm install
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)  
登录：`demo@enterprise.local` / `Demo@2026`

### 后端

需要本机 Docker（PostgreSQL）。

```bash
# 数据库
npm run db:up

# API 依赖 + 迁移 + 演示账号
cd apps/api
npm install
npm run db:generate   # 首次 / schema 变更
npm run db:setup      # migrate + seed
npm run dev           # http://localhost:3001
```

演示账号：`demo@enterprise.local` / `Demo@2026`

根目录也可：`npm run dev:api`、`npm run db:setup`。

## Linux 生产部署

仓库提供生产镜像与 Compose 配置，包含前端 Nginx、API、PostgreSQL、自动迁移、首次管理员引导、健康检查和持久化卷。

```bash
cp deploy/.env.example deploy/.env
# 修改 deploy/.env 中的密码、管理员与访问地址
docker compose --env-file deploy/.env -f compose.prod.yml up -d --build
```

完整的首次部署、HTTPS、升级与备份恢复流程见 [Linux 生产部署](./docs/11-DEPLOYMENT.md)。

### 常用脚本

```bash
npm run build
npm run lint
npm run typecheck
npm run typecheck:api
```

## 仓库

- GitHub: https://github.com/OIIIIIC/Artifact-Center
