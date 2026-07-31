import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import {
  getContentScrollStorageKey,
  useContentScrollRestoration,
} from './use-content-scroll-restoration'

function ScrollRestorationProbe({ ready }: { ready: boolean }) {
  useContentScrollRestoration({ ready })
  return <div data-slot="content-area" />
}

const listEntry = {
  pathname: '/',
  search: '?q=mobile&platform=android',
  state: { restoreContentScroll: true },
}

afterEach(() => {
  window.sessionStorage.clear()
})

describe('应用列表滚动恢复', () => {
  it('从详情明确返回相同筛选 URL 时恢复 AppLayout 主滚动容器位置', async () => {
    const key = getContentScrollStorageKey(listEntry)
    window.sessionStorage.setItem(key, '480')

    const { container } = render(
      <MemoryRouter initialEntries={[listEntry]}>
        <ScrollRestorationProbe ready />
      </MemoryRouter>,
    )

    const contentArea = container.querySelector<HTMLElement>('[data-slot="content-area"]')
    expect(contentArea).not.toBeNull()

    await waitFor(() => expect(contentArea?.scrollTop).toBe(480))
  })

  it('离开列表时按当前 URL 保存滚动位置，供浏览器后退恢复', () => {
    const { container, unmount } = render(
      <MemoryRouter initialEntries={[listEntry]}>
        <ScrollRestorationProbe ready />
      </MemoryRouter>,
    )
    const contentArea = container.querySelector<HTMLElement>('[data-slot="content-area"]')
    expect(contentArea).not.toBeNull()
    if (contentArea) contentArea.scrollTop = 312

    unmount()

    expect(window.sessionStorage.getItem(getContentScrollStorageKey(listEntry))).toBe(
      '312',
    )
  })

  it('内容尚未完成渲染时不提前恢复，数据就绪后再恢复', async () => {
    const key = getContentScrollStorageKey(listEntry)
    window.sessionStorage.setItem(key, '196')

    const { container, rerender } = render(
      <MemoryRouter initialEntries={[listEntry]}>
        <ScrollRestorationProbe ready={false} />
      </MemoryRouter>,
    )
    const contentArea = container.querySelector<HTMLElement>('[data-slot="content-area"]')
    expect(contentArea?.scrollTop).toBe(0)

    rerender(
      <MemoryRouter initialEntries={[listEntry]}>
        <ScrollRestorationProbe ready />
      </MemoryRouter>,
    )

    await waitFor(() => expect(contentArea?.scrollTop).toBe(196))
  })
})
