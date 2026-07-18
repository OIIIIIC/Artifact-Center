import { Navigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/store/auth-store'

// Session must include a live JWT (mock-only user is no longer enough)

/**
 * Guards product routes. Unauthenticated users go to /login.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const location = useLocation()

  if (!user || !token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
