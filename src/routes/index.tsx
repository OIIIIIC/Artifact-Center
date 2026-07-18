import { Navigate, Route, Routes } from 'react-router-dom'

import { ApplicationDetailPage } from '@/routes/application-detail-page'
import { ApplicationsPage } from '@/routes/applications-page'
import { CreateApplicationPage } from '@/routes/create-application-page'
import { DesignSystemPage } from '@/routes/design-system-page'
import { LayoutPlaygroundPage } from '@/routes/layout-playground-page'
import { LoginPage } from '@/routes/login-page'
import { RequireAuth } from '@/routes/require-auth'
import { SearchPage } from '@/routes/search-page'
import { SettingsPage } from '@/routes/settings-page'
import { ShareDownloadPage } from '@/routes/share-download-page'
import { UploadPage } from '@/routes/upload-page'

/**
 * Product routes behind JWT auth.
 * Login + share download links are public; everything else requires session.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Capability URL — open without login; user chooses to download */}
      <Route path="/d/:token" element={<ShareDownloadPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <ApplicationsPage />
          </RequireAuth>
        }
      />
      <Route path="/applications" element={<Navigate to="/" replace />} />
      <Route
        path="/applications/new"
        element={
          <RequireAuth>
            <CreateApplicationPage />
          </RequireAuth>
        }
      />
      <Route
        path="/applications/:id"
        element={
          <RequireAuth>
            <ApplicationDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/upload"
        element={
          <RequireAuth>
            <UploadPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/search"
        element={
          <RequireAuth>
            <SearchPage />
          </RequireAuth>
        }
      />
      <Route
        path="/design-system"
        element={
          <RequireAuth>
            <DesignSystemPage />
          </RequireAuth>
        }
      />
      <Route
        path="/layout"
        element={
          <RequireAuth>
            <LayoutPlaygroundPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
