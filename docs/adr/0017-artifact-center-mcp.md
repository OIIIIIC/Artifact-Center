# ADR-0017: Artifact Center MCP 安全发布边界

- **状态**: accepted
- **日期**: 2026-08-19

Artifact Center 提供可安装的本地 MCP，用于从代码仓库发现发布目标、上传构建产物、校验结果以及修改发布说明。MCP 通过 ADR-0016 定义的 Release Credential 授权；首次使用时由平台管理员登录网站，在“设置 → 发布凭据”创建一次性明文凭据，再由 MCP 宿主通过 `ARTIFACT_CENTER_TOKEN` 注入。MCP 不接收或保存个人密码，也不持久化浏览器会话或普通用户 JWT。

MCP 只注册非破坏性工具。它可以查询可发布 Application、进行可恢复分片上传、修改自己授权范围内制品的发布说明，并在二次显式确认后将 `beta` 提升为 `stable`。MCP 上传固定使用 `markLatest: false`，不能选择 latest、不能任意修改状态，也不提供或调用 Artifact 删除接口；latest 选择和删除必须由有权限的用户在 Artifact Center 网站完成。

服务端为 MCP 暴露独立的 `/release/*` 最小接口面，并继续在服务端执行权限与渠道约束。工具描述和客户端校验只改善交互，不作为授权边界。上传客户端按分片读取本地文件，避免将最大 512 MiB 的制品整体载入内存。
