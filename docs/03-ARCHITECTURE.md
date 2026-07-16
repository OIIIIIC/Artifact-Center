# Artifact Center — 架构设计

> 状态：Foundation v1（概念与边界）  
> 约束：本文只定架构原则与模块边界，**不生成业务代码**。

---

## 1. 目标与约束

### 1.1 架构目标

- 支持企业内网独立部署
- 制品文件与元数据分离存储
- 类型可扩展（APK/AAB/EXE/ZIP → IPA/Firmware）
- 权限与审计一等公民
- 前端体验与后端稳定性解耦演进

### 1.2 约束

- 首版以 **单体可部署** 为主（降低内网运维成本）
- 预留模块化边界，便于拆分
- 对象存储可替换（本地磁盘 / MinIO / S3 兼容）
- 认证可插拔（本地用户 / LDAP / OIDC）

---

## 2. 逻辑架构

```
┌─────────────────────────────────────────────────────────┐
│                     Clients                             │
│   Web App (React)    CI CLI/API    (Future Mobile Web)  │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────┐
│                   API Gateway / BFF                     │
│              Auth · Rate limit · Routing                │
└───────┬─────────────────────┬───────────────────┬───────┘
        │                     │                   │
┌───────▼───────┐   ┌─────────▼─────────┐  ┌──────▼──────┐
│  Artifact     │   │  Project & IAM    │  │  Search     │
│  Service      │   │  Service          │  │  (module)   │
└───────┬───────┘   └─────────┬─────────┘  └──────┬──────┘
        │                     │                   │
┌───────▼─────────────────────▼───────────────────▼──────┐
│              Metadata DB (PostgreSQL 推荐)              │
└─────────────────────────────┬──────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────┐
│     Object Storage (files)  +  Job Worker (parse/scan) │
└────────────────────────────────────────────────────────┘
```

首版可将 API、领域服务、Worker **同进程/同仓库多模块**，逻辑上仍按上图分界。

---

## 3. 前端架构（约定）

### 3.1 技术栈（暂定）

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Framer Motion
- Lucide Icons
- 路由、数据请求库在开工时再锁定（建议 React Router + TanStack Query）

### 3.2 前端分层

```
src/
  app/           # 路由、providers、壳布局
  pages/         # 页面编排（薄）
  widgets/       # 页面级块（列表工具条、上传向导）
  features/      # 领域功能（artifact、project、auth）
  entities/      # 业务实体类型与展示单元
  shared/        # ui、lib、hooks、config、api client
```

原则：

- **pages 不写复杂业务**
- UI 组件无业务副作用
- API 访问集中，禁止页面内散落 raw fetch 风格不一致
- 设计 Token 走 CSS 变量 + Tailwind

### 3.3 状态

- 服务器状态：Query 缓存
- 客户端状态：尽量局部；全局仅用户会话、主题、少量 UI
- 上传进度：独立模块管理，避免污染全局 store

---

## 4. 后端架构（约定）

### 4.1 建议形态

**Modular Monolith**

模块示例：

| 模块 | 职责 |
|------|------|
| identity | 用户、会话、OIDC/LDAP 适配 |
| project | 项目、成员、角色 |
| artifact | 制品元数据、状态机 |
| storage | 预签名上传/下载、分片 |
| search | 检索索引（DB 查询起步） |
| audit | 操作与下载日志 |
| parser | APK 等异步解析 |

### 4.2 API 风格

- REST（首版）或 REST 为主
- 统一错误结构：`code` / `message` / `details`
- 列表统一分页：`cursor` 或 `page+pageSize`（团队选定一种）
- 文件上传：  
  - MVP：直传 API（multipart）  
  - 推荐演进：预签名 → 直传对象存储 → 回调确认

### 4.3 关键用例流

**上传：**

1. 鉴权  
2. 校验项目权限  
3. 创建 `upload session` / 或直接收流  
4. 落对象存储  
5. 写元数据 `status=processing|active`  
6. 异步解析（可选）  
7. 返回制品 DTO  

**下载：**

1. 鉴权与权限  
2. 记审计  
3. 重定向预签名 URL 或受控流式输出  

---

## 5. 数据模型（逻辑）

### 5.1 核心表（概念）

- `users`
- `projects`
- `project_members`（user_id, role）
- `artifacts`
- `artifact_files`（若一制品多文件可拆）
- `audit_logs`
- `api_tokens`（CI，P1）

### 5.2 Artifact 关键字段

见 PRD；索引建议：

- `(project_id, created_at desc)`
- `(project_id, type, status)`
- 搜索：`name` / `version_name` / `filename` / `notes`（MVP 可用 ILIKE；规模上升再上搜索引擎）

### 5.3 文件存储键

```
artifacts/{projectId}/{artifactId}/{filename}
```

或内容寻址：

```
blobs/{sha256}
```

元数据仍指向 blob，利于去重（P1）。

---

## 6. 类型扩展机制

```
TypeRegistry:
  type: "apk"
  extensions: [".apk"]
  parser: ApkParser?
  icon: "android"
  detailFields: [...]
```

规则：

- 核心流程不 `switch` 散落全代码
- 新类型 = 注册 + 可选 parser + UI 展示适配
- 解析失败不影响文件可达

---

## 7. 权限与安全

### 7.1 鉴权

- Session Cookie（同站）或 JWT（按部署选择）
- CI：Personal/Project Access Token（P1）

### 7.2 鉴权点

- 路由级：未登录跳转
- API 级：强制
- 下载 URL：不可公网裸奔永久链接（除非时效签名）

### 7.3 安全基线

- 路径遍历防护
- 上传类型白名单
- 大小限制可配置
- CSRF（Cookie 方案时）
- 审计日志不可被普通用户篡改
- 密钥与 DB 连接走环境变量

---

## 8. 搜索架构

| 阶段 | 方案 |
|------|------|
| MVP | PostgreSQL 查询 + 合理索引 |
| 成长 | 物化搜索字段 / pg_trgm |
| 大规模 | OpenSearch/ES（可选） |

产品上「搜索优先」，实现上可渐进，**接口形状先稳定**。

---

## 9. 部署架构

### 9.1 内网最小集

```
[ Nginx/Caddy ] → [ Web static + API ]
                → [ PostgreSQL ]
                → [ Volume or MinIO ]
```

### 9.2 配置

- `DATABASE_URL`
- `STORAGE_DRIVER=local|s3`
- `S3_*`
- `AUTH_PROVIDER=local|oidc|ldap`
- `MAX_UPLOAD_SIZE`
- `APP_BASE_URL`

### 9.3 可观测

- `/health` `/ready`
- 结构化日志
- 关键操作审计

---

## 10. 前后端边界

| 前端负责 | 后端负责 |
|----------|----------|
| 体验、校验提示、乐观 UI | 权威校验、权限、存储 |
| 展示解析元数据 | 解析与病毒扫描队列 |
| 路由与可达性 | 数据一致性与审计 |

前端永不信任「仅隐藏按钮」作为安全措施。

---

## 11. 技术风险与对策

| 风险 | 对策 |
|------|------|
| 大文件内存打爆 | 流式、分片、直传存储 |
| DB 成瓶颈 | 分页、索引、冷热分离 |
| 磁盘满 | 用量监控、保留策略 |
| 解析器安全 | 独立超时、沙箱化（远期） |
| 单点单体 | 先备份与健康检查，再水平扩展 API |

---

## 12. 仓库结构（未来，非现在创建应用）

目标 monorepo 示意（**当前仓库仅 docs/prompts/references/assets**）：

```
artifact-center/
  docs/
  prompts/
  references/
  assets/
  apps/
    web/          # 未来
    api/          # 未来
  packages/
    shared-types/ # 未来
```

在架构评审通过、规范稳定前，**不初始化应用工程**。

---

## 13. 架构原则清单

1. 模块边界清晰，宁可显式依赖  
2. 元数据与二进制分离  
3. 类型可插拔  
4. 安全默认关闭公网匿名下载  
5. 简单部署优先  
6. 为搜索与审计留正式位置  
7. 不引入与问题规模不匹配的微服务爆炸  

---

## 14. 待决事项（开工前锁定）

- [ ] API 语言：Go / Node / Java 等（不影响当前文档阶段）
- [ ] 上传是否首版即预签名
- [ ] 分页模型：cursor vs offset
- [ ] 单租户 vs 多租户（建议 MVP 单租户）
- [ ] 是否首版上 Docker Compose 一键包

决策后写入本文件修订区。
