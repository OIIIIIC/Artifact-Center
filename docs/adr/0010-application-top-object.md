# ADR-0010: Application 作为顶层对象 (替代 Project 命名)

- **状态**: accepted
- **日期**: 2026-07-19
- **决策者**: 产品规范 (AGENTS.md §5, 10-DATABASE.md §2)

## 背景

产品圣经定义的核心对象是 Application，而早期 PRD 使用的术语是 Project。实际代码实现中统一使用 `applications` 表。需消除术语不一致带来的混淆。

## 决策

- 顶层对象统一命名为 **Application**
- `applications` 表为产品入口，包含 `package_name`(唯一标识)、`latest_version`(缓存)、`artifact_count`(缓存)
- 应用创建者自动成为该应用的 `maintainer`
- `application_members` 保存应用级角色关系，唯一键 `(application_id, user_id)`
- `latest_version` 和 `artifact_count` 是列表优化缓存，由数据库触发器自动维护，业务代码不得直接修改

## 替代方案

- **继续用 Project**: PRD 仍使用 Project 术语。但 AGENTS.md 和实际代码均为 Application，继续混用会造成 AI 和新成员理解偏差。
- **两者并存**: 增加概念冗余。

## 后果

- **正面**: 术语与代码一致，AI 助手可基于 Application 对象路由准确理解任务
- **负面**: PRD 文档需修订，将 Project 统一为 Application
- **注意**: PRD 中 `Project` 与 AGENTS 和 DB 中 `Application` 指向同一概念，阅读时注意映射
