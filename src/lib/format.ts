const relativeFormatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const date = new Date(iso).getTime()
  if (Number.isNaN(date)) return iso

  const diffSec = Math.round((date - now) / 1000)
  const abs = Math.abs(diffSec)

  if (abs < 60) return relativeFormatter.format(diffSec, 'second')
  const diffMin = Math.round(diffSec / 60)
  if (Math.abs(diffMin) < 60) return relativeFormatter.format(diffMin, 'minute')
  const diffHour = Math.round(diffMin / 60)
  if (Math.abs(diffHour) < 24) return relativeFormatter.format(diffHour, 'hour')
  const diffDay = Math.round(diffHour / 24)
  if (Math.abs(diffDay) < 30) return relativeFormatter.format(diffDay, 'day')
  const diffMonth = Math.round(diffDay / 30)
  if (Math.abs(diffMonth) < 12) return relativeFormatter.format(diffMonth, 'month')
  const diffYear = Math.round(diffMonth / 12)
  return relativeFormatter.format(diffYear, 'year')
}

export function formatAbsoluteDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB'] as const
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unit]}`
}
