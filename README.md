# Artifact Center

面向企业内网的现代化制品（Artifact）管理平台。

用于管理 Android APK / AAB、Windows EXE、ZIP 等构建产物；体验对标 Linear、GitHub、Vercel 等现代产品，而非传统 ERP 后台。

## 当前阶段

**工程 Bootstrap + Design System**

- 文档规范：`docs/`
- 前端已初始化：Vite + React + TypeScript + Tailwind v4 + shadcn/ui
- **唯一页面**：`/design-system`（组件与 Token 演示）
- **禁止**：业务页面（Upload / Dashboard / Login 等）

## 规范（必读）

| 文档                                           | 说明             |
| ---------------------------------------------- | ---------------- |
| [02-DESIGN](./docs/02-DESIGN.md)               | 设计准则         |
| [07-UI-PRINCIPLES](./docs/07-UI-PRINCIPLES.md) | UI 决策原则      |
| [08-DESIGN-SYSTEM](./docs/08-DESIGN-SYSTEM.md) | 设计系统执行规范 |

## 技术栈

- React 19 · TypeScript · Vite
- Tailwind CSS v4 · shadcn/ui (Nova)
- Framer Motion · Lucide · TanStack Query · React Router · Zustand
- ESLint · Prettier · Husky · lint-staged

## 开发

```bash
npm install
npm run dev
```

打开 [http://localhost:5173/design-system](http://localhost:5173/design-system)

```bash
npm run build
npm run lint
npm run typecheck
```

## 仓库

- GitHub: https://github.com/OIIIIIC/Artifact-Center
