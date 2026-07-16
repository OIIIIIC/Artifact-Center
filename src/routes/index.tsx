import { Navigate, Route, Routes } from 'react-router-dom'

import { DesignSystemPage } from '@/routes/design-system-page'

/**
 * Bootstrap routing: only /design-system is allowed.
 * Business routes (projects, upload, etc.) must not be added until product phase.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/design-system" element={<DesignSystemPage />} />
      <Route path="/" element={<Navigate to="/design-system" replace />} />
      <Route path="*" element={<Navigate to="/design-system" replace />} />
    </Routes>
  )
}
