# CONTEXT.md — artifact-center

> 本文档为 AI 助手提供项目上下文。最后更新: 2026-07-19 (grill-with-docs 填充)

## 项目定位

artifact-center 是一个**企业内网软件制品管理平台**。核心使命：帮助团队查找、发布、下载正确的软件制品。

**不是什么**: Dashboard、BI 平台、CI/CD 系统、ERP、OA、DevOps 全家桶。

## 核心领域术语

| 术语                 | 定义                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Application**      | 顶层对象，代表一个软件产品或交付分支。所有制品归属 Application；包名可重复。                                       |
| **Region**           | 管理员维护的地域基础资料；每个 Application 必须归属一个 Region，用于目录组织与交付范围识别。                       |
| **Artifact**         | 不可变的构建文件，类型 apk/aab/exe/zip。含 sha256、storage_key 等。                                                |
| **Release**          | 一次有意义的发布，(application_id, version) 唯一。可关联多个 Artifact。                                            |
| **User**             | 平台用户，role: admin / maintainer / viewer。                                                                      |
| **Share Link**       | 两种模式: latest(指向最新) 和 artifact(固定指向)。                                                                 |
| **Share Collection** | 一个 Share Link 下的交付清单；包含同一 Region 中一个或多个 Application 的分享项，每项独立选择 latest 或 artifact。 |
| **Audit Log**        | 追加式操作记录，外键可置空但事实保留。                                                                             |
| **Storage Key**      | 二进制存储抽象键，当前本地文件，未来可切换 MinIO/S3。                                                              |

## 设计原则

1. **聚焦**: 新功能先问 "Does this help users manage software artifacts?"
2. **对象导航**: 导航基于对象 (Applications/Settings)，绝不基于动作 (Upload/Download)
3. **页面自明**: 每个页面回答 "What object am I currently looking at?"
4. **归属原则**: 新功能必须属于已有对象 (Application/Artifact/Release/User)
5. **四大旅程**: Find → Publish → Review History → Share

## 技术栈

| 层   | 技术                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 前端 | React 19 + Vite 8, Radix UI + shadcn/ui + Tailwind CSS 4, Zustand 5, TanStack React Query 5, React Router 7 |
| 后端 | Hono 4 (Node.js), Drizzle ORM, PostgreSQL 16, JWT (jose) + bcryptjs                                         |
| 工程 | ESLint + Oxlint + Prettier, Docker + docker-compose, Zod                                                    |

## 项目结构

```
src/                 # React 前端 (components/features/hooks/i18n/lib/providers/routes/services/store/styles/types)
apps/api/            # Hono 后端 (db/lib/middleware/routes)
docs/                # 产品规范 (00-VISION ~ 11-DEPLOYMENT)
docs/adr/            # 架构决策记录 (0001-0012)
data/                # 本地制品文件存储
```

## 当前阶段

**P1 MVP (进行中)**。P0 Foundation 已完成，前后端脚手架闭环，正在推进后端对接。

## 关键约定

### 产品

- 导航基于对象，禁止动作导向
- 制品类型通过 Type Registry 注册扩展
- 不上 Dashboard / 统计大屏 / 复杂审批流

### 工程

- **Schema 变更**: 只通过 Drizzle migration，禁止 Navicat 直接改表
- **已提交 migration 不可重写**: 修复必须新增下一条
- **生产迁移前**: 必须备份 + 预发布演练
- `latest_version`/`artifact_count` 由触发器维护，业务代码不得直接修改
- 分支策略: TODO (grill 填充)
- Code Review: TODO (grill 填充)
- Commit Message: TODO (grill 填充，建议 Conventional Commits)

## 架构约束

- **风格**: Modular Monolith (ADR-0002)
- **存储**: 元数据 PostgreSQL + 二进制文件系统/对象存储分离 (ADR-0003)
- **API**: REST，统一错误 `{code, message, details}` (ADR-0005)
- **搜索**: ILIKE → pg_trgm → ES 渐进 (ADR-0006)
- **权限**: Viewer/Maintainer/Admin 项目级角色 + Super Admin (ADR-0011)
- **下载**: 禁止公网永久链接，走预签名 URL 或受控流 (ADR-0012)
- **部署**: Docker Compose 内网单机，单租户 MVP (ADR-0007)

## 测试策略

- 当前: **零测试覆盖**
- TODO: grill 访谈填充 (框架选型、E2E 工具、CI 集成)

## 未决决策

| 事项                        | 状态                 |
| --------------------------- | -------------------- |
| API 语言                    | ✅ Node.js + Hono    |
| 单/多租户                   | ✅ 单租户 (ADR-0007) |
| 分页模型 (cursor vs offset) | ❌ 未锁定            |
| 测试框架                    | ❌ 未锁定            |

## 已知技术债务

| 问题                   | 严重度 |
| ---------------------- | ------ |
| 零测试覆盖             | 🔴 高  |
| 无 CI/CD               | 🔴 高  |
| 搜索仅 ILIKE           | 🟡 中  |
| 无 APK/AAB 解析        | 🟡 中  |
| 本地文件存储 (未接 S3) | 🟢 低  |
| 成员管理界面不完整     | 🟢 低  |
| 分页模型未统一         | 🟢 低  |

## 参考文档

- [AGENTS.md](./AGENTS.md) — 产品圣经
- [docs/01-PRD.md](./docs/01-PRD.md) — PRD
- [docs/03-ARCHITECTURE.md](./docs/03-ARCHITECTURE.md) — 架构
- [docs/04-ROADMAP.md](./docs/04-ROADMAP.md) — 路线图
- [docs/10-DATABASE.md](./docs/10-DATABASE.md) — 数据库
- [docs/adr/](./docs/adr/) — ADR 0001-0012
