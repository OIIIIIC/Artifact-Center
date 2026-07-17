import { MOCK_APPLICATIONS } from '@/mocks/applications'
import type { ApplicationPlatform } from '@/types/application'
import type { Artifact, ArtifactStatus } from '@/types/artifact'

const UPLOADERS = [
  'Chen Siyuan',
  'Zhou Ran',
  'Lin Xiaowen',
  'Han Lei',
  'Wu Qian',
  'Zhao Ming',
  'Sun Yue',
  'Li Na',
]

const NOTE_POOL = [
  '修复登录超时与弱网重试逻辑。',
  '性能优化：启动耗时降低约 12%。',
  '新增渠道参数与构建元数据写入。',
  '兼容 Android 14 通知权限流程。',
  '静默升级脚本支持回滚标记。',
  '修复若干崩溃与内存泄漏。',
  '内部测试包，请勿外发。',
  '对齐 CI 产物命名规范。',
  '补充产线刷写校验步骤说明。',
  '安全补丁：依赖库升级。',
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function pickPlatform(primary: ApplicationPlatform, i: number): ApplicationPlatform {
  if (primary === 'android') {
    return i % 7 === 0 ? 'zip' : 'android'
  }
  if (primary === 'windows') {
    return i % 6 === 0 ? 'zip' : 'windows'
  }
  const cycle: ApplicationPlatform[] = ['zip', 'android', 'windows']
  return cycle[i % 3]
}

function extFor(platform: ApplicationPlatform): string {
  if (platform === 'android') return 'apk'
  if (platform === 'windows') return 'exe'
  return 'zip'
}

function statusFor(i: number, total: number): ArtifactStatus {
  if (i === 0) return 'latest'
  if (i === 1 || i === 2) return 'stable'
  if (i === 3 || i === 4) return 'beta'
  if (i >= total - 2) return 'archived'
  if (i >= total - 4) return 'deprecated'
  return i % 5 === 0 ? 'beta' : 'stable'
}

function versionAt(base: string, i: number): string {
  const parts = base
    .replace(/-.*$/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
  while (parts.length < 3) parts.push(0)
  // walk versions downward from latest
  let [maj, min, pat] = parts
  pat -= i
  while (pat < 0) {
    pat += 10
    min -= 1
  }
  while (min < 0) {
    min += 10
    maj = Math.max(0, maj - 1)
  }
  const core = `${maj}.${min}.${pat}`
  if (i === 3 || i === 4) return `${core}-beta.${i}`
  return core
}

/**
 * Generate a realistic artifact history for an application.
 * Always ≥ 20 rows for detail table density.
 */
export function getArtifactsForApplication(applicationId: string): Artifact[] {
  const app = MOCK_APPLICATIONS.find((a) => a.id === applicationId)
  // User-created apps (not in seed) start with empty history
  if (!app) return []

  const seed = hash(applicationId)
  const count = 20 + (seed % 5) // 20–24
  const baseTime = new Date(app.updatedAt).getTime()

  const items: Artifact[] = []
  for (let i = 0; i < count; i++) {
    const platform = pickPlatform(app.platform, i + seed)
    const version = versionAt(app.latestVersion, i)
    const buildNumber = String(1800 + (seed % 200) - i * 3)
    const sizeBytes =
      platform === 'zip'
        ? 8_000_000 + ((seed + i * 997) % 40_000_000)
        : platform === 'windows'
          ? 45_000_000 + ((seed + i * 613) % 90_000_000)
          : 22_000_000 + ((seed + i * 421) % 55_000_000)

    const uploadedAt = new Date(
      baseTime - i * 86_400_000 * (0.6 + (i % 3) * 0.4),
    ).toISOString()
    const uploader = UPLOADERS[(seed + i * 3) % UPLOADERS.length]
    const status = statusFor(i, count)
    const note = NOTE_POOL[(seed + i) % NOTE_POOL.length]
    const filename = `${app.packageName.split('.').pop() ?? 'app'}-${version}.${extFor(platform)}`

    const channel =
      status === 'beta' || /-beta/i.test(version)
        ? ('beta' as const)
        : status === 'deprecated' || status === 'archived'
          ? ('deprecated' as const)
          : status === 'latest' && i === 1
            ? ('beta' as const) // variety: some non-latest rows differ
            : ('stable' as const)

    items.push({
      id: `${applicationId}-art-${i}`,
      applicationId,
      version,
      buildNumber,
      platform,
      sizeBytes,
      uploadedAt,
      uploader,
      status,
      // Latest mock is usually stable channel so dual badges read "最新 + 正式"
      channel: status === 'latest' ? 'stable' : channel,
      releaseNotes: note,
      filename,
    })
  }
  return items
}

export function getLatestArtifact(applicationId: string): Artifact | undefined {
  return getArtifactsForApplication(applicationId).find((a) => a.status === 'latest')
}
