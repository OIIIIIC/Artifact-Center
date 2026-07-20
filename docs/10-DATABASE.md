# Artifact Center — 数据库设计

> 数据库：PostgreSQL 16  
> ORM：Drizzle ORM  
> 迁移目录：`apps/api/drizzle/`  
> 最后更新：2026-07-20

## 1. 设计目标

数据库保存制品元数据、发布上下文、权限关系、分享链接与审计记录；二进制文件不保存在 PostgreSQL，而由 `storage_key` 指向本地文件存储或未来的对象存储。

设计原则：

- Application 是用户进入制品管理流程的顶层对象。
- Region 是管理员维护的应用目录分类；每个 Application 必须绑定一个 Region。
- Release 表达一次可读的发布，可关联多个不同类型的 Artifact。
- Artifact 是不可变的具体构建文件；状态、渠道和哈希均落在制品层。
- 用户的应用访问权限通过关联表表达，平台管理员保留全局访问能力。
- 审计记录保留行为快照，不依赖被删除用户或应用仍然存在。

## 2. 实体关系

```text
regions ─────< applications
                    │
users ────────< application_members >──────── applications
  │                                                  │
  │                                                  ├──< releases ───< artifacts
  │                                                  │                     │
  ├──< audit_logs                                    │                     └──< share_links
  └──< share_links                                   └──< audit_logs
```

| 表                    | 职责                                |
| --------------------- | ----------------------------------- |
| `users`               | 平台用户、全局角色、登录资料        |
| `regions`             | 可维护的地域基础资料与目录顺序      |
| `applications`        | 应用基础资料与列表页缓存字段        |
| `application_members` | 应用内成员与角色                    |
| `releases`            | 应用内版本的发布说明与发布上下文    |
| `artifacts`           | 单个 APK/AAB/EXE/ZIP 文件及其元数据 |
| `share_links`         | 面向下载者的时效能力链接            |
| `audit_logs`          | 追加式操作记录                      |
| `retention_settings`  | 单租户全局保留策略                  |

## 3. 核心模型

### 3.1 用户与应用成员

`users.role` 是平台级角色：

- `admin`：平台管理员，可管理用户、全局配置并访问全部应用。
- `maintainer`：可在被授予的应用中上传、编辑、分享制品。
- `viewer`：可在被授予的应用中浏览和下载。

`application_members` 保存应用级关系。创建应用时，创建者会自动成为该应用的 `maintainer`。成员唯一键为 `(application_id, user_id)`，因此同一用户在同一应用只能有一个角色。

当前迁移已完成所有者成员回填，后端会在创建应用时写入成员关系，并在应用、制品、分享、搜索和按应用查询审计记录时执行应用级授权。成员管理接口已提供；成员管理界面可在后续迭代继续完善。

### 3.2 地域与应用

`regions` 保存稳定编码、展示名称、排序值和启停状态。`applications.region_id` 为必填外键，并使用 `ON DELETE RESTRICT` 保留历史归属。地域停用后仍可展示已有应用，但不能再用于新建应用或修改绑定。

迁移会创建“默认地域”并回填既有应用，确保旧数据升级后仍满足非空约束。Region 不进入一级导航，只在设置中维护，并在应用目录、搜索、上传选择器和应用详情中用于识别交付范围。

### 3.3 发布与制品

`releases` 使用 `(application_id, version)` 唯一约束。当前上传接口会按该组合创建或复用 Release，这使同一版本可关联 APK 与 AAB 等多个制品。

`artifacts` 保存具体文件：

- `type`：`apk`、`aab`、`exe`、`zip`，由服务端依据扩展名确定。
- `platform`：`android`、`windows`、`zip`，必须与 `type` 一致。
- `build_number`：同一 Release 下同类型构建的区分字段。
- `sha256`、`size_bytes`、`storage_key`：文件完整性与存储定位。
- `parsed_meta`、`build_meta`：为 APK 解析结果、CI 分支和提交信息预留的 JSONB 扩展字段。

`release_notes` 暂同时保存在 Release 与 Artifact：Release 是权威来源；Artifact 字段是为兼容当前前端 DTO 保留的展示快照。后端更新发布说明时会同步同一 Release 下的制品记录。

### 3.4 最新版本

`artifacts.status = 'latest'` 表示当前应用最新制品。数据库通过部分唯一索引保证每个应用最多一条最新制品：

```sql
CREATE UNIQUE INDEX artifacts_one_latest_per_application_uidx
ON artifacts (application_id)
WHERE status = 'latest';
```

`applications.latest_version` 和 `applications.artifact_count` 是列表优化缓存，不是独立事实来源。数据库触发器会在制品新增、更新、删除后自动重算，业务代码不得单独修改这两个字段。

### 3.5 分享与审计

`share_links` 有两种模式：

- `latest`：始终解析为该应用当前最新制品，`artifact_id` 必须为空。
- `artifact`：固定指向某制品，`artifact_id` 必须存在。

数据库检查约束保证两种模式不会混用。固定制品被删除时，其分享链接会级联删除；所有分享下载必须经由 `/public/shares/:token`，不再提供可按制品 ID 公开下载的接口。

`audit_logs` 使用用户名称、摘要和 `meta` 快照保存历史。用户或应用删除后，外键可置空，但审计事实仍然保留。

## 4. 索引与约束

| 对象                  | 约束或索引                              | 原因                               |
| --------------------- | --------------------------------------- | ---------------------------------- |
| `applications`        | `package_name` 普通字段                 | 同一软件的不同分支可使用相同包名   |
| `regions`             | `code`、`name` 分别唯一                 | 保持稳定标识并避免目录重名         |
| `applications`        | `region_id` 非空、删除受限              | 每个应用必须有地域且保留历史归属   |
| `application_members` | `(application_id, user_id)` 唯一        | 防止重复成员关系                   |
| `releases`            | `(application_id, version)` 唯一        | 同一应用同版本只对应一个发布上下文 |
| `artifacts`           | `(release_id, type, build_number)` 唯一 | 防止同一发布重复录入相同构建       |
| `artifacts`           | `(application_id, uploaded_at)`         | 版本列表、保留策略与最新制品查询   |
| `artifacts`           | `status = 'latest'` 部分唯一索引        | 保证每应用只有一个最新制品         |
| `share_links`         | `(application_id, created_at)`          | 分享列表按创建时间读取             |
| `audit_logs`          | `(application_id, created_at)`          | 应用活动流按时间读取               |

搜索当前使用 PostgreSQL `ILIKE`，适合 MVP。数据量增长后再按真实查询词补 `pg_trgm` 索引；不要在数据量很小时预先建立大量 GIN 索引。

## 5. 迁移规范

1. 只通过 Drizzle migration 修改结构，禁止在 Navicat 中直接改表、删列或补索引。
2. 修改 `apps/api/src/db/schema.ts` 后生成新的迁移文件，再审查 SQL 内容。
3. 已提交的 migration 不得重写；修复必须新增下一条 migration。
4. 涉及数据回填、外键或唯一约束时，先验证现有数据，再在 migration 中明确处理策略。
5. 生产执行前必须备份 PostgreSQL，并在预发布库演练迁移与回滚方案。

本地常用命令：

```powershell
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:setup
```

## 6. Navicat 使用

Navicat 连接参数：

```text
连接类型：PostgreSQL
主机：localhost
端口：5432
数据库：artifact_center
用户名：artifact
密码：artifact
```

Navicat 适合查看数据、执行只读查询和导出备份。结构变更必须回到迁移文件，以确保开发、测试与生产环境保持一致。

## 7. 后续演进

- 为应用成员提供更完整的管理界面，例如按邮箱搜索用户、批量调整成员角色。
- 接入 MinIO/S3 后，将 `storage_key` 保持为存储抽象键，不在业务表中绑定本地磁盘路径。
- 解析 APK/AAB 时写入 `parsed_meta`；CI 上传时写入 `build_meta`。
- 数据量上升后采用游标分页、`pg_trgm` 搜索索引与审计归档策略。
- 若需多租户，新增 `organizations`，并将 Application 与 User 归属到组织；当前单租户模型不预置租户字段。
