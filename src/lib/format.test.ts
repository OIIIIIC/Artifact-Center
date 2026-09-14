import { afterEach, expect, it, vi } from 'vitest'
import { formatAbsoluteDateTime } from './format'

afterEach(() => vi.restoreAllMocks())

it('保留无效日期输入', () => {
  expect(formatAbsoluteDateTime('invalid')).toBe('invalid')
})

it('显示本地日期和补零后的 24 小时时间', () => {
  const iso = new Date(2026, 8, 14, 3, 4, 5).toISOString()
  expect(formatAbsoluteDateTime(iso)).toBe('2026-09-14 03:04:05')
})

it.each([
  [-345, 'UTC+05:45'],
  [210, 'UTC-03:30'],
  [0, 'UTC+00:00'],
])('格式化非整点时区偏移 %s', (offset, expected) => {
  vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(offset)
  expect(
    formatAbsoluteDateTime('2026-09-14T00:00:00Z', { includeTimeZone: true }),
  ).toContain(`(${expected})`)
})
