# ADR-0016: 平台级发布凭据

- **状态**: accepted
- **日期**: 2026-08-13

Artifact Center 使用平台级 Release Credential 承载 Codex 和 CI 的自动化发布，不复用个人密码或普通用户 JWT。一个发布凭据可向平台内所有 Application 上传 `beta` 和 `stable` 制品，并固定要求真实构建号。`beta` 禁止替换 latest；`stable` 可在明确正式发布并完成二次确认后设为 latest。

目标 Application、Region 与渠道由每个代码仓库的显式发布配置和用户意图精确声明，并在上传前通过服务端预检核对。这样只需在开发设备或 CI 中配置一次 Token，同时仍能避免因地域、应用名称或渠道猜测造成误传。

服务端仅保存高熵 Token 的 SHA-256 摘要，明文只在创建时展示一次。Token 只能由平台管理员在“设置 → 发布凭据”创建、查看状态和撤销；发布流程不得收集个人账号密码、复用浏览器 JWT、绕过权限模型或直接写数据库。
