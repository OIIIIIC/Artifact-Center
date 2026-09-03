# ADR-0018: 由 Artifact Center 分发独立 MCP 客户端

- **状态**: accepted
- **日期**: 2026-09-03

## 背景

ADR-0017 最初要求从代码仓库中的 `plugins/artifact-center-mcp` 启动本地
stdio MCP。该实现可以读取开发设备上的 APK、AAB、EXE 和 ZIP 并进行分片上传，
但它把主仓库检出和本地依赖安装变成了终端用户的安装前提。只访问已部署
Artifact Center 的新设备没有这些文件，因而无法执行网站生成的安装命令。

完全远程化 MCP 不能解决这个用例：远程服务无法通过用户提供的本地文件路径
读取新设备上的构建产物。上传客户端仍需在持有文件的设备上运行。

## 决策

Artifact Center 将本地 MCP 构建为单个 Node.js ESM 运行包，并与 Web 镜像一起
发布。发布内容包含运行包和 SHA-256 校验值，不包含项目检出、测试、源映射或
开发依赖。

管理员在“设置 → 发布机器人”创建 Release Credential 后，页面直接生成
PowerShell 安装命令。命令从当前 Artifact Center 站点下载运行包，验证校验值，
保存到当前 Windows 用户的 LocalApplicationData 目录，并使用 `codex mcp add`
注册 stdio MCP。用户无需知道项目路径，也无需克隆主仓库或执行 `npm install`。

MCP 的工具范围和服务端授权边界继续遵循 ADR-0017：本地工具描述不构成安全
边界，Release Credential 仍只允许既有 `/release/*` 和受约束上传接口，且不
提供删除或隐式 latest 操作。

## 结果

- 新设备只需要 Codex、Node.js、Artifact Center 地址和一次性显示的 Release
  Credential。
- MCP 客户端升级由 Artifact Center Web 镜像统一发布；重新执行页面生成的命令
  即可覆盖本地运行包。
- 运行包会被下载到终端设备，因此不能包含服务端密钥或依赖代码保密的授权逻辑；
  所有敏感判断继续留在服务端。
- 源码启动方式仅保留给项目开发者。
