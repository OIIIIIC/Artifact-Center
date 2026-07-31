import { describe, expect, it } from 'vitest'

import { calculateUploadTelemetry, createUploadTelemetrySample } from './upload-telemetry'

describe('上传遥测', () => {
  it('等待足够采样窗口后计算速度和 ETA', () => {
    const initial = createUploadTelemetrySample(1_000)

    const tooSoon = calculateUploadTelemetry(initial, 100, 1_000, 1_100)
    expect(tooSoon.speedBytesPerSecond).toBeNull()
    expect(tooSoon.etaSeconds).toBeNull()

    const sampled = calculateUploadTelemetry(initial, 250, 1_000, 1_500)
    expect(sampled.speedBytesPerSecond).toBe(500)
    expect(sampled.etaSeconds).toBe(2)
    expect(sampled.stage).toBe('transferring')
  })

  it('平滑后续速度并在传输完成时进入服务端处理阶段', () => {
    const first = calculateUploadTelemetry(
      createUploadTelemetrySample(0),
      500,
      2_000,
      1_000,
    )
    const second = calculateUploadTelemetry(first.sample, 1_500, 2_000, 2_000)

    expect(second.speedBytesPerSecond).toBe(650)
    expect(second.etaSeconds).toBe(1)

    const completed = calculateUploadTelemetry(second.sample, 2_000, 2_000, 2_500)
    expect(completed.stage).toBe('processing')
    expect(completed.speedBytesPerSecond).toBeNull()
    expect(completed.etaSeconds).toBeNull()
  })
})
