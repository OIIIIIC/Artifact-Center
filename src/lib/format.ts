import i18n from '@/i18n'

function localeTag(): string {
  return i18n.language === 'en-US' ? 'en-US' : 'zh-CN'
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const date = new Date(iso).getTime()
  if (Number.isNaN(date)) return iso

  const formatter = new Intl.RelativeTimeFormat(localeTag(), { numeric: 'auto' })
  const diffSec = Math.round((date - now) / 1000)
  const abs = Math.abs(diffSec)

  if (abs < 60) return formatter.format(diffSec, 'second')
  const diffMin = Math.round(diffSec / 60)
  if (Math.abs(diffMin) < 60) return formatter.format(diffMin, 'minute')
  const diffHour = Math.round(diffMin / 60)
  if (Math.abs(diffHour) < 24) return formatter.format(diffHour, 'hour')
  const diffDay = Math.round(diffHour / 24)
  if (Math.abs(diffDay) < 30) return formatter.format(diffDay, 'day')
  const diffMonth = Math.round(diffDay / 30)
  if (Math.abs(diffMonth) < 12) return formatter.format(diffMonth, 'month')
  const diffYear = Math.round(diffMonth / 12)
  return formatter.format(diffYear, 'year')
}

export function formatAbsoluteDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(localeTag(), {
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
