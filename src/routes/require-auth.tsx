import { Navigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/store/auth-store'

/**
 * Guards product routes. Unauthenticated users go to /login.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
