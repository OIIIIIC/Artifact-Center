import { Profiler } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AvatarCropDialog } from './avatar-crop-dialog'

describe('AvatarCropDialog', () => {
  it('does not re-render the editor for every pointer move while dragging', () => {
    let commitCount = 0
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    })

    render(
      <Profiler
        id="avatar-crop"
        onRender={() => {
          commitCount += 1
        }}
      >
        <AvatarCropDialog
          source={{ url: 'blob:avatar', width: 1600, height: 1200 }}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </Profiler>,
    )

    const stage = screen.getByLabelText('settings.avatarCropStage')
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 })
    for (let index = 1; index <= 60; index += 1) {
      fireEvent.pointerMove(stage, {
        pointerId: 1,
        clientX: 100 + index,
        clientY: 100 + index,
      })
    }
    fireEvent.pointerUp(stage, { pointerId: 1 })

    expect(commitCount).toBeLessThanOrEqual(4)
  })
})
