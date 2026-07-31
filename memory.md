# Artifact Center 工作记忆与交接

> 更新日期：2026-07-30  
> 本文件用于跨会话和与 Grok 协作时快速恢复事实。工作树优先于本文；继续前先执行 `git status --short`、查看相关 diff。

## 协作账本（Codex 与 Grok 共用）

本节是当前唯一的跨 AI 协作状态来源。开始、变更范围、验证结果或阻塞状态发生变化时，负责人必须更新对应条目；工作树和测试结果优先于文字描述。

| 任务                                 | 负责人       | 状态                                            | 文件边界                                                               | 验证/交接                                                                                   |
| ------------------------------------ | ------------ | ----------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 三项旧工作树改动恢复、审查与全量回归 | Codex        | 已完成                                          | JWT、滚动恢复、上传遥测                                                | 见下方 Codex 验证记录                                                                       |
| **SEC-01 分享 token HMAC 存储**      | Grok         | 审查完成；真实 PG migration 待 Codex 有库时验证 | `share-token*`、`share-resolution`、`shares.ts`、`0011_*`、分享列表 UI | 定向 9/9 已通过；勿并行改 hash 语义                                                         |
| **下一批分工（2026-07-30 统筹）**    | 见 §协作分工 | **Codex A 前四项已完成**                        | **严格按表内文件边界**                                                 | SEC-03、DEV-01、REL-05、PERF-05 已完成；真实 PostgreSQL migration 冒烟待具备 Docker PG 环境 |

---

## 协作分工：未完成问题分配（Grok 统筹 · 2026-07-30）

> 依据 `docs/13-OPTIMIZATION-AUDIT.md` 中 **❌ 未做** 与 **🟡 未闭环** 条目。  
> **原则**：文件不重叠；本批不新增 npm 依赖；不改写既有 migration；不删死代码；不做分片/Playwright/扫描器等需先 ADR 或新依赖的大项。

### A. Codex 本批（后端 / 安全 / 运维向）— 请按序开干

| 顺序 | 审计编号    | 任务                                                                                                                                            | 状态                 | 允许修改的主要文件                                                                                      | 禁止                                                  | 建议验证                                                                                                                                                                                                                              |
| ---- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **SEC-03**  | 登录 + 公开分享解析/下载 **进程内限流**（429 + Retry-After）                                                                                    | ✅ 已完成（Codex）   | `apps/api/src/middleware/rate-limit.ts`、`auth.ts` login、`public.ts`、`rate-limit.test.ts`、`env.ts`   | 未改 `shares.ts`、`share-token*` 或前端               | `npm test --prefix apps/api -- --run src/__tests__/rate-limit.test.ts src/__tests__/auth-revocation.test.ts`（7 项通过）；`npm run typecheck:api` 通过。多实例共享限流待后续外部存储方案。                                            |
| 2    | **DEV-01**  | 清掉当前 **5 条 Fast Refresh warning**                                                                                                          | ✅ 已完成（Codex）   | `src/components/ui/{badge,button,tabs}.tsx`、应用状态元数据、上传 Context；仅拆出非组件导出             | 不顺手大重构；未动 `applications-page.tsx`            | `npm run lint`（0 warning）；`npx vitest run src/features/upload/upload-manager.test.tsx src/i18n/locales.test.ts`（4 项通过）；`npm run typecheck` 通过                                                                              |
| 3    | **REL-05**  | 上传前 **硬配额/磁盘阈值**（达阈值拒绝，非仅展示用量）                                                                                          | ✅ 本批完成（Codex） | 新增 `apps/api/src/lib/upload-capacity.ts`；上传写盘前校验；保留设置 API；`env.ts`；容量单测            | 未改前端 upload-manager / telemetry；未改 SEC-01 文件 | `npm test --prefix apps/api -- --run src/__tests__/upload-capacity.test.ts src/__tests__/storage.test.ts`（7 项通过）；`npm run typecheck:api`、`npm run lint` 通过。单进程预留可防本进程并发越额；多 API 实例仍需共享预留/存储方案。 |
| 4    | **PERF-05** | 搜索/列表 `ILIKE`：**可落地的第一步**（查询超时保护或字段裁剪 + 文档记录 EXPLAIN 基线步骤）；**不要**本批上 `pg_trgm` 除非只加 migration 且自测 | ✅ 本批完成（Codex） | `apps/api/src/routes/search.ts`、`apps/api/src/routes/applications.ts`、`docs/13-OPTIMIZATION-AUDIT.md` | 未改前端筛选 URL 逻辑；未新增 `pg_trgm` migration     | `npm test --prefix apps/api`（13 文件 / 58 项通过）；`npm run typecheck:api`、`npm run lint` 通过。目标规模 EXPLAIN/P95 待有真实 PostgreSQL 数据后按审计文档执行。                                                                    |
| 5    | **验证**    | 有 Docker PG 时：跑 `0009`–`0011` migration + 冒烟创建分享/登录                                                                                 | 待办                 | 只读/迁移执行，不改 SQL 文件内容                                                                        | —                                                     | 记录命令与结果到 `memory.md`                                                                                                                                                                                                          |

**Codex 本批不要碰**：`share-token.ts`、`share-resolution.ts` 分享 hash、`0011_share_token_hash.sql` 语义、`src/features/share/share-links-panel.tsx`、Grok 的字体/筛选/首屏 Provider 文件。

### B. Grok 本批（前端 / 体验 / 包体向）

| 顺序 | 审计编号            | 任务                                                               | 状态             | 允许修改的主要文件                                        | 禁止                               | 建议验证                                          |
| ---- | ------------------- | ------------------------------------------------------------------ | ---------------- | --------------------------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| 1    | **PERF-02**         | 字体减负：系统栈优先 + 仅 4 个 TTF 引用 + `font-display: optional` | **完成 🟡**      | `fonts.css`、`tokens.css`                                 | 未删 public/fonts                  | 定向测试绿；冷缓存网络面板待补                    |
| 2    | **PERF-01**         | 未登录不挂载 UploadManager/任务条                                  | **完成 🟡**      | `app-providers.tsx`                                       | 未改 upload 内部                   | 登录前后行为自测；完整 bundle 报告待补            |
| 3    | **UX-04**           | 个人 platform/sort 偏好 localStorage，URL 优先                     | **完成 🟡**      | `use-saved-filters.ts` + test、`use-applications.ts`      | 未改 applications-page / 滚动 hook | `use-saved-filters` 3 + `use-applications` 4 通过 |
| 4    | **A11Y-01**         | 登录 aria + 全局 focus-visible + bootstrap status                  | **完成 🟡**      | `login-page`、`form-error`、`auth-bootstrap`、`index.css` | 未加 axe                           | 键盘 Tab 自检：登录表单项 → 提交；焦点环可见      |
| 5    | **SEC-01 收尾配合** | DROP legacy token 列                                               | 等 Codex PG 验证 | 未来 `0012_*`                                             | —                                  | —                                                 |

**Grok 本批不要碰**：`apps/api/src/routes/auth.ts`、`public.ts`、限流中间件、`artifacts.ts` 配额逻辑、`search.ts` 查询、JWT/`0010`、upload-manager/telemetry。

### Grok 本批交付记录（2026-07-30 续）

- **实际修改**：`src/styles/fonts.css`、`tokens.css`、`src/providers/app-providers.tsx`、`src/features/applications/use-saved-filters.ts`、`use-saved-filters.test.ts`、`use-applications.ts`、`src/routes/login-page.tsx`、`src/components/feedback/form-error.tsx`、`src/components/auth-bootstrap.tsx`、`src/index.css`、`docs/13`、`memory.md`
- **测试**：`npx vitest run src/features/applications/use-saved-filters.test.ts src/features/applications/use-applications.test.ts` → 7 passed
- **未验证**：冷缓存字体传输量、生产 build 入口体积对比、分享对话框完整读屏
- **未碰 Codex A 表文件**

### C. 暂缓（需 ADR / 新依赖 / 外部系统，双方都不要擅自开干）

| 编号                                                              | 原因                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| SEC-04 恶意扫描                                                   | 需隔离存储状态机 + 扫描器接口设计                            |
| UX-03 分片/断点续传/多文件队列                                    | 需上传协议 ADR                                               |
| PERF-03 流式上传内存                                              | 与 REL-05/artifacts 强耦合；排在 Codex REL-05 之后再单独立项 |
| PERF-04 分页                                                      | 先 ADR 锁定 cursor/offset，再前后端一起做                    |
| TEST-01 Playwright E2E                                            | 新增依赖，需用户确认                                         |
| TEST-02/03 真库集成、契约/视觉/压力                               | 基建较大；可与 PERF-04/CI 一起规划                           |
| OPS-02 备份恢复演练                                               | 运维手册 + 环境，非纯代码                                    |
| UX-05 移动二维码                                                  | 若引入 QR 库需确认依赖；否则仅文档化深链                     |
| 路线图 6 项（CI Token/Webhook/SSO/对象存储/审计导出/真 APK 解析） | 协议与权限未锁                                               |

### D. 文档状态订正（任一方改 docs/13 时）

- **SEC-02 JWT 撤销**：实现已用 `tokenVersion` 落地 → 审计应改为 **✅ 或 🟡（缺多实例验证）**，不要再当 ❌ 开新坑。
- **SEC-01**：保持 **🟡**，直到真实 PG migration + 可选 drop 列。

### 本轮 Codex 恢复与验证（2026-07-30）

- 已从旧 Codex 工作树按功能合并 JWT `tokenVersion` 撤销、列表滚动恢复、上传速度/ETA/服务端处理阶段与 15 秒停滞提示；没有整文件覆盖 Grok 的 SEC-01。
- Drizzle migration journal 已恢复为 `0009`、`0010`、`0011` 的连续顺序；`0011` 保持 Grok 的分享 token 哈希迁移。
- 验证通过：ESLint 0 warning、前端 typecheck、API typecheck、前端 18 个测试文件/65 项、API 13 个测试文件/58 项、生产构建、`docker compose config --quiet`、`git diff --check`。
- 未验证：真实 PostgreSQL migration/并发、真实浏览器滚动与限速上传、Nginx 语法（本机无 `nginx:alpine` 镜像）；`compose.prod.yml` 因未配置 `POSTGRES_PASSWORD` 按预期拒绝渲染。

### Grok · SEC-01 完成交接（2026-07-30）

- **目标**：分享链接库内只存 HMAC 摘要；创建一次性返回明文；遗留明文就地升级；列表不可重放。
- **负责人**：Grok
- **状态**：待 Codex/统筹审查（代码已写入主工作树 `D:\MyCode\artifact-center`）
- **实际修改文件**：
  - 新建：`apps/api/src/lib/share-token.ts`、`apps/api/drizzle/0011_share_token_hash.sql`、`apps/api/src/__tests__/share-token.test.ts`
  - 修改：`apps/api/src/env.ts`、`apps/api/src/db/schema.ts`、`apps/api/src/lib/share-resolution.ts`、`apps/api/src/routes/shares.ts`、`apps/api/.env.example`、`apps/api/drizzle/meta/_journal.json`、`apps/api/src/__tests__/env.test.ts`、`src/services/api.ts`、`src/features/share/share-links-panel.tsx`、`src/i18n/locales/zh-CN.json`、`src/i18n/locales/en-US.json`、`docs/13-OPTIMIZATION-AUDIT.md`、`memory.md`
- **测试结果**：
  ```text
  cd D:\MyCode\artifact-center\apps\api
  npx vitest run src/__tests__/share-token.test.ts src/__tests__/env.test.ts
  # Test Files  2 passed | Tests  9 passed
  ```
- **未验证风险**：
  - 未在真实 PostgreSQL 上执行 `0011_share_token_hash` migration
  - 未跑路由级分享创建/解析集成测试（当前无 DB 集成夹具）
  - 未跑全量 `npm run verify`（留给 Codex 审查任务）
  - 主树 journal 在 0008 后直接追加 0011 标签（idx=9）；若与含 0009/0010 的 worktree 合并需对齐序号
  - 列表不再返回明文 token，旧 UI 依赖“再次复制”的路径会看到「创建时已复制」
- **建议后续**：
  1. Codex 审查时可抽查 `shares.ts` 创建响应仍带 `token`、列表 `token` 为空
  2. 有库环境执行 migration 后创建/打开旧链接各一次，确认升级清空 legacy 列
  3. 生产配置独立 `SHARE_TOKEN_PEPPER`（≥32）
- **明确未碰**：上传体验相关、JWT 撤销相关、`applications-page.tsx`、滚动恢复 hook

协作规则：

- 认领前先阅读本文件、`AGENTS.md`、`CONTEXT.md` 与相关 diff，并把“目标、文件边界、验证命令”写入上表。
- 不修改对方已认领文件；发现问题先写入“验证/交接”或告知用户，由负责人处理。
- 完成后把状态改为“待审查”或“完成”，列出实际修改、已通过测试和仍未验证的场景；不要仅写“已完成”。
- 不执行 `git reset --hard`、`git checkout -- .`、`git clean`，不擅自提交、推送、删除文件、重构大模块或新增依赖。

## 1. 项目当前进度

Artifact Center 正在持续完成覆盖前端、API、安全、性能、体验、测试、运维和路线图能力的优化清单，**整体尚未完成**。当前工作树包含大量未提交的阶段性成果（约 60 个已修改文件及 30 余个新增文件），均应保留。

本轮已完成三个相互独立的实现任务，并已对当前合并结果执行统一回归：

- 上传速度、ETA、服务端处理阶段与 15 秒无进度停滞提示。
- JWT 令牌版本撤销、账户停用与前端密码修改后的令牌轮换保存。
- Application 列表从详情返回后的滚动位置恢复。

当前可复现验证基线为：前端 18 个测试文件、65 项通过；API 13 个测试文件、58 项通过；前后端 TypeScript、生产构建、默认 Compose 配置和 diff 检查通过。ESLint 为 0 warning；真实 PostgreSQL、Nginx 和浏览器场景仍未验证。

完整问题清单与具体表现见 `docs/13-OPTIMIZATION-AUDIT.md`；协作分工与文件边界见 `docs/14-ACTIVE-WORK-HANDOFF.md`。

## 优先级裁剪（内测导向 · 2026-07-30）

> **原则**：不必做完审计全部条目。问三句——没有会不会天天出事？是否 10 倍规模才痛？是否要上新系统/ADR？  
> 详细问题仍以 `docs/13` 为准；本节是**执行优先级**，不是删审计。

### P0 · 内测前建议做完（少而硬）

| #   | 项                   | 做什么                                                 | 状态（Grok 2026-07-31）                                                                                                |
| --- | -------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | **真环境冒烟**       | Docker PG + migrate `0009–0011` + login/list/share     | **已完成**：`scripts/smoke-p0.ps1` → PASS=7 FAIL=0                                                                     |
| 2   | **SEC-01 落地**      | `SHARE_TOKEN_PEPPER`；hash 创建/解析；公开不回显 token | **已完成**（本地 .env 已加 pepper；公开 DTO 去掉 token 字段；修复 0011 DROP CONSTRAINT 顺序）                          |
| 3   | **配置与部署检查单** | env 示例 + 文档                                        | **已完成**：`docs/15-INTERNAL-BETA-CHECKLIST.md`、`deploy/.env.example`、`compose.prod.yml`、`11-DEPLOYMENT` 补 pepper |
| 4   | **已知护栏保持绿**   | 限流/配额/JWT 等既有代码                               | 依赖既有实现；本轮冒烟覆盖 health/login/share                                                                          |

**未做（P0 外可接受）**：完整「选文件上传 + 下载包」文件级冒烟（需有制品文件）；生产密钥轮换；备份演练一次。

### P1 · 三个月内（有痛再上）

| #   | 项                                    | 触发再做                                    |
| --- | ------------------------------------- | ------------------------------------------- |
| 1   | **PERF-04 分页**                      | 应用/制品明显变慢或列表卡顿 → 先 ADR 再实现 |
| 2   | **PERF-03 流式上传**                  | 常传大包、内存/OOM、并发上传拖垮 API        |
| 3   | **DATA-01 真 APK/AAB 解析**           | 错版本/错包名事故，或强制元数据可信         |
| 4   | **TEST-01 核心 E2E**（可只 1 条旅程） | 回归靠人工记不住；需先确认可加 Playwright   |
| 5   | **OPS 真备份演练一次**                | 要当「正式内服」而不是玩具环境              |

### P2 · 以后再说 / 单独立项

- 分片断点续传、恶意扫描、SSO、Webhook、CI Token、对象存储、审计导出
- 全量 axe/视觉/压力、多实例共享限流与配额
- 字体 WOFF2 子集、包体再抠、二维码、最近筛选入口等体验锦上添花
- 文档里仍标 ❌ 但实现已有的（如 SEC-02 JWT）→ **只改文档状态，不重做**

### 内测「够用」标准（可当发车门槛）

1. 找应用、上传制品、看版本、下载、分享打开，主路径无阻塞缺陷
2. 权限不漏看、分享不能被库备份直接抄链滥用（hash + pepper）
3. 单机磁盘/滥用登录有基本护栏（配额、限流）
4. 坏了能重启、有 health ready、知道怎么从备份恢复（文档级即可）

## 2. 已完成的功能与修改

### 前端稳定性、性能与体验

- 路由级 `lazy/Suspense`、全局 ErrorBoundary 和对应测试已加入；历史主包约从 944 kB 降至约 650 kB。
- HTTP 默认 30 秒超时，能区分取消、超时、网络错误；查询在卸载时可取消。
- Application 搜索、平台、Region、排序写入 URL，刷新和分享链接可恢复筛选；详情返回会恢复列表滚动位置。
- 上传支持取消、重试、离页提醒、请求世代隔离；速度和 ETA 使用采样与平滑计算，100% 后显示服务端处理中；传输连续 15 秒无进度时提示检查网络或取消重试。
- 上传预解析修复首次版本 `0.0.1`、伪 SHA-256、Docker 文件名大小写等问题；重复内容先在前端预检、服务端再以索引和 advisory lock 复核。上传写盘前已增加硬配额、最小磁盘余量与单进程并发预留门禁。
- 减少动效偏好统一；应用选择器不再依赖假“最近/置顶”ID。5 条 Fast Refresh ESLint warning 已清理。

### API、安全与下载

- 非管理员的全局审计和 Share Collection 已按 Application 成员关系过滤，避免越权信息泄露。
- 增加 `/health/live` 与真实检查数据库、存储的 `/health/ready`；生产 Compose 使用 ready 检查。
- 修复存储路径的前缀绕过；认证、票据与公开下载支持 Range，并避免续传重复下载计数。
- 公开分享只返回最小 DTO，不回显 token，并使用 `Cache-Control: no-store`。
- 生产环境强制 `DATABASE_URL`、至少 32 字符的 `JWT_SECRET`，禁止 `CORS=*`；Nginx 配置哈希资源缓存、HTML no-cache、分级字体/图片缓存、CSP、Permissions-Policy。
- 前后端密码策略对齐。
- JWT 载荷加入 `tokenVersion`；每次受保护请求回查用户的启用状态、令牌版本和当前角色。改密码、管理员重置密码、角色变更、停用账户均使旧令牌失效；下载票据同样回查。新增 migration `apps/api/drizzle/0010_polite_golden_guardian.sql`。

### 工程、文档与测试

- 根 `test`、`test:all`、`verify` 命令和前端/API GitHub Actions CI 已添加。
- `.gitignore`、`.dockerignore` 已补充 output、临时目录、大型离线包忽略规则。
- 中英文翻译键及插值变量一致性测试已添加。
- 优化审计文档已用“表现、触发条件、影响、根因、证据、验收标准”记录问题，避免只有抽象待办。

## 3. 还没做完的事情

优先级最高的缺口：

- 分享 token：主路径 HMAC 已落地（SEC-01 🟡，Grok 待审查）；仍需生产 migration、遗留列清空与路由级/真实 DB 验证。
- 上传仍会把整文件放入内存，缺流式写入、临时文件清理和服务端取消语义；已具备硬配额与最小磁盘余量门禁，但多 API 实例尚无共享容量预留；未支持分片、断点续传、多文件队列。
- 真实 PostgreSQL 下的 migration、advisory lock、并发重复检测、索引与 `EXPLAIN` 尚未验证；列表分页模型尚未经 ADR 固化。
- 真实 APK/AAB manifest、版本和签名解析尚未实现，当前仍主要从文件名推断。
- 首屏 JS 依赖合计仍约 652.63 kB（gzip 约 212.01 kB），字体目录约 43.62 MiB；需继续测量并选择按认证状态拆分/字体子集或系统字体方案。
- 保存筛选、移动下载页/二维码、暗色和对比度、完整键盘/读屏无障碍仍未闭环。
- Playwright E2E、axe、真实数据库集成、契约/视觉/压力测试、持久化诊断日志、自动备份恢复演练尚未建立。
- CI Token、Webhook、SSO、对象存储、审计导出等路线图能力未实现；实现前需先锁定协议、权限和迁移设计。

当前阶段还需要：审查三项刚完成的并行改动，修正文档中旧的“正在并行”状态，然后统一运行 lint、前后端 typecheck、前后端测试、生产构建、Compose 配置和 `git diff --check`。

## 4. 重要技术决策和约定

- 产品只围绕 Application、Artifact、Release、User，以及查找、发布、查看历史、分享四条主旅程；不要扩张为 Dashboard、BI 或泛 DevOps 平台。
- Windows + PowerShell 环境，中文回复/注释/Commit，检索优先 `rg`。若外部 `npm.cmd` 不可用，使用 Codex bundled Node 与仓库本地 CLI，避免基线验证阻塞。
- 当前工作树是唯一权威交接物：绝不执行 `git reset --hard`、`git checkout -- .`、`git clean` 或覆盖式回退。`src/routes/applications-page.tsx` 有用户原有改动，只能最小化合并。
- 不主动提交或推送。用户已授权直接推进常规实现；仍应避免无必要的删除、大重构或新增依赖，并先审查影响范围。
- 数据库结构必须追加 Drizzle migration；不可改写已存在 migration。主树当前追加 `0011_share_token_hash`（分享 token 哈希）；若 worktree 另有 `0009`/`0010`，合并时勿改写已有 SQL 文件。
- 开发时按相关功能批次运行定向测试，完成一个关联阶段后再统一全量验证；测试通过不等同于真实浏览器、真实 PostgreSQL、生产代理或压力场景通过。
- 共享工作树中并行协作必须按文件划分边界，避免同时编辑同一文件；开始前声明目标、文件和验证方式。

## 5. 已知坑点和注意事项

- `docs/14-ACTIVE-WORK-HANDOFF.md` 中“JWT 使用 jti、仍在并行”的表述已过时：实际实现使用 `tokenVersion`，三个子任务均已完成等待统筹审查和统一验证；继续前请修正该文档。
- 当前验证计数 17/63 与 16/83 不包含所有刚完成任务的最终整合结果，不能作为它们的完成凭据。
- Range、分享、上传、权限四条 API 链路会互相影响；改鉴权、DTO 或错误码时必须同时检查公开下载和前端 HTTP 处理。
- `src/store/applications-store.ts`、`src/store/artifacts-store.ts`、`src/mocks/applications.ts`、`src/mocks/artifacts.ts` 疑似死链，但删除前必须完成依赖图审计，不能顺手删除。
- 不要仅为消除构建 chunk 警告随意配置 `manualChunks`；需先测量首屏依赖图和真实冷缓存体验。
- 不要把 Nginx 语法、mock 路由单测或单次 health 成功写成生产容量、真实数据库或真实浏览器验证。
- 修改 migration、真实数据库、存储路径或上传协议前，先确认目标环境、历史数据与备份；禁止为测试改写历史 migration。
