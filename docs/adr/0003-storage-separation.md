# ADR-0003: 元数据与二进制分离存储

- **状态**: accepted
- **日期**: 2026-07-19
- **决策者**: 产品规范 (03-ARCHITECTURE.md, 10-DATABASE.md)

## 背景

Artifact Center 需要同时管理制品的描述信息(版本号、渠道、哈希等)和二进制文件(APK/AAB/EXE/ZIP)。两者的访问模式、存储需求和生命周期差异显著。

## 决策

- **元数据**存入 PostgreSQL，通过 Drizzle ORM 管理
- **二进制文件**存入文件系统(当前本地 `data/`)，通过 `storage_key` 抽象引用
- `storage_key` 为存储抽象键，不在业务表中绑定本地磁盘路径

文件存储键命名：

```
artifacts/{projectId}/{artifactId}/{filename}
```

远期可切换为内容寻址 `blobs/{sha256}` 以利去重。

## 替代方案

- **全部存 PostgreSQL (BYTEA/Large Object)**: 大文件会打爆数据库，备份和迁移困难
- **仅存文件系统无元数据**: 无法做搜索、筛选、权限、审计

## 后果

- **正面**: 数据库轻量高效，文件存储可独立扩展和替换(本地→MinIO→S3 透明切换)
- **负面**: 需要额外保证元数据与文件的一致性
- **演进**: 后续接入 MinIO/S3 时只需更换 storage driver，不影响业务逻辑
