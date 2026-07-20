import { getStorageDiskSpace, type StorageDiskSpace } from './storage.js'

export type DiagnosticLog = {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  event: 'http_request' | 'unhandled_error'
  service: 'artifact-center-api'
  requestId: string
  method?: string
  path?: string
  status?: number
  durationMs?: number
  slow?: boolean
  slowRequestMs?: number
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export type DiagnosticReportInput = {
  sinceMinutes: 15 | 30 | 60
  requestId?: string
  operation?: string
  expected?: string
  actual?: string
  occurredAt?: string
  client?: {
    page?: string
    browser?: string
    timezone?: string
  }
}

type SystemSnapshot = {
  uptimeSeconds: number
  nodeVersion: string
  memory: {
    rssBytes: number
    heapUsedBytes: number
  }
  storage: StorageDiskSpace | null
}

type DiagnosticsOptions = {
  maxEvents?: number
  now?: () => Date
  getSystemSnapshot?: () => Promise<SystemSnapshot>
}

export type DiagnosticReport = {
  generatedAt: string
  eventCount: number
  markdown: string
}

export type DiagnosticsModule = {
  record: (log: DiagnosticLog) => void
  buildReport: (input: DiagnosticReportInput) => Promise<DiagnosticReport>
}

function singleLine(value: string | undefined, fallback = '未填写'): string {
  const normalized = value?.replace(/[\r\n]+/g, ' ').trim()
  return normalized ? normalized.slice(0, 1000) : fallback
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = units[0]
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024
    unit = units[index]
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`
}

async function defaultSystemSnapshot(): Promise<SystemSnapshot> {
  const memory = process.memoryUsage()
  return {
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
    },
    storage: await getStorageDiskSpace(),
  }
}

function formatEvent(log: DiagnosticLog): string {
  if (log.event === 'unhandled_error') {
    return [
      log.timestamp,
      log.level.toUpperCase(),
      log.requestId,
      `${singleLine(log.error?.name, 'Error')}（详细异常仅保留在服务器日志）`,
    ].join(' | ')
  }

  const duration = log.durationMs == null ? '—' : `${log.durationMs}ms`
  const slow = log.slow ? ' | slow' : ''
  return `${log.timestamp} | ${log.level.toUpperCase()} | ${log.requestId} | ${log.method ?? '—'} ${log.path ?? '—'} | ${log.status ?? '—'} | ${duration}${slow}`
}

/**
 * 将近期运行事件、主机摘要和用户现象收口为一个可测试的诊断模块。
 * 数据仅驻留当前 API 进程，服务重启后自动清空。
 */
export function createDiagnosticsModule({
  maxEvents = 500,
  now = () => new Date(),
  getSystemSnapshot = defaultSystemSnapshot,
}: DiagnosticsOptions = {}): DiagnosticsModule {
  const events: DiagnosticLog[] = []

  return {
    record(log) {
      if (log.event === 'http_request' && log.path === '/health') return
      events.push(log)
      if (events.length > maxEvents) events.splice(0, events.length - maxEvents)
    },

    async buildReport(input) {
      const generatedAt = now()
      const cutoff = generatedAt.getTime() - input.sinceMinutes * 60_000
      const matchingEvents = events.filter((event) => {
        const timestamp = Date.parse(event.timestamp)
        if (!Number.isFinite(timestamp) || timestamp < cutoff) return false
        return input.requestId ? event.requestId === input.requestId : true
      })
      const system = await getSystemSnapshot()
      const storage = system.storage
      const lines = [
        '# Artifact Center 应用诊断包',
        '',
        '> 本报告由管理员主动生成。仅包含进程内近期请求摘要，不包含密码、Token、Cookie、请求体、查询字符串或数据库业务数据。',
        '',
        '## 问题现象',
        '',
        `- 操作：${singleLine(input.operation)}`,
        `- 发生时间：${singleLine(input.occurredAt)}`,
        `- 预期结果：${singleLine(input.expected)}`,
        `- 实际结果：${singleLine(input.actual)}`,
        `- 请求 ID：${singleLine(input.requestId, '未指定')}`,
        '',
        '## 客户端',
        '',
        `- 页面：${singleLine(input.client?.page, '未知')}`,
        `- 浏览器：${singleLine(input.client?.browser, '未知')}`,
        `- 时区：${singleLine(input.client?.timezone, '未知')}`,
        '',
        '## 运行摘要',
        '',
        `- UTC 生成时间：${generatedAt.toISOString()}`,
        `- 采集范围：最近 ${input.sinceMinutes} 分钟`,
        `- API 运行时间：${system.uptimeSeconds} 秒`,
        `- Node.js：${system.nodeVersion}`,
        `- 进程内存 RSS：${formatBytes(system.memory.rssBytes)}`,
        `- JS 堆已用：${formatBytes(system.memory.heapUsedBytes)}`,
        `- 存储空间：${storage ? `${formatBytes(storage.usedBytes)} / ${formatBytes(storage.totalBytes)}，剩余 ${formatBytes(storage.freeBytes)}` : '暂时无法读取'}`,
        '',
        `## 请求记录（${matchingEvents.length}）`,
        '',
        '```text',
        ...(matchingEvents.length > 0
          ? matchingEvents.map(formatEvent)
          : ['没有符合条件的进程内请求记录。服务重启会清空历史记录。']),
        '```',
        '',
        '## 分析提示',
        '',
        '- 请优先结合请求 ID、状态码和 duration 判断问题是否稳定复现。',
        '- 本报告不包含 Nginx、PostgreSQL 或宿主机日志；信息不足时再使用服务器诊断脚本。',
      ]

      return {
        generatedAt: generatedAt.toISOString(),
        eventCount: matchingEvents.length,
        markdown: lines.join('\n'),
      }
    },
  }
}

export const diagnostics = createDiagnosticsModule()
