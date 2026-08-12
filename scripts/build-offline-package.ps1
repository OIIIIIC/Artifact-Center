# 构建可拷贝到内网 Linux 服务器的离线部署包。
# 此脚本只在本机创建一个新的输出目录；不会连接或修改服务器。

[CmdletBinding()]
param(
  [string]$OutputDirectory = '',
  [string]$ImageTag = '',
  [switch]$SkipVerification,
  [switch]$NoCache
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $projectRoot 'output\offline-deploy'
} elseif (-not [System.IO.Path]::IsPathRooted($OutputDirectory)) {
  $OutputDirectory = Join-Path $projectRoot $OutputDirectory
}

if (-not $ImageTag) {
  $ImageTag = (Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
}

if ($ImageTag -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') {
  throw '镜像标签只能使用字母、数字、点、下划线和连字符。'
}
if (Test-Path -LiteralPath $OutputDirectory) {
  throw "输出目录已存在：$OutputDirectory`n为避免覆盖已有离线包，脚本已停止。请指定新的 -OutputDirectory。"
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw '未找到 Docker。请先安装并启动 Docker Desktop。'
}

function Invoke-Docker([string[]]$Arguments) {
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker 命令失败：docker $($Arguments -join ' ')"
  }
}

Push-Location $projectRoot
try {
  Invoke-Docker @('version', '--format', '{{.Server.Version}}')

  if (-not $SkipVerification) {
    Write-Host '运行构建前校验…'
    & npm run verify
    if ($LASTEXITCODE -ne 0) {
      throw '构建前校验失败，未生成离线包。'
    }
  }

  $buildArguments = @('build')
  if ($NoCache) {
    $buildArguments += '--no-cache'
  }

  Write-Host "构建 Web 镜像：artifact-center-web:$ImageTag"
  Invoke-Docker ($buildArguments + @('-t', "artifact-center-web:$ImageTag", '.'))
  Write-Host "构建 API 镜像：artifact-center-api:$ImageTag"
  Invoke-Docker ($buildArguments + @('-t', "artifact-center-api:$ImageTag", '.\apps\api'))
  Write-Host '拉取 PostgreSQL 基础镜像…'
  Invoke-Docker @('pull', 'postgres:16-alpine')

  $deployDirectory = Join-Path $OutputDirectory 'deploy'
  New-Item -ItemType Directory -Path $deployDirectory | Out-Null
  $archivePath = Join-Path $OutputDirectory 'artifact-center-images.tar'

  Write-Host '导出离线镜像…'
  Invoke-Docker @(
    'save',
    "artifact-center-web:$ImageTag",
    "artifact-center-api:$ImageTag",
    'postgres:16-alpine',
    '-o', $archivePath
  )

  Copy-Item (Join-Path $projectRoot 'compose.offline.yml') (Join-Path $OutputDirectory 'compose.offline.yml')
  Copy-Item (Join-Path $projectRoot 'deploy\.env.example') (Join-Path $deployDirectory '.env')
  Copy-Item (Join-Path $projectRoot 'deploy\preflight.sh') (Join-Path $deployDirectory 'preflight.sh')
  Copy-Item (Join-Path $projectRoot 'deploy\verify-running.sh') (Join-Path $deployDirectory 'verify-running.sh')
  Copy-Item (Join-Path $projectRoot 'deploy\collect-diagnostics.sh') (Join-Path $deployDirectory 'collect-diagnostics.sh')
  Add-Content -LiteralPath (Join-Path $deployDirectory '.env') -Value "`n# 由 build-offline-package.ps1 写入；与离线包中的镜像版本对应。`nARTIFACT_CENTER_IMAGE_TAG=$ImageTag"

  @"
Artifact Center 离线部署包

镜像标签：$ImageTag
生成时间（UTC）：$([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))

下一步：
1. 编辑 deploy/.env 中的密码和 APP_ORIGIN。
2. 将整个目录拷贝到服务器。
3. 在服务器运行：chmod +x deploy/*.sh && ./deploy/preflight.sh --offline
4. 预检通过后，再由具备部署权限的人员执行导入镜像和启动服务。
"@ | Set-Content -LiteralPath (Join-Path $OutputDirectory 'README.txt') -Encoding utf8

  Write-Host "离线部署包已生成：$OutputDirectory"
} finally {
  Pop-Location
}
