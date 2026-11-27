# Jenkins 联动：应用构建与产物发布

在应用内完成「发起构建 → 查看状态与日志 → 下载或发布产物」。Jenkins 负责实际编译和归档；Artifact Center 保存构建记录，并在用户选择发布后导入文件。

## 部署准备

1. 备份数据库，在预发布环境演练迁移，再执行现有 `npm run db:migrate` 流程。`0030_jenkins_build_configuration` 增加连接和配置；`0031_application_build_runs` 增加构建与发布任务表。按迁移日志顺序执行全部待应用迁移。
2. 在 API 服务设置 `JENKINS_ENCRYPTION_KEY`，值为独立生成的 32 字节随机数的十六进制表示（64 个字符），例如 `openssl rand -hex 32`。生产和离线 Compose 已透传该可选变量；本地开发写入 `apps/api/.env`。
3. 密钥与数据库分别安全备份。不要在升级时重新生成，也不要使用 `VITE_` 前缀。缺少密钥不影响其他功能，但不能保存凭据；更换密钥后需要重新录入 Jenkins Token。
4. 为 Jenkins 创建专用服务账号和 API Token，授予 Overall/Read 与对应任务的 Job/Read、Job/Build、Job/Cancel。确认 Artifact Center API 容器能够访问 Jenkins；浏览器能够打开 Jenkins 并不代表容器网络已连通。使用 API Token 的 Basic 认证，无需关闭 CSRF 防护，参见 [Jenkins 官方说明](https://www.jenkins.io/doc/book/using/remote-access-api/)。

## 配置流程

支持多个 Jenkins：管理员在设置页点“添加连接”，分别保存名称、地址、账号和 API Token；应用构建配置选择对应服务器。旧配置和历史构建仍使用 `default` 连接。停用某个连接只影响引用它的构建；修改应用绑定不改变历史构建来源。任务可为 Pipeline 或自由风格任务，后者需添加“归档成品”后置操作。

管理员打开「设置 → Jenkins 集成」，填写服务器地址、服务账号和 API Token，测试连接后启用并保存。测试不持久化配置；启用保存时会再次验证。Token 保存后不回显，留空保留；地址或账号变化必须重新输入。请求不会跟随重定向，请填写最终服务地址。

打开目标应用的「设置 → 构建配置」，填写任务路径、产物匹配规则和默认参数，校验后启用保存。仅管理员可修改绑定，应用维护者可查看，归档应用不可修改或校验。

不添加的参数由 Jenkins 默认值处理；显式空字符串是空值，并不代表默认值。支持 String、Text、Choice 和 Boolean 参数，Boolean 为 `true`/`false`。密码、签名密钥和其他凭据继续由 Jenkins 管理。规则支持段内 `*` 和跨目录 `**`，不支持逗号多规则、排除规则或正则。

任务必须使用 `archiveArtifacts` 归档文件；工作区中存在文件不等于已归档。建议在 Jenkinsfile 的现有 `parameters` 块中增加以下 String 参数（不需要在 Artifact Center 默认参数列表中填写）：

```groovy
string(name: 'ARTIFACT_CENTER_REQUEST_ID', defaultValue: '', description: 'Artifact Center 请求编号')
```

平台检测到此参数会自动填入请求 ID，用于断网或进程重启后按精确请求找回队列/最近 100 次构建。普通 API Token 请求的自定义 `cause` 不会被 Jenkins 保留，因此不依赖它匹配，见 [Jenkins 实现](https://github.com/jenkinsci/jenkins/blob/master/core/src/main/java/jenkins/model/ParameterizedJobMixIn.java)。没有该参数也可以正常构建，但丢失队列响应后可能需人工核对；系统不会自动重发。`ARTIFACT_CENTER_REQUEST_ID`、`token`、`cause`、`delay`、`json` 是保留参数名。

## 日常操作

1. 应用维护者或管理员打开应用的「构建」页签，点「发起构建」，确认此次参数；只允许修改管理员预先配置的参数值。
2. 页面显示排队、执行、成功或失败状态和增量日志；关闭页面后任务继续。可取消待提交、排队或运行中的构建，最终状态以 Jenkins 为准。
3. 成功构建列出匹配规则的归档文件。选择「下载」直接流式下载；选择「发布到平台」填写版本、渠道、发布说明。
4. 发布默认为测试版；正式版需要勾选确认。发布后不自动替换应用的最新版本。成功后可进入制品历史查看、下载和分享。

每应用同一时间最多一个已确认的活动构建。请求结果未确认时需要先人工核对 Jenkins，再明确勾选才能发起新请求。一次构建的同一文件仅能成功导入一次，重复点击复用任务；失败后可修正版本等信息重试。需要改变已发布制品渠道时使用平台现有管理功能。

## 同次构建发布到不同应用

管理员可在构建配置的「产物发布目标」中添加路径规则和目标应用。规则为空时所有产物仍发布到当前应用；添加后，每个待发布文件必须恰好匹配一条规则，未匹配或重复匹配均不能发布。构建保存规则快照，修改配置只影响之后的新构建。操作者必须同时拥有构建所属应用和目标应用的维护权限。

例如，一个任务可以归档两个 Android 安装包：

| 归档路径规则                   | 目标应用 |
| ------------------------------ | -------- |
| `**/artifacts/app-inner-*.apk` | 内屏应用 |
| `**/artifacts/app-outer-*.apk` | 外屏应用 |

从绑定了构建任务的应用发起构建。成功后可以逐个下载或发布，文件旁会显示目标应用。迁移 `0032_build_output_targets` 添加此能力，细节见 ADR-0025。

构建记录保存任务/参数快照、队列号、构建号和 Jenkins 报告的提交号；未报告提交号时明确显示未知。只有成功构建可下载或发布；失败/不稳定构建保留日志供诊断。归档应用不能新建构建或发布，但维护者仍可读取历史和取消现存任务。

## 运行与限制

- API 进程内后台工作器每 5 秒检查持久化任务，依靠数据库租约恢复重启后的工作。部署多个 API 实例时仍需共享同一文件存储。
- 下载使用短期签名票据，并在使用时重新检查账号状态和应用权限。日志仅维护者可读，以纯文本显示，页面保留最近约 20 万字符；单次响应最多读取 8 MiB、保留末尾 128 KiB，超长日志会提示截断。
- 单文件上限 512 MiB、传输超时 5 分钟；后端流式导入本地存储，计算 SHA256，校验空间与平台类型。失败不创建半成品制品；文件、发布记录和审计关联完成后再运行既有保留策略。
- Jenkins 清理的原始文件可能无法继续下载/导入；已发布文件独立保留于 Artifact Center。此入口当前使用本地文件后端，不进行对象存储直传。
- 切换连接地址/账号或停用连接会暂停旧构建读取；恢复原连接后可继续。API Token 更新但账号/地址未变可直接继续。
- 平台不修改 Jenkinsfile、不执行部署；如果绑定的现有任务包含部署步骤，触发构建仍会执行这些步骤。接入时应选择仅打包归档的任务。

## API

| 方法与路径                                 | 权限               | 行为                         |
| ------------------------------------------ | ------------------ | ---------------------------- |
| `GET /settings/jenkins`                    | 管理员             | 脱敏连接信息和密钥是否就绪   |
| `PUT /settings/jenkins`                    | 管理员             | 保存连接；启用前校验         |
| `POST /settings/jenkins/test`              | 管理员             | 校验连接草稿，不保存         |
| `GET /applications/:id/build-config`       | 应用维护者或管理员 | 读取应用配置与连接就绪状态   |
| `PUT /applications/:id/build-config`       | 管理员             | 保存绑定；启用前校验任务参数 |
| `POST /applications/:id/build-config/test` | 管理员             | 校验任务草稿，不保存、不构建 |

写入请求需携带读取到的 `revision`，首次创建为 `0`；版本冲突返回 `409`，需要重新加载配置。连接请求包含 `baseUrl`、`username`、可选 `token`、`enabled`、`revision`；应用请求包含 `jobPath`、`artifactPattern`、`parameters: [{name,value}]`、可选 `outputTargets: [{name,pattern,applicationId}]`、`enabled`、`revision`。

构建接口均要求应用维护权限：

| 方法与路径                                               | 行为                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /applications/:id/builds?before=<build-id>`         | 每页 20 条历史，返回下一页游标                                                              |
| `POST /applications/:id/builds`                          | 传入 UUID `requestKey`、`configRevision`、`parameters`、可选 `acknowledgeUnknown`，返回 202 |
| `GET /applications/:id/builds/:buildId`                  | 状态、文件和发布任务                                                                        |
| `POST /applications/:id/builds/:buildId/cancel`          | 记录取消意图                                                                                |
| `GET /applications/:id/builds/:buildId/log?start=0`      | 增量纯文本日志和 `nextStart` 游标                                                           |
| `POST /applications/:id/builds/:buildId/download-ticket` | 用 `relativePath` 取得短期下载地址                                                          |
| `POST /applications/:id/builds/:buildId/publications`    | `relativePath`、`version`、`channel`、`releaseNotes`、`confirmStable`，异步导入             |

## 验证记录（2026-10-13）

最初全量 `npm run verify` 通过：前端 228 项、API 191 项、MCP 14 项，以及 lint、前后端类型检查、生产构建。本阶段新增真实本地 HTTP 模拟 Jenkins + PGlite 全量迁移 + JWT + 文件系统的集成测试，覆盖队列到构建、请求去重、提交响应丢失、进程恢复、取消、权限撤销、流式下载、发布去重、文件缺失/中断及重试。另有产物匹配和前端发布确认、请求重试、日志文本显示测试。

可见浏览器检查已覆盖发起构建、运行状态与日志、正式版确认、发布完成和原生附件下载；下载字节与模拟源一致。桌面 2048×1232 与窄屏 390×844 无横向溢出。截图保存在本地 `output/playwright/build-flow-desktop.png` 和 `build-flow-mobile.png`。浏览器使用隔离预览数据，不代表真实 Jenkins 端到端联调。

实际联调补充了 HTTP 浏览器兼容和 Jenkins 控制标记显示修复：使用 `getRandomValues` 生成 UUID v4，重试保持相同请求号；日志隐藏 Jenkins ConsoleNote 和终端控制序列，并保留服务端字节游标。下载票据在 API 和 Nginx 日志中均脱敏。

最终前端 230 项、API 192 项、MCP 14 项测试通过。首次并发全量运行中，一个已有的应用设置异步渲染测试超时；以 `vitest run --maxWorkers=2` 执行前端全量测试通过。Lint、类型检查及生产构建通过。实际部署、备份和验收结果见 [142 部署记录](deployment-jenkins-2026-10-13.md)。
