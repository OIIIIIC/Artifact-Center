import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UndoCapsule } from './undo-capsule'

beforeEach(() =>
  vi.useFakeTimers({
    toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
  }),
)
afterEach(() => vi.useRealTimers())

it('expires after five active seconds and pauses for hover and keyboard focus', () => {
  const expire = vi.fn()
  render(<UndoCapsule message="Removed" onUndo={vi.fn()} onExpire={expire} />)
  const capsule = screen.getByText('Removed').parentElement!
  act(() => vi.advanceTimersByTime(2000))
  fireEvent.pointerEnter(capsule, { pointerType: 'mouse' })
  act(() => vi.advanceTimersByTime(6000))
  expect(expire).not.toHaveBeenCalled()
  fireEvent.focus(screen.getByRole('button'))
  fireEvent.pointerLeave(capsule)
  act(() => vi.advanceTimersByTime(6000))
  expect(expire).not.toHaveBeenCalled()
  fireEvent.blur(screen.getByRole('button'), { relatedTarget: document.body })
  act(() => vi.advanceTimersByTime(3100))
  expect(expire).toHaveBeenCalledTimes(1)
})

it('activates undo and cancels its timer on unmount', () => {
  const undo = vi.fn()
  const expire = vi.fn()
  const view = render(<UndoCapsule message="Removed" onUndo={undo} onExpire={expire} />)
  fireEvent.click(screen.getByRole('button'))
  expect(undo).toHaveBeenCalledTimes(1)
  view.unmount()
  act(() => vi.advanceTimersByTime(6000))
  expect(expire).not.toHaveBeenCalled()
})
