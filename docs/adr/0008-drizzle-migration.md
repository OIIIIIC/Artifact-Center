# ADR-0008: Drizzle ORM + 迁移文件为唯一 Schema 变更入口

- **状态**: accepted
- **日期**: 2026-07-19
- **决策者**: 产品规范 (10-DATABASE.md §1, §5)

## 背景

数据库 Schema 变更是团队协作中最容易出错的环节。需要保证开发、测试、生产环境 Schema 一致，且变更可追溯、可回滚。

## 决策

- ORM: **Drizzle ORM**，类型安全的 TypeScript-first ORM
- **只通过 Drizzle migration 修改结构**，禁止在 Navicat/pgAdmin 中直接改表、删列或补索引
- 修改 `apps/api/src/db/schema.ts` 后生成新的迁移文件，审查 SQL 内容后再执行
- **已提交的 migration 不得重写**；修复必须新增下一条 migration
- 涉及数据回填、外键或唯一约束时，先验证现有数据，再在 migration 中明确处理策略
- 生产执行前必须备份 PostgreSQL，并在预发布库演练迁移与回滚方案

## 替代方案

- **Navicat 直接改表**: 无法追溯、无法回滚、环境不一致。明确禁止。
- **Prisma**: 当时选型已确定 Drizzle ORM(类型安全、轻量、SQL-like API)，不再评估替代品
- **手写 SQL 迁移**: Drizzle 已内置迁移生成，手写增加出错概率

## 后果

- **正面**: Schema 变更可追溯(git)、可复现、可回滚；开发-测试-生产一致
- **负面**: 所有变更需走代码审查流程，Navicat 仅用于只读查询和导出备份
- **约束**: 团队必须遵守 migration 纪律，禁止绕过
