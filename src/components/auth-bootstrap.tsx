import { useEffect, useSyncExternalStore, type ReactNode } from 'react'

import { useAuthStore } from '@/store/auth-store'

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
    void bootstrap()
  }, [hydrated, bootstrap])

  if (!hydrated || !bootstrapped) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="size-8 animate-pulse rounded-xl bg-muted" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  return children
}
