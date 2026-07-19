# ADR-0007: MVP 单租户架构

- **状态**: accepted
- **日期**: 2026-07-19
- **决策者**: 产品规范 (03-ARCHITECTURE.md §14, 10-DATABASE.md §7)

## 背景

Artifact Center 首版面向企业内网单一团队或部门部署。多租户(Organization 隔离)会显著增加数据模型、权限和查询的复杂度。

## 决策

MVP 采用**单租户模型**，不在数据表中预置租户字段。

所有数据共享同一 PostgreSQL database。Application 作为顶层隔离边界。权限通过 `application_members` 表实现应用级访问控制。

## 替代方案

- **首版即多租户**: 每个查询都需带 `organization_id` 过滤，大幅增加开发复杂度。PRD 明确"当前阶段不做多租户"
- **Database 级隔离**: 运维成本过高，与 MVP 定位不符

## 后果

- **正面**: 查询简洁，开发效率高，部署简单
- **负面**: 若未来需要多租户，需要新增 `organizations` 表并将 Application 与 User 归属到组织，属于 Breaking Schema Change
- **演进路径**: DB 文档 §7 已记录："若需多租户，新增 `organizations`，并将 Application 与 User 归属到组织；当前单租户模型不预置租户字段"
