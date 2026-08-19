import { describe, expect, it } from 'vitest'

import {
  isApplicationCode,
  normalizeApplicationCode,
  sanitizeApplicationCodeInput,
  suggestApplicationCode,
} from '@/lib/application-code'

describe('Application Code', () => {
  it('normalizes English application names', () => {
    expect(normalizeApplicationCode('Medical Screen  Pro')).toBe('medical-screen-pro')
  })

  it('falls back to the package tail for Chinese application names', () => {
    expect(suggestApplicationCode('医护屏', 'com.phoenix.medicalscreen')).toBe(
      'medicalscreen',
    )
  })

  it('accepts only lowercase kebab-case values', () => {
    expect(isApplicationCode('medical-screen')).toBe(true)
    expect(isApplicationCode('Medical_Screen')).toBe(false)
  })

  it('preserves a trailing hyphen while the user is still typing', () => {
    expect(sanitizeApplicationCodeInput('medical-')).toBe('medical-')
    expect(sanitizeApplicationCodeInput('medical-screen')).toBe('medical-screen')
  })
})
