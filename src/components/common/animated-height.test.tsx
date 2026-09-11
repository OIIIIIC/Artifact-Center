import { act, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AnimatedHeight } from './animated-height'

afterEach(() => vi.unstubAllGlobals())

it('uses delivered sizes without forcing layout and smoothly shrinks the flow height', async () => {
  let resize!: ResizeObserverCallback
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  const measure = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
  const { container, unmount } = render(
    <AnimatedHeight>
      <p>Applications</p>
    </AnimatedHeight>,
  )
  expect(measure).not.toHaveBeenCalled()
  const resizeTo = (height: number) =>
    act(() =>
      resize(
        [{ borderBoxSize: [{ blockSize: height }] } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    )
  resizeTo(300)
  const outer = container.firstElementChild as HTMLElement
  await waitFor(() => expect(outer.style.height).toBe('300px'))
  resizeTo(100)
  expect(parseFloat(outer.style.height)).toBeGreaterThan(100)
  await waitFor(() => expect(outer.style.height).toBe('100px'))
  expect(measure).not.toHaveBeenCalled()
  unmount()
  expect(disconnect).toHaveBeenCalled()
  measure.mockRestore()
})
