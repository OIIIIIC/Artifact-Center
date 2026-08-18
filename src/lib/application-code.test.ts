import { describe, expect, it } from 'vitest'

import {
  isApplicationCode,
  normalizeApplicationCode,
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
})
