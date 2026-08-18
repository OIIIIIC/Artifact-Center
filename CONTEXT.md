# CONTEXT.md — artifact-center

> 本文档为 AI 助手提供项目上下文。最后更新: 2026-07-30

## 项目定位

artifact-center 是一个**企业内网软件制品管理平台**。核心使命：帮助团队查找、发布、下载正确的软件制品。

**不是什么**: Dashboard、BI 平台、CI/CD 系统、ERP、OA、DevOps 全家桶。

## 核心领域术语

| 术语                      | 定义                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Application**           | 顶层对象，代表一个软件产品或交付分支。所有制品归属 Application；包名可重复。                                       |
| **Application Code**      | Application 在制品分发命名中的稳定短标识；同一 Region 内唯一，首次发布制品后不可更改。                             |
| **Region**                | 管理员维护的地域基础资料；每个 Application 必须归属一个 Region，用于目录组织与交付范围识别。                       |
| **Artifact**              | 不可变的构建文件，类型 apk/aab/exe/zip。含 sha256、storage_key 等。                                                |
| **Distribution Filename** | Artifact 面向下载和分享的规范文件名；由地域、Application Code、版本、构建号、渠道和文件类型组成，发布后不可变。    |
| **Release**               | 一次有意义的发布，(application_id, version) 唯一。可关联多个 Artifact。                                            |
| **User**                  | 平台用户，role: admin / maintainer / viewer。                                                                      |
| **Share Link**            | 两种模式: latest(指向最新) 和 artifact(固定指向)。                                                                 |
| **Share Collection**      | 一个 Share Link 下的交付清单；包含同一 Region 中一个或多个 Application 的分享项，每项独立选择 latest 或 artifact。 |
| **Audit Log**             | 追加式操作记录，外键可置空但事实保留。                                                                             |
| **Storage Key**           | 二进制存储抽象键，当前本地文件，未来可切换 MinIO/S3。                                                              |
| **Release Credential**    | 平台级机器凭据；可向所有 Application 上传测试版和正式版制品，不代表通用用户会话。                                  |

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
docs/adr/            # 架构决策记录
data/                # 本地制品文件存储
```

## 当前阶段

**P1 MVP (进行中)**。P0 Foundation 已完成，前后端核心页面与 API 已形成基础闭环，正在清理 Mock、补齐自动化验证与真实内测能力。

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
- 分支策略: 待通过 ADR 锁定
- Code Review: 待通过 ADR 锁定
- Commit Message: 使用中文描述，建议遵循 Conventional Commits

## 架构约束

- **风格**: Modular Monolith (ADR-0002)
- **存储**: 元数据 PostgreSQL + 二进制文件系统/对象存储分离 (ADR-0003)
- **API**: REST，统一错误 `{code, message, details}` (ADR-0005)
- **搜索**: ILIKE → pg_trgm → ES 渐进 (ADR-0006)
- **权限**: Viewer/Maintainer/Admin 项目级角色 + Super Admin (ADR-0011)
- **下载**: 禁止公网永久链接，走预签名 URL 或受控流 (ADR-0012)
- **部署**: Docker Compose 内网单机，单租户 MVP (ADR-0007)

## 测试策略

- 已采用 Vitest + Testing Library + jsdom，测试策略见 ADR-0013
- 当前已有前端组件/服务测试与 API 路由测试
- 已配置前端与 API 的 GitHub Actions 基础质量检查
- 待补齐核心用户旅程 E2E、数据库集成测试与首次远端 CI 验证

## 未决决策

| 事项                        | 状态                  |
| --------------------------- | --------------------- |
| API 语言                    | ✅ Node.js + Hono     |
| 单/多租户                   | ✅ 单租户 (ADR-0007)  |
| 分页模型 (cursor vs offset) | ❌ 未锁定             |
| 测试框架                    | ✅ Vitest（ADR-0013） |

## 已知技术债务

本节只保留导航摘要。具体表现、触发条件、影响、代码证据和完成标准以
[优化问题审计](./docs/13-OPTIMIZATION-AUDIT.md) 为准，禁止用“已优化”“后续处理”等不可验证表述关闭问题。

| 问题                       | 用户或运行态的具体表现                                               | 严重度 |
| -------------------------- | -------------------------------------------------------------------- | ------ |
| 核心旅程缺少真实浏览器 E2E | 组件测试通过时，登录、跨层鉴权、下载和路由组合仍可能在真实浏览器失败 | 🔴 高  |
| Mock 与真实数据仍有混用    | 上传预解析仍按文件名猜测元数据，无法验证 APK/AAB 包名、版本和签名    | 🔴 高  |
| 上传仍整文件驻留内存       | 接近 512 MiB 或并发上传时 API 内存可能陡增，拖慢同实例的其他请求     | 🔴 高  |
| 分享令牌哈希迁移收尾       | 新链接已存 HMAC；遗留明文列待 migration 后清空（见 SEC-01）          | 🟡 中  |
| 搜索使用前导通配 ILIKE     | 数据量增长后多字段扫描会让查找主旅程延迟持续上升                     | 🟡 中  |
| 无 APK/AAB 真实解析        | 包名、版本号和签名只能依赖文件名推断或人工填写，存在错发风险         | 🟡 中  |
| 列表分页模型未统一         | 应用和制品积累后响应体、查询和浏览器渲染成本无上限增长               | 🟡 中  |
| 本地文件存储未接对象存储   | 单机扩容、跨机恢复和大文件直传受限                                   | 🟢 低  |

## 参考文档

- [AGENTS.md](./AGENTS.md) — 产品圣经
- [docs/01-PRD.md](./docs/01-PRD.md) — PRD
- [docs/03-ARCHITECTURE.md](./docs/03-ARCHITECTURE.md) — 架构
- [docs/04-ROADMAP.md](./docs/04-ROADMAP.md) — 路线图
- [docs/10-DATABASE.md](./docs/10-DATABASE.md) — 数据库
- [docs/13-OPTIMIZATION-AUDIT.md](./docs/13-OPTIMIZATION-AUDIT.md) — 优化问题、具体表现与验收证据
- [docs/14-ACTIVE-WORK-HANDOFF.md](./docs/14-ACTIVE-WORK-HANDOFF.md) — 多代理协作交接与文件归属
- [docs/adr/](./docs/adr/) — 架构决策记录
