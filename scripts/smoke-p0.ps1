# P0 内测冒烟：health → login → list apps → create share → resolve public
# 用法: .\scripts\smoke-p0.ps1 -BaseUrl http://localhost:4001

param(
  [string]$BaseUrl = 'http://localhost:4001',
  [string]$Identifier = 'artifact-demo',
  [string]$Password = 'ArtifactCenter-Demo-Only-2026!'
)

$ErrorActionPreference = 'Stop'
$results = [System.Collections.Generic.List[object]]::new()

function Add-Result([string]$Step, [bool]$Ok, [string]$Detail) {
  $results.Add([pscustomobject]@{ Step = $Step; OK = $Ok; Detail = $Detail })
  $tag = if ($Ok) { 'PASS' } else { 'FAIL' }
  Write-Host "$tag $Step : $Detail"
}

try {
  $r = Invoke-RestMethod -Uri "$BaseUrl/health/live" -TimeoutSec 8
  Add-Result 'health/live' ($r.ok -eq $true) (($r | ConvertTo-Json -Compress))
} catch { Add-Result 'health/live' $false $_.Exception.Message }

try {
  $r = Invoke-RestMethod -Uri "$BaseUrl/health/ready" -TimeoutSec 8
  Add-Result 'health/ready' ($r.ok -eq $true) (($r | ConvertTo-Json -Compress))
} catch { Add-Result 'health/ready' $false $_.Exception.Message }

$token = $null
try {
  $body = @{ identifier = $Identifier; password = $Password } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 15
  $token = $r.token
  Add-Result 'login' ([bool]$token) ("user=$($r.user.username)")
} catch { Add-Result 'login' $false $_.Exception.Message }

if (-not $token) {
  Write-Host 'No token; abort remaining steps.'
  exit 1
}

$headers = @{ Authorization = "Bearer $token" }
$appId = $null
try {
  $r = Invoke-RestMethod -Uri "$BaseUrl/applications" -Headers $headers -TimeoutSec 15
  if ($r.items.Count -gt 0) { $appId = $r.items[0].id }
  Add-Result 'list-applications' $true ("count=$($r.items.Count) first=$appId")
} catch { Add-Result 'list-applications' $false $_.Exception.Message }

$shareToken = $null
if ($appId) {
  try {
    $body = @{ mode = 'latest'; expiresInDays = 1 } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BaseUrl/applications/$appId/shares" -Method POST -Headers $headers -Body $body -ContentType 'application/json' -TimeoutSec 15
    $shareToken = $r.share.token
    Add-Result 'create-share' ($shareToken -and $shareToken.Length -gt 10) ("tokenLen=$($shareToken.Length) prefix=$($r.share.tokenPrefix)")
  } catch { Add-Result 'create-share' $false $_.Exception.Message }
}

if ($shareToken) {
  try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/public/shares/$shareToken" -TimeoutSec 15
    $noToken = -not ($r.share.PSObject.Properties.Name -contains 'token')
    Add-Result 'resolve-share-no-echo' $noToken ("items=$($r.items.Count) keys=$($r.share.PSObject.Properties.Name -join ',')")
  } catch { Add-Result 'resolve-share-no-echo' $false $_.Exception.Message }
}

if ($appId) {
  try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/applications/$appId/shares" -Headers $headers -TimeoutSec 15
    $first = $r.items[0]
    $empty = (-not $first.token) -or ($first.token -eq '')
    Add-Result 'list-shares-no-plaintext' $empty ("prefix=$($first.tokenPrefix)")
  } catch { Add-Result 'list-shares-no-plaintext' $false $_.Exception.Message }
}

$pass = @($results | Where-Object OK).Count
$fail = @($results | Where-Object { -not $_.OK }).Count
Write-Host "---- SUMMARY PASS=$pass FAIL=$fail ----"
$results | Format-Table -AutoSize
if ($fail -gt 0) { exit 1 }
exit 0
