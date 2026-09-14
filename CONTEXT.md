# CONTEXT.md — artifact-center

> 本文档为 AI 助手提供项目上下文。最后更新: 2026-09-10

## 项目定位

artifact-center 是一个**企业内网软件制品管理平台**。核心使命：帮助团队查找、发布、下载正确的软件制品。

**不是什么**: Dashboard、BI 平台、CI/CD 系统、ERP、OA、DevOps 全家桶。

## 核心领域术语

| 术语                      | 定义                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Application**           | 制品管理的核心入口，属于一个 Project。所有制品归属 Application；包名可重复。                                                                |
| **Application Code**      | Application 在制品分发命名中的可重复短代码；不用于唯一识别应用，可随时修改，修改后仅影响新发布制品的分发文件名。                            |
| **Product**               | 产品目录，替代原 Region 名称；保留原条目与 ID。一个产品包含多个项目。                                                                       |
| **Project**               | 属于一个 Product 的应用分类；每个应用归属一个项目，每个产品有稳定的默认项目。                                                               |
| **Artifact**              | 不可变的构建文件，类型 apk/aab/exe/zip/tar/tar.gz/deb/rpm/appimage。含 sha256、storage_key 等。                                             |
| **Distribution Filename** | Artifact 面向下载和分享的规范文件名；由项目代码（未设置时沿用产品代码）、Application Code、版本、构建号、渠道和文件类型组成，发布后不可变。 |
| **Release**               | 一次有意义的发布，(application_id, version) 唯一。可关联多个 Artifact。                                                                     |
| **User**                  | 平台用户，role: admin / maintainer / viewer。                                                                                               |
| **Share Link**            | 两种模式: latest(指向最新) 和 artifact(固定指向)。                                                                                          |
| **Share Collection**      | 一个 Share Link 下的交付清单；包含同一 Product 中一个或多个 Application 的分享项，每项独立选择 latest 或 artifact。                         |
| **Audit Log**             | 追加式操作记录，外键可置空但事实保留。                                                                                                      |
| **Storage Key**           | 二进制存储抽象键，当前本地文件，未来可切换 MinIO/S3。                                                                                       |
| **Release Credential**    | 平台级机器凭据；可向所有 Application 上传测试版和正式版制品，不代表通用用户会话。                                                           |
| **Personal Workspace**    | 属于 User 的个性化页面；保存收藏、最近访问和目录偏好。它是工作入口，但不承载平台统计或 Dashboard 指标。                                     |

## 产品与项目目录（2026-09-09）

- Product → Project → Application；现有开封、三沙、十堰等产品名称与 ID 保留。
- 既有应用通过迁移归入各产品的默认项目，之后可编辑归属。默认项目不可删除或停用。
- 产品与项目树位于主侧栏下方，内容区保留卡片宽度；箭头只控制展开，名称控制筛选。手机使用紧凑选择器。
- 应用详情页延续同一目录，并提供项目下的应用叶节点。应用按展开项目分页加载，切换应用保留目录状态和有效页签；直达详情定位当前路径，支持目录搜索与收起（2026-09-11）。
- 产品管理页铺满顶栏下方：左侧选产品、右侧原位维护项目，两栏独立滚动；支持草稿保留、URL 恢复及事务保存项目顺序。
- 产品、项目为目录元数据，不引入项目管理流程或项目级 ACL；应用权限规则不变。
- 数据库 regions / region_id 与既有 Region API 暂留作兼容名称；/regions 页面兼容跳转至 /products。
- 分享范围改称同产品范围，项目不改变分享令牌或发布归属；新上传制品优先使用项目编码作为文件名前缀，历史文件名保持不变（ADR-0022）。
- 创建分享清单时，候选范围跟随当前目录节点：产品节点包含该产品各项目，项目节点仅包含该项目；名称同步使用当前节点。候选在服务端先按维护权限、未归档且有制品筛选，每页 20 个，跨页最多选择 20 个，不读取全量应用目录（2026-09-11）。
- 详见 [ADR-0019](docs/adr/0019-product-project-directory.md)。迁移与本地验证已准备，上线前须完成备份及 PostgreSQL 16 预发布演练。

## 项目下载前缀（2026-09-14）

- 管理员可在编辑项目时设置项目编码，例如 `shiyan`；同一项目下所有应用的新上传制品使用同一前缀。
- 编码未设置时继续沿用产品编码；已有项目不自动生成拼音编码。编码修改不改写历史包或已创建的上传会话。
- 新增迁移 `0027_project_download_codes`，见 [ADR-0022](docs/adr/0022-project-download-prefix.md)。

## Linux 平台与文件格式（2026-09-11）

- 平台为 Android / Windows / Linux；`linux` 替代旧平台值 `zip`，API 输入和历史筛选参数兼容旧值。
- Linux 支持 ZIP、TAR、TAR.GZ/TGZ、DEB、RPM、AppImage。ZIP 仍是文件格式，不再作为平台名称。
- 前后端共用纯领域类型注册表；完整复合后缀保留到分发文件名。原生包元数据不自动解析，版本仍由用户确认。
- 新迁移 `0026_linux_platform` 保留历史制品文件名和存储路径。见 [ADR-0021](docs/adr/0021-linux-platform-and-package-types.md)。

## 数据量性能（2026-09-10）

- 主应用列表按 24 个分页；制品/发布历史按 30/20 条分页，服务端先筛选与鉴权再取页。目录计数通过独立汇总接口读取。
- 概览只取最近 3 个制品及独立 latest；完整历史在页签打开后读取。索引支持时间 + ID 游标，保留数据库微秒精度。
- 全局搜索使用两条先鉴权的候选分支及一个 pg_trgm GIN 表达式索引，仍按原字段复核匹配。
- 已用 PostgreSQL 16 的 300 应用 × 300 制品数据验证，见 [测量记录](docs/performance-2026-09-10.md) 与 [ADR-0020](docs/adr/0020-bounded-catalog-history.md)。旧兼容接口与部分选择器保留完整列表语义。

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
- 个人工作台是独立入口，但禁止扩展成平台统计 Dashboard
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
- **权限**: Application Viewer/Maintainer 决定应用操作；平台 Admin 全局管理，平台 Maintainer 可创建应用 (ADR-0011)
- **下载**: 禁止公网永久链接，走预签名 URL 或受控流 (ADR-0012)
- **部署**: Docker Compose 内网单机，单租户 MVP (ADR-0007)

## 测试策略

- 已采用 Vitest + Testing Library + jsdom，测试策略见 ADR-0013
- 当前已有前端组件/服务测试与 API 路由测试
- 已配置前端与 API 的 GitHub Actions 基础质量检查
- 待补齐核心用户旅程 E2E、数据库集成测试与首次远端 CI 验证

## 未决决策

| 事项                        | 状态                                                  |
| --------------------------- | ----------------------------------------------------- |
| API 语言                    | ✅ Node.js + Hono                                     |
| 单/多租户                   | ✅ 单租户 (ADR-0007)                                  |
| 分页模型 (cursor vs offset) | ✅ 主列表采用游标分页（ADR-0020），兼容旧完整列表接口 |
| 测试框架                    | ✅ Vitest（ADR-0013）                                 |

## 已知技术债务

本节只保留导航摘要。具体表现、触发条件、影响、代码证据和完成标准以
[优化问题审计](./docs/13-OPTIMIZATION-AUDIT.md) 为准，禁止用“已优化”“后续处理”等不可验证表述关闭问题。

| 问题                         | 用户或运行态的具体表现                                               | 严重度 |
| ---------------------------- | -------------------------------------------------------------------- | ------ |
| 核心旅程缺少真实浏览器 E2E   | 组件测试通过时，登录、跨层鉴权、下载和路由组合仍可能在真实浏览器失败 | 🔴 高  |
| Mock 与真实数据仍有混用      | 上传预解析仍按文件名猜测元数据，无法验证 APK/AAB 包名、版本和签名    | 🔴 高  |
| 上传仍整文件驻留内存         | 接近 512 MiB 或并发上传时 API 内存可能陡增，拖慢同实例的其他请求     | 🔴 高  |
| 分享令牌哈希迁移收尾         | 新链接已存 HMAC；遗留明文列待 migration 后清空（见 SEC-01）          | 🟡 中  |
| 低选择性搜索仍需关注         | 搜索索引已改善版本查找；单字符查询在 9 万制品下空闲测量 P95 约 248ms | 🟡 中  |
| 无 APK/AAB 真实解析          | 包名、版本号和签名只能依赖文件名推断或人工填写，存在错发风险         | 🟡 中  |
| 兼容接口与部分选择器全量加载 | 主列表已分页；旧兼容接口和批量选择器仍随应用数量增长                 | 🟡 中  |
| 本地文件存储未接对象存储     | 单机扩容、跨机恢复和大文件直传受限                                   | 🟢 低  |

## 参考文档

- [AGENTS.md](./AGENTS.md) — 产品圣经
- [docs/01-PRD.md](./docs/01-PRD.md) — PRD
- [docs/03-ARCHITECTURE.md](./docs/03-ARCHITECTURE.md) — 架构
- [docs/04-ROADMAP.md](./docs/04-ROADMAP.md) — 路线图
- [docs/10-DATABASE.md](./docs/10-DATABASE.md) — 数据库
- [docs/13-OPTIMIZATION-AUDIT.md](./docs/13-OPTIMIZATION-AUDIT.md) — 优化问题、具体表现与验收证据
- [docs/14-ACTIVE-WORK-HANDOFF.md](./docs/14-ACTIVE-WORK-HANDOFF.md) — 多代理协作交接与文件归属
- [docs/adr/](./docs/adr/) — 架构决策记录
