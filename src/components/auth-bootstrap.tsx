import { useEffect, useSyncExternalStore, type ReactNode } from 'react'

import { useAuthStore } from '@/store/auth-store'
import { loadApplicationsPage } from '@/routes/load-applications-page'

function subscribeHydration(onStoreChange: () => void) {
  return useAuthStore.persist.onFinishHydration(onStoreChange)
}

function getHydrationSnapshot() {
  return useAuthStore.persist.hasHydrated()
}

/**
 * Wait for zustand persist rehydrate, then validate JWT via /auth/me.
 * Prevents flash of protected UI with a stale or empty session.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydrationSnapshot,
    () => false,
  )

  useEffect(() => {
    if (!hydrated) return
    // Loading public page code can overlap session validation. Protected data is
    // prepared only after AuthBootstrap releases the authenticated shell.
    if (window.location.pathname === '/') void loadApplicationsPage().catch(() => {})
    void bootstrap()
  }, [hydrated, bootstrap])

  if (!hydrated || !bootstrapped) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-background"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="size-8 animate-pulse rounded-xl bg-muted" aria-hidden />
        <span className="sr-only">正在恢复登录状态…</span>
      </div>
    )
  }

  return children
}
