# MCP 实际协议功能回归

执行边界见 `contract.json`，逐工具清单见 `feature-matrix.json`。使用站点实际分发的单文件客户端，以 stdio JSON-RPC 调用工具；断言账号权限、业务记录、下载内容、配置效果与撤销结果。Jenkins 是隔离 HTTP 测试服务，不代表真实 Jenkins 构建环境验收。

## 准备隔离环境

在具备已部署 API 镜像和 PostgreSQL 16 镜像的 Linux Docker 主机执行：

```bash
bash tests/mcp-live/setup-isolated.sh
```

该脚本创建全新测试库与 tmpfs 文件存储，不读取生产数据库、存储或环境配置。默认资源前缀 `ac-mcp-owned-test`，可用 `MCP_E2E_PREFIX` 修改；默认仅在服务器 loopback 暴露 23001。资源已存在时应先执行清理，不复用未知资源。

将站点 `/downloads/artifact-center-mcp.mjs` 下载到本机，并与站点 SHA-256 比较。需要本机安装 Node.js 和 Git。若 Docker 位于远端，通过 SSH 转发其 loopback 端口，例如：

```bash
ssh -N -L 58683:127.0.0.1:23001 <user>@<server>
```

## 执行

PowerShell 示例：

```powershell
$env:MCP_TEST_OWNED_ENV = '1'
$env:MCP_E2E_API_URL = 'http://127.0.0.1:58683'
$env:MCP_E2E_CLIENT = 'D:/path/to/artifact-center-mcp.mjs'
$env:MCP_E2E_OUTPUT = 'output/mcp-live-run'
node tests/mcp-live/run.mjs
```

脚本只接受 loopback 地址，并先验证专用测试账号。所有密码为隔离环境合成测试数据，真实账号密码和凭据不得写入脚本。个人 MCP 凭据仅在内存中；测试报告不包含秘密。上传流程中的确认由测试宿主模拟，仅用于独立测试文件。

`results.json` 包含发现数量、成功工具、未覆盖工具、正向/拒绝场景和失败分类。调用成功还须通过相应的业务结果断言；查询、下载、鉴权拒绝和配置后的实际效果均保留在报告中。报告缺少成功工具或存在失败时退出码非零。

## 清理与重复执行

```bash
bash tests/mcp-live/cleanup-isolated.sh
```

清理只操作精确前缀的测试容器和网络，不清理镜像或生产资源。每次重跑应重新创建空库与 tmpfs 存储；本地 Git 测试目录由驱动器在 `finally` 中删除。不要把已有生产环境标记成测试所有，以绕过保护。
