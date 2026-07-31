import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const STORAGE_PREFIX = 'artifact-center:content-scroll:'

interface ScrollLocation {
  pathname: string
  search: string
}

interface ScrollLocationState {
  restoreContentScroll?: boolean
}

interface UseContentScrollRestorationOptions {
  /** 列表内容完成渲染后再恢复，避免骨架屏把位置截断为 0。 */
  ready: boolean
}

export function getContentScrollStorageKey({ pathname, search }: ScrollLocation): string {
  return `${STORAGE_PREFIX}${pathname}${search}`
}

function readSavedScrollTop(storageKey: string): number | null {
  try {
    const value = window.sessionStorage.getItem(storageKey)
    if (value === null) return null

    const scrollTop = Number(value)
    return Number.isFinite(scrollTop) && scrollTop >= 0 ? scrollTop : null
  } catch {
    // 隐私模式或禁用存储时，列表仍应保持可用。
    return null
  }
}

function saveScrollTop(storageKey: string, scrollTop: number) {
  try {
    window.sessionStorage.setItem(storageKey, String(scrollTop))
  } catch {
    // 存储不可用只会失去恢复能力，不能影响路由跳转。
  }
}

/**
 * 恢复 AppLayout 主滚动容器的位置。
 *
 * 仅在浏览器后退/前进，或详情页明确携带恢复标记返回目录时执行，
 * 因而不会把旧位置应用到普通筛选和直接访问。
 */
export function useContentScrollRestoration({
  ready,
}: UseContentScrollRestorationOptions) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const restoredKeyRef = useRef<string | null>(null)
  const storageKey = getContentScrollStorageKey(location)
  const shouldRestore =
    navigationType === 'POP' ||
    (location.state as ScrollLocationState | null)?.restoreContentScroll === true

  useLayoutEffect(() => {
    if (!ready || !shouldRestore || restoredKeyRef.current === storageKey) return

    const scrollTop = readSavedScrollTop(storageKey)
    const contentArea = document.querySelector<HTMLElement>('[data-slot="content-area"]')
    restoredKeyRef.current = storageKey

    if (scrollTop === null || !contentArea) return

    const frame = window.requestAnimationFrame(() => {
      contentArea.scrollTop = scrollTop
    })

    return () => window.cancelAnimationFrame(frame)
  }, [ready, shouldRestore, storageKey])

  useEffect(() => {
    const contentArea = document.querySelector<HTMLElement>('[data-slot="content-area"]')
    if (!contentArea) return

    return () => saveScrollTop(storageKey, contentArea.scrollTop)
  }, [storageKey])
}
