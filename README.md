<div align="center">
  <img src="./public/images/artifact-center-logo.png" width="96" alt="Artifact Center logo" />

  <h1>Artifact Center</h1>

  <p>企业内部的软件制品管理平台。</p>

  <p>
    <a href="https://github.com/OIIIIIC/Artifact-Center/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/OIIIIIC/Artifact-Center/ci.yml?branch=main&amp;style=flat-square&amp;label=CI" alt="CI status" /></a>
    <img src="https://img.shields.io/badge/status-P1%20MVP-2563eb?style=flat-square" alt="P1 MVP" />
  </p>
</div>

<img src="./public/images/application-hero.png" width="100%" alt="Artifact Center" />

## 关于

Artifact Center 用来集中管理 Android APK、AAB、Windows EXE 和 ZIP 等构建产物。项目以应用为入口，覆盖上传、版本管理、发布说明、下载和分享。

目前处于 P1 MVP 阶段，前端主要流程、API 和 Linux 部署方案已经就绪。

## 技术栈

- Web：React 19、TypeScript、Vite、Tailwind CSS v4、shadcn/ui
- API：Hono、Drizzle ORM、PostgreSQL 16
- 存储：本地文件或 S3 兼容对象存储
- 测试：Vitest、Playwright

## 本地开发

需要 Node.js 22、npm 10 和 Docker。

```bash
git clone https://github.com/OIIIIIC/Artifact-Center.git
cd Artifact-Center

npm install
npm install --prefix apps/api
npm run db:up
npm run db:setup
```

分别启动 API 和 Web：

```bash
# Terminal 1 · http://localhost:3001
npm run dev:api

# Terminal 2 · http://localhost:5173
npm run dev:web
```

本地 seed 账号：`artifact-demo` / `ArtifactCenter-Demo-Only-2026!`

## 生产部署

```bash
cp deploy/.env.example deploy/.env
# 修改 deploy/.env 中的密码、管理员和访问地址
docker compose --env-file deploy/.env -f compose.prod.yml up -d --build
```

HTTPS、升级、备份和恢复见 [生产部署文档](./docs/11-DEPLOYMENT.md)。

## 文档

- [产品设计](./docs/02-DESIGN.md)
- [UI 原则](./docs/07-UI-PRINCIPLES.md)
- [设计系统](./docs/08-DESIGN-SYSTEM.md)
- [API 开发](./apps/api/README.md)
- [领域模型](./CONTEXT.md)

## 检查

```bash
npm run lint
npm run typecheck
npm run typecheck:api
npm test
npm run test:api
npm run build
```
