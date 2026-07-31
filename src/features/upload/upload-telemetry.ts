import type { UploadTransferStage } from '@/types/upload'

export interface UploadTelemetrySample {
  loadedBytes: number
  sampledAtMs: number
  speedBytesPerSecond: number | null
}

export interface UploadTelemetry {
  sample: UploadTelemetrySample
  stage: UploadTransferStage
  speedBytesPerSecond: number | null
  etaSeconds: number | null
}

const MIN_SAMPLE_INTERVAL_MS = 250
const PREVIOUS_SAMPLE_WEIGHT = 0.7

export function createUploadTelemetrySample(nowMs: number): UploadTelemetrySample {
  return {
    loadedBytes: 0,
    sampledAtMs: nowMs,
    speedBytesPerSecond: null,
  }
}

/**
 * 用采样窗口和指数平滑计算速度，避免每个 progress 事件都让 ETA 大幅跳动。
 */
export function calculateUploadTelemetry(
  previous: UploadTelemetrySample,
  loadedBytes: number,
  totalBytes: number,
  nowMs: number,
): UploadTelemetry {
  if (totalBytes > 0 && loadedBytes >= totalBytes) {
    return {
      sample: {
        loadedBytes,
        sampledAtMs: nowMs,
        speedBytesPerSecond: previous.speedBytesPerSecond,
      },
      stage: 'processing',
      speedBytesPerSecond: null,
      etaSeconds: null,
    }
  }

  const elapsedMs = nowMs - previous.sampledAtMs
  if (elapsedMs < MIN_SAMPLE_INTERVAL_MS || loadedBytes <= previous.loadedBytes) {
    return {
      sample: previous,
      stage: 'transferring',
      speedBytesPerSecond: previous.speedBytesPerSecond,
      etaSeconds:
        previous.speedBytesPerSecond && totalBytes > loadedBytes
          ? Math.ceil((totalBytes - loadedBytes) / previous.speedBytesPerSecond)
          : null,
    }
  }

  const currentSpeed = ((loadedBytes - previous.loadedBytes) * 1000) / elapsedMs
  const speedBytesPerSecond = previous.speedBytesPerSecond
    ? previous.speedBytesPerSecond * PREVIOUS_SAMPLE_WEIGHT +
      currentSpeed * (1 - PREVIOUS_SAMPLE_WEIGHT)
    : currentSpeed

  return {
    sample: {
      loadedBytes,
      sampledAtMs: nowMs,
      speedBytesPerSecond,
    },
    stage: 'transferring',
    speedBytesPerSecond,
    etaSeconds:
      speedBytesPerSecond > 0 && totalBytes > loadedBytes
        ? Math.ceil((totalBytes - loadedBytes) / speedBytesPerSecond)
        : null,
  }
}
