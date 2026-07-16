import { Navigate, Route, Routes } from 'react-router-dom'

import { DesignSystemPage } from '@/routes/design-system-page'
import { LayoutPlaygroundPage } from '@/routes/layout-playground-page'

/**
 * Foundation routes only.
 * Business modules (projects, upload, login, dashboard, …) are forbidden here.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/design-system" element={<DesignSystemPage />} />
      <Route path="/layout" element={<LayoutPlaygroundPage />} />
      <Route path="/" element={<Navigate to="/layout" replace />} />
      <Route path="*" element={<Navigate to="/layout" replace />} />
    </Routes>
  )
}
