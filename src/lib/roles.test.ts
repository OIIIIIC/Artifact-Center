import { describe, expect, it } from 'vitest'

import { canMaintainApplication } from './roles'

describe('canMaintainApplication', () => {
  it('allows an application maintainer even when their platform role is viewer', () => {
    expect(canMaintainApplication('viewer', 'maintainer')).toBe(true)
  })

  it('does not grant application actions from the platform maintainer role alone', () => {
    expect(canMaintainApplication('maintainer', 'viewer')).toBe(false)
  })

  it('lets platform administrators manage every application', () => {
    expect(canMaintainApplication('admin', 'viewer')).toBe(true)
  })
})
