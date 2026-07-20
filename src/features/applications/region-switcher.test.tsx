import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RegionSwitcher } from './region-switcher'
import type { Region } from '@/types/application'

const regions: Region[] = [
  {
    id: 'beijing',
    code: 'beijing',
    name: '北京',
    sortOrder: 0,
    enabled: true,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  },
]

describe('地域切换器', () => {
  let capturedElement: HTMLElement | null

  beforeEach(() => {
    capturedElement = null
    HTMLElement.prototype.setPointerCapture = vi.fn(() => {
      capturedElement = document.querySelector('[data-slot="region-scroll"]')
    })
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => capturedElement !== null)
    HTMLElement.prototype.releasePointerCapture = vi.fn(() => {
      capturedElement = null
    })
  })

  it('鼠标轻点地域时触发筛选，不应被拖拽容器截获', () => {
    const onChange = vi.fn()
    render(
      <RegionSwitcher
        regions={regions}
        selected="all"
        counts={{ beijing: 1 }}
        onChange={onChange}
      />,
    )

    const regionButton = screen.getByRole('button', { name: '北京1' })
    fireEvent.pointerDown(regionButton, {
      pointerType: 'mouse',
      button: 0,
      clientX: 100,
      pointerId: 1,
    })
    const pointerUpTarget = capturedElement ?? regionButton
    fireEvent.pointerUp(pointerUpTarget, {
      pointerType: 'mouse',
      button: 0,
      clientX: 100,
      pointerId: 1,
    })
    fireEvent.click(pointerUpTarget)

    expect(onChange).toHaveBeenCalledWith('beijing')
  })

  it('具体地域的选中边框在滚动容器内部绘制', () => {
    render(
      <RegionSwitcher
        regions={regions}
        selected="beijing"
        counts={{ beijing: 1 }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '北京1' })).toHaveClass('ring-inset')
  })
})
