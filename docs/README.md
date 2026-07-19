# Artifact Center — 文档索引

本目录是项目的 **唯一权威规范源**。所有人工与 AI 实现必须遵守。

| 文档                                                       | 说明                 |
| ---------------------------------------------------------- | -------------------- |
| [00-VISION.md](00-PRODUCT_BIBLE.md)                        | 产品愿景与北极星     |
| [01-PRD.md](./01-PRD.md)                                   | 产品需求与 MVP 边界  |
| [02-DESIGN.md](./02-DESIGN.md)                             | **设计规范（重点）** |
| [03-ARCHITECTURE.md](./03-ARCHITECTURE.md)                 | 系统架构与边界       |
| [04-ROADMAP.md](./04-ROADMAP.md)                           | 阶段路线图           |
| [05-CODING-STANDARD.md](./05-CODING-STANDARD.md)           | 编码规范             |
| [06-COMPONENT-GUIDELINES.md](./06-COMPONENT-GUIDELINES.md) | 组件分层与清单       |
| [07-UI-PRINCIPLES.md](./07-UI-PRINCIPLES.md)               | UI 决策原则          |
| [10-DATABASE.md](./10-DATABASE.md)                         | 数据库模型与迁移规范 |
| [11-DEPLOYMENT.md](./11-DEPLOYMENT.md)                     | Ubuntu 生产部署      |
| [TODO.md](./TODO.md)                                       | 待办与后端后优先项   |

## 阅读顺序（新人 / AI）

1. Vision → PRD
2. **DESIGN → UI Principles**（做任何界面前必读）
3. Architecture → Roadmap
4. Coding Standard → Component Guidelines
5. **Database**（表结构、约束与迁移规范）
6. **TODO**（前端收口与后续能力）

## 当前阶段

- **前端 Mock 壳**：核心页面与主路径已基本完成（见 `TODO.md` 已完成项）。
- **后端脚手架**：`apps/api`（Hono + PostgreSQL + 本地文件），见 [apps/api/README.md](../apps/api/README.md)。
- **下一步**：前端对接真实 API；后端可用后优先做 **操作记录（审计）**（见 `TODO.md`）。

相关目录：

- `../apps/api/` — 后端 API
- `../prompts/` — AI 提示词（待补充）
- `../references/` — 参考资料
- `../assets/` — 品牌与设计资源
