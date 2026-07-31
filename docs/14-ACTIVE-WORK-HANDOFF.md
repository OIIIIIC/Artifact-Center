# Artifact Center — 当前工作交接

> 最后更新：2026-07-30（Grok 已认领并落地 SEC-01）  
> 用途：供 Grok 与其他协作代理在同一工作树继续推进优化；本文件记录的是**当前事实**，不是待办愿望列表。开始工作前仍须以 `git status`、相关源码和测试为准。  
> **权威工作树**：`C:\Users\Bino\.codex\worktrees\ef0b\artifact-center`（Codex worktree）。主目录 `D:\MyCode\artifact-center` 可能滞后，合并前请以 worktree 为准。

## 1. 总目标与边界

目标是持续完成 Artifact Center 的优化清单：代码、架构、性能、用户体验、UI/视觉、安全、测试、运维、文档与路线图功能，并用当前文件、测试、运行态和构建产物逐项审计。不要把目标缩小为一次修复，也不要在未完成时宣称整体完成。

产品只服务于“查找、发布、下载正确的软件制品”。新功能必须属于 Application、Artifact、Release 或 User，并直接支持 Find、Publish、Review History、Share 之一；不要加入 Dashboard、BI、审批流或泛 DevOps 功能。

## 2. 执行约束

- 中文回复、中文注释、中文 Commit；Windows + PowerShell；文本/文件检索优先 `rg`。
- 修改前读上下文，复用现有实现，尽量缩小变更面。
- Schema 只能经 Drizzle migration；已提交 migration 不可改写，必须追加新 migration。
- 当前工作树是权威来源，**存在大量未提交优化，绝不可用 reset、checkout、clean 或覆盖式格式化回退它们**。
- `src/routes/applications-page.tsx` 包含原有用户改动；只能做针对性合并，不能还原或整文件替换。
- 本轮优先集中实现，不为每个小改动运行全量测试；改完一个相互关联的阶段再统一跑验证。修改者至少应运行受影响的定向测试或明确记录未验证原因。
- 不主动提交、推送、删除文件、重构大模块或新增依赖。若确有必要，先在本文件或交接消息说明影响范围与替代方案。

## 3. 当前工作树状态

`git status --short` 显示约 60 个已修改文件和 30 余个未跟踪文件，覆盖前端、API、迁移、测试、Docker/Nginx、CI、文档。它们是持续优化的交接成果，不是可以清理的临时文件。

当前未提交的新 migration：

- `apps/api/drizzle/0009_hot_arclight.sql`：`(application_id, sha256)` 内容重复检测索引。
- `apps/api/drizzle/0010_polite_golden_guardian.sql`：JWT 撤销相关 Schema（已合并并通过定向测试；真实 PostgreSQL migration 仍待验证）。
- `apps/api/drizzle/0011_share_token_hash.sql`：分享令牌改为 `token_hash`（**Grok 已落地 SEC-01**）。

当前未提交的测试、文档和源码同样需要保留；用 `git diff -- <file>` 确认责任边界后再编辑。

## 4. 已完成、尚未提交的阶段成果与证据

以下是已实现的事实，不代表整个目标完成。详细问题表现、根因、剩余风险和验收标准见 [13-OPTIMIZATION-AUDIT.md](./13-OPTIMIZATION-AUDIT.md)。

| 领域           | 已完成的保障                                                                                                                             | 已有证据/位置                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 前端稳定性     | 路由级 lazy/Suspense、全局 ErrorBoundary、查询取消、HTTP 30 秒超时及取消/超时/网络错误区分                                               | `src/routes/index.tsx`、`src/components/feedback/error-boundary.tsx`、`src/services/http.ts` 与相应测试 |
| 上传可靠性     | 取消/重试/离页提醒、旧请求不能覆盖重试、真实 SHA-256 才参与重复检测、预检加服务端事务复核                                                | `src/features/upload/`、`apps/api/src/routes/artifacts.ts`、`artifact-duplicate-content.test.ts`        |
| 上传体验       | 速度、ETA、100% 后服务端处理中状态、连续 15 秒无进度提示                                                                                 | `upload-telemetry.ts`、`upload-manager.tsx`、`upload-telemetry.test.ts`、`upload-manager.test.tsx`      |
| 授权与下载     | 审计和 Share Collection 按 Application 成员过滤；公开分享最小 DTO/不回显 token/no-store；认证、票据、公开下载支持 Range 且续传不重复计数 | `apps/api/src/routes/{audit,shares,public,artifacts}.ts` 与 API 路由测试                                |
| 部署安全       | 生产环境强制数据库与足够长 JWT 密钥，禁止 `CORS=*`；Nginx 缓存和 CSP/Permissions-Policy；存储路径边界检查                                | `apps/api/src/env.ts`、`deploy/nginx.conf`、`apps/api/src/lib/storage.ts`                               |
| 健康与可运维性 | `/health/live` 与实际检查数据库、存储的 `/health/ready` 分离；Compose 使用 ready                                                         | `apps/api/src/routes/health.ts`、`compose.prod.yml`、健康测试                                           |
| 列表体验       | Application 的搜索、平台、Region、排序同步 URL                                                                                           | `src/features/applications/use-applications.ts` 与测试                                                  |
| UI 可维护性    | 减少动效偏好统一；Fast Refresh 5 条 warning 已清至 0                                                                                     | `src/main.tsx`、Provider/UI 组件；最近 lint 基线                                                        |

最近一次完整验证基线（2026-07-30，后续改动后须重新确认）：前端 17 个测试文件/63 项通过，API 16 个文件/83 项通过；前后端 typecheck 通过；ESLint 0 error/0 warning；生产构建通过；`docker compose config --quiet`、Nginx `nginx -t`、`/health/live` 与 `/health/ready` 均成功。构建虽无单 chunk 超限警告，冷启动入口与 modulepreload 合计仍约 652.63 kB（gzip 约 212.01 kB），不能误报为性能问题已关闭。

## 5. 已集成任务与剩余验证

| 任务                               | 责任边界                                                                                      | 主要文件                                                                                                                                                         | 当前状态与集成要求                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| JWT 撤销与前端兼容                 | 令牌带 `tokenVersion`，密码修改、角色变更和账户停用后旧令牌失效；前端保存密码修改后的新 token | `apps/api/src/{db/schema.ts,lib/jwt.ts,middleware/auth.ts,routes/auth.ts,routes/users.ts}`、`src/store/auth-store.ts`、认证 API/测试                             | 已合并；API 定向测试与全量 API 测试通过。剩余：真实 PostgreSQL migration 和跨实例验证。                                     |
| Application 列表滚动恢复           | 从详情返回时恢复主内容滚动位置；不让普通筛选/直达 URL 被旧位置干扰                            | `src/hooks/use-content-scroll-restoration.ts`、其测试、`src/routes/applications-page.tsx`、详情返回链接相关组件                                                  | 已合并；hook 测试和前端全量测试通过。剩余：真实浏览器前进/后退、刷新、异步长列表高度验证。                                  |
| 上传停滞提示/速度/ETA              | 15 秒无进度提示、恢复提示、处理阶段不误报、平滑速度与 ETA                                     | `src/features/upload/{upload-manager.tsx,upload-task-indicator.tsx,upload-telemetry.ts}` 与测试，`src/services/http.ts`                                          | 已合并；定向和前端全量测试通过。剩余：真实浏览器限速下的误差和停滞阈值验证。                                                |
| **SEC-01 分享 token 哈希（Grok）** | 库内只存 HMAC 摘要；创建时返回一次明文；遗留明文就地升级                                      | `apps/api/src/lib/share-token.ts`、`share-resolution.ts`、`routes/shares.ts`、`db/schema.ts`、`drizzle/0011_share_token_hash.sql`、前端 `share-links-panel`、env | 定向和 API 全量测试通过。剩余：真实 PostgreSQL migration；未访问的遗留链接在就地升级前仍保留明文，需决定轮换/强制回填策略。 |

并行人员完成后，应只交付明确 diff、受影响测试、未验证点和可复现命令；统筹者再合并、解决交叉冲突并统一验证。

## 6. 未完成事项：按风险和可观察表现排序

### P0：安全、数据一致性、容量

1. ~~**分享 token 明文存储**~~ → **Grok 已落地核心路径**（见 §5 / SEC-01 🟡）；剩余生产 migration 与 drop legacy 列。
2. **上传整文件驻留内存**：当前 `parseBody()`、`arrayBuffer()`、`Buffer.from()` 可能使接近 512 MiB 或并发上传同时保留多份内存副本，拖慢同实例请求甚至 OOM；请求大小上限只是缓解，不是流式上传。需要流式写入、临时文件清理和压力验证。**（建议下一项由任一方认领并先写本文件归属）**
3. **服务端取消语义未闭环**：浏览器显示取消时，请求体可能已到 API，仍会解析、写盘、入库；需要 upload session、幂等键、显式取消和断线集成测试。
4. **无硬配额/容量预留**：持续大文件上传可写满磁盘，进而影响 ready 和其他写操作；需要原子预留、软硬阈值、告警和恢复手册。
5. **重复内容真实数据库验证缺失**：代码使用 advisory lock 和索引，但 mock 路由测试不能证明 PostgreSQL 并发、迁移时间和历史重复数据；需要临时 PostgreSQL 集成测试、迁移前重复审计和 EXPLAIN。

### P1：核心旅程性能与数据真实性

1. **无分页模型**：应用/制品量增长后列表查询、响应 JSON 和浏览器渲染无上限增长；先依据 ADR-0006/新增 ADR 锁定 cursor 或 offset，再实现 API 与 URL 契约。
2. **多列前导通配 `ILIKE` 搜索**：目录增大时 PostgreSQL 会反复扫描；应建立真实数据 EXPLAIN 基线，按 ADR-0006 引入 `pg_trgm` 索引与阈值。
3. **真实 APK/AAB 解析缺失**：`mock-parse.ts` 只从文件名猜 package/version；错包或错版本可能被发布。需真实读取 manifest/version/signature，并对 EXE/ZIP 明确保留人工字段。
4. **冷启动依赖仍大**：入口与 modulepreload 合计约 652.63 kB（gzip 212.01 kB），低速内网首屏等待明显；应先测量依赖组成，再按认证状态拆 Provider/非首屏依赖。不要仅为消警告随意 `manualChunks`。
5. **字体体积过大**：`public/fonts` 约 43.62 MiB，常见四个 Alibaba TTF 权重潜在约 31.84 MiB 下载；慢网下造成文字回退/跳变。应改系统字体或生成 WOFF2 子集，并以冷缓存网络面板验证。

### P2：体验、无障碍、测试与运维闭环

1. 分片/断点续传/多文件队列尚无协议；弱网在 99% 断开仍须从头传。
2. 保存筛选未实现；滚动恢复缺真实浏览器验收；移动下载页和二维码入口缺失。
3. 无 axe、键盘/读屏、亮暗主题对比度和视觉回归基线；核心路径可能对辅助技术用户不可用。
4. 无 Playwright 真实 E2E、真实 PostgreSQL 集成、契约、视觉和压力测试；当前单元测试不能证明浏览器/API/数据库/Nginx 组合可用。
5. 诊断记录只在内存保留最近 500 条，重启即丢；备份尚无自动恢复演练。
6. CI Token、Webhook、SSO、对象存储、审计导出仍未闭环。实现前必须分别确定协议、权限和迁移计划。

## 7. 已知风险与审查重点

- 不要把“测试绿”写成“真实浏览器、真实 PostgreSQL 或生产代理已验证”。三者当前仍是独立缺口。
- Range、分享、上传、权限四条链路互相影响；改 API DTO/鉴权错误码必须检查公开下载与前端 HTTP 处理。
- 迁移会改数据库状态；先检查目标数据库、历史数据与备份策略，禁止为测试改写既有 migration。
- 不要删除 `src/store/{applications,artifacts}-store.ts` 或 `src/mocks/{applications,artifacts}.ts`。它们疑似死链，但删除属于明确的清理操作，需先完成依赖图审计并单独记录。
- 不要新增 Playwright、axe、bundle analyzer 等依赖；先提出最小方案及影响。已有依赖和测试可优先复用。
- 不要为“加速”在同一文件上并发编辑。共享工作树没有隔离，冲突会直接覆盖他人的未提交成果。

## 8. Grok/协作代理开工清单

### 必读

1. `AGENTS.md`：产品边界与仓库规范。
2. `CONTEXT.md`：领域模型、架构约束、技术债和参考文档。
3. `docs/13-OPTIMIZATION-AUDIT.md`：每个问题的具体表现、根因与完成标准。
4. `docs/adr/0003-storage-separation.md`、`0005-rest-api.md`、`0006-search-evolution.md`、`0008-drizzle-migration.md`、`0011-role-permission.md`、`0012-presigned-download.md`、`0013-testing-strategy.md`：按所涉任务阅读。
5. 本文件的“当前并行任务”和“文件归属”。

### 必跑的最小命令

开始前（只读）：

```powershell
git status --short
git diff --check
rg -n "<所改领域关键词>" src apps/api docs
```

实现期间：只跑受影响的定向测试。若环境不能直接使用 `npm.cmd`，使用 Codex bundled Node 和仓库本地 CLI；不要因 npm 授权问题停滞。

阶段集成后由统筹者统一执行：

```powershell
npm run verify
docker compose config --quiet
git diff --check
```

涉及 Nginx/Compose、健康检查、迁移或真实浏览器的改动，还必须补相应运行态证据，不能用静态测试替代。

### 禁止事项

- 禁止 `git reset --hard`、`git checkout -- .`、`git clean`、批量覆盖/回退工作树。
- 禁止擅自提交、推送、安装依赖、删除死代码或改写历史 migration。
- 禁止在未读上下文时重构 Provider/API 模块；不要顺手格式化无关文件。
- 禁止声称“全部完成”；关闭审计项必须补充测试、构建、运行态或数据证明。

## 9. 文件归属与避冲突规则

| 区域                                                                                                                                                   | 当前归属                             | 其他代理规则                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------- |
| `apps/api/src/lib/jwt.ts`、认证中间件/路由、用户密码安全、`0010` migration、认证撤销测试                                                               | 已集成（Codex）                      | 新任务涉及认证时先读取 tokenVersion 契约；不要绕过当前用户回查。 |
| `src/hooks/use-content-scroll-restoration*`、`src/routes/applications-page.tsx`、详情返回 URL                                                          | 已集成（Codex）                      | `applications-page.tsx` 仍有用户原有修改；只做针对性合并。       |
| `src/features/upload/upload-manager*`、`upload-telemetry*`、`upload-task-indicator.tsx`、`src/services/http.ts` 的上传进度路径                         | 已集成（Codex）                      | 新任务需同时保持取消/重试、处理阶段和停滞状态机的一致性。        |
| `apps/api/src/routes/artifacts.ts`、`0009` migration、重复内容测试                                                                                     | 已完成的重复内容阶段，待真实 DB 验证 | 新任务若涉及流式上传/配额，先拆分设计，避免覆盖重复检测。        |
| `docs/13-OPTIMIZATION-AUDIT.md`、本文件                                                                                                                | 统筹文档                             | 协作方可提出事实修订，集中由统筹者合入，避免多人同时编辑。       |
| `apps/api/src/lib/share-token.ts`、`share-resolution.ts` 分享解析、`routes/shares.ts` 创建/列表映射、`0011_share_token_hash.sql`、分享列表 UI 复制逻辑 | **Grok · SEC-01**                    | Codex 只读审查；不要并行改 token 列语义。                        |

### Grok 本轮已交付（2026-07-30）

- SEC-01 分享令牌 HMAC 存储 + 创建一次性明文 + 遗留升级路径
- 定向测试：`share-token.test.ts`、`env.test.ts`（含 SHARE_TOKEN_PEPPER）
- 文档：本文件与 `13-OPTIMIZATION-AUDIT.md` 已更新状态

任何新任务开始前，在交接消息中声明“目标、计划修改文件、验证方式”。如果目标碰到已归属文件，改为审查建议或等待统筹分配。
