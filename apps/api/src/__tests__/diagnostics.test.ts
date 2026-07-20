import { describe, expect, it } from 'vitest'

import { createDiagnosticsModule, type DiagnosticLog } from '../lib/diagnostics.js'

function requestLog(
  timestamp: string,
  requestId: string,
  overrides: Partial<DiagnosticLog> = {},
): DiagnosticLog {
  return {
    timestamp,
    level: 'info',
    event: 'http_request',
    service: 'artifact-center-api',
    requestId,
    method: 'GET',
    path: '/applications',
    status: 200,
    durationMs: 25,
    slow: false,
    slowRequestMs: 500,
    ...overrides,
  }
}

describe('系统诊断模块', () => {
  it('按时间和请求 ID 生成适合交给 AI 的 Markdown', async () => {
    const diagnostics = createDiagnosticsModule({
      maxEvents: 10,
      now: () => new Date('2026-07-20T08:30:00.000Z'),
      getSystemSnapshot: async () => ({
        uptimeSeconds: 3600,
        nodeVersion: 'v22.0.0',
        memory: { rssBytes: 1000, heapUsedBytes: 500 },
        storage: { totalBytes: 10_000, usedBytes: 4_000, freeBytes: 6_000 },
      }),
    })
    diagnostics.record(requestLog('2026-07-20T07:00:00.000Z', 'expired'))
    diagnostics.record(
      requestLog('2026-07-20T08:20:00.000Z', 'target-request', {
        level: 'warn',
        durationMs: 850,
        slow: true,
      }),
    )
    diagnostics.record(requestLog('2026-07-20T08:25:00.000Z', 'other-request'))

    const report = await diagnostics.buildReport({
      sinceMinutes: 30,
      requestId: 'target-request',
      operation: '打开应用列表',
      expected: '一秒内显示',
      actual: '等待了三秒',
      occurredAt: '2026-07-20 16:20 +08:00',
      client: {
        page: '/settings',
        browser: 'Test Browser',
        timezone: 'Asia/Shanghai',
      },
    })

    expect(report.eventCount).toBe(1)
    expect(report.markdown).toContain('target-request')
    expect(report.markdown).toContain('打开应用列表')
    expect(report.markdown).toContain('850ms')
    expect(report.markdown).not.toContain('expired')
    expect(report.markdown).not.toContain('other-request')
  })

  it('限制内存事件数量并忽略健康检查噪声', async () => {
    const diagnostics = createDiagnosticsModule({
      maxEvents: 2,
      now: () => new Date('2026-07-20T08:30:00.000Z'),
      getSystemSnapshot: async () => ({
        uptimeSeconds: 1,
        nodeVersion: 'test',
        memory: { rssBytes: 1, heapUsedBytes: 1 },
        storage: null,
      }),
    })
    diagnostics.record(
      requestLog('2026-07-20T08:20:00.000Z', 'health', { path: '/health' }),
    )
    diagnostics.record(requestLog('2026-07-20T08:21:00.000Z', 'first'))
    diagnostics.record(requestLog('2026-07-20T08:22:00.000Z', 'second'))
    diagnostics.record(requestLog('2026-07-20T08:23:00.000Z', 'third'))

    const report = await diagnostics.buildReport({ sinceMinutes: 30 })

    expect(report.eventCount).toBe(2)
    expect(report.markdown).not.toContain('health')
    expect(report.markdown).not.toContain('first')
    expect(report.markdown).toContain('second')
    expect(report.markdown).toContain('third')
  })
})
