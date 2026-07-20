# Architecture Decision Records (ADR)

本目录记录 artifact-center 项目中的关键架构决策，确保技术选型和设计决策有据可查、可追溯、可复审。

## 什么是 ADR

ADR (Architecture Decision Record) 是一种轻量级的架构决策文档，由 Michael Nygard 在 2011 年提出。每篇 ADR 记录一个具体的架构决策及其上下文、后果。

## 编号规则

所有 ADR 文件使用四位数序号命名，序号按时间顺序递增，不可重复使用，已废弃的 ADR 保留原编号。

## 索引

| 编号                                              | 标题                                         | 状态     |
| ------------------------------------------------- | -------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)     | 采用 ADR 记录架构决策                        | accepted |
| [0002](0002-modular-monolith.md)                  | Modular Monolith 架构                        | accepted |
| [0003](0003-storage-separation.md)                | 元数据与二进制分离存储                       | accepted |
| [0004](0004-object-navigation.md)                 | 基于对象的导航模型                           | accepted |
| [0005](0005-rest-api.md)                          | REST API 风格与统一错误结构                  | accepted |
| [0006](0006-search-evolution.md)                  | 搜索能力渐进演进策略                         | accepted |
| [0007](0007-single-tenant-mvp.md)                 | MVP 单租户架构                               | accepted |
| [0008](0008-drizzle-migration.md)                 | Drizzle ORM + 迁移文件为唯一 Schema 变更入口 | accepted |
| [0009](0009-type-registry.md)                     | Type Registry 制品类型可插拔扩展             | accepted |
| [0010](0010-application-top-object.md)            | Application 作为顶层对象                     | accepted |
| [0011](0011-role-permission.md)                   | 项目级角色权限模型                           | accepted |
| [0012](0012-presigned-download.md)                | 下载链接安全策略 (预签名 URL)                | proposed |
| [0013](0013-testing-strategy.md)                  | 测试策略                                     | accepted |
| [0014](0014-region-application-classification.md) | Region 作为 Application 的可维护分类         | accepted |
| [0015](0015-share-collection.md)                  | Share Collection 承载同地域多制品交付        | accepted |

## 状态标记

每篇 ADR 在文件头部标注状态，使用以下标记之一：

| 状态         | 含义                                       |
| ------------ | ------------------------------------------ |
| `proposed`   | 提案中，尚未正式采纳                       |
| `accepted`   | 已采纳，当前生效                           |
| `deprecated` | 已废弃，不再适用                           |
| `superseded` | 被后续 ADR 取代（需注明取代它的 ADR 编号） |

## 模板

新 ADR 请使用 `template.md` 作为起点。

## 参考

- [Documenting Architecture Decisions - Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub Organization](https://adr.github.io/)
