import { Navigate, Route, Routes } from 'react-router-dom'

import { ApplicationDetailPage } from '@/routes/application-detail-page'
import { ApplicationsPage } from '@/routes/applications-page'
import { DesignSystemPage } from '@/routes/design-system-page'
import { LayoutPlaygroundPage } from '@/routes/layout-playground-page'
import { UploadPage } from '@/routes/upload-page'

/**
 * Product routes: Applications, Detail, Upload.
 * No Dashboard.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<ApplicationsPage />} />
      <Route path="/applications" element={<Navigate to="/" replace />} />
      <Route path="/applications/:id" element={<ApplicationDetailPage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/design-system" element={<DesignSystemPage />} />
      <Route path="/layout" element={<LayoutPlaygroundPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
