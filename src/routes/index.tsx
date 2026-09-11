import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { Loading } from '@/components/feedback/loading'
import { RequireAuth } from '@/routes/require-auth'
import { loadApplicationsPage } from '@/routes/load-applications-page'

const ProductsPage = lazy(() =>
  import('@/routes/products-page').then((module) => ({ default: module.ProductsPage })),
)
const ApplicationsPage = lazy(loadApplicationsPage)
const ApplicationDetailPage = lazy(() =>
  import('@/routes/application-detail-page').then((module) => ({
    default: module.ApplicationDetailPage,
  })),
)
const CreateApplicationPage = lazy(() =>
  import('@/routes/create-application-page').then((module) => ({
    default: module.CreateApplicationPage,
  })),
)
const DesignSystemPage = lazy(() =>
  import('@/routes/design-system-page').then((module) => ({
    default: module.DesignSystemPage,
  })),
)
const LayoutPlaygroundPage = lazy(() =>
  import('@/routes/layout-playground-page').then((module) => ({
    default: module.LayoutPlaygroundPage,
  })),
)
const LoginPage = lazy(() =>
  import('@/routes/login-page').then((module) => ({ default: module.LoginPage })),
)
const SearchPage = lazy(() =>
  import('@/routes/search-page').then((module) => ({ default: module.SearchPage })),
)
const SettingsPage = lazy(() =>
  import('@/routes/settings-page').then((module) => ({ default: module.SettingsPage })),
)
const ShareDownloadPage = lazy(() =>
  import('@/routes/share-download-page').then((module) => ({
    default: module.ShareDownloadPage,
  })),
)
const UploadPage = lazy(() =>
  import('@/routes/upload-page').then((module) => ({ default: module.UploadPage })),
)
const WorkspacePage = lazy(() =>
  import('@/routes/workspace-page').then((module) => ({
    default: module.WorkspacePage,
  })),
)

/**
 * Product routes behind JWT auth.
 * Login + share download links are public; everything else requires session.
 */
export function AppRouter() {
  return (
    <Suspense fallback={<Loading className="min-h-screen" label="正在加载页面…" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* 能力链接公开访问，由用户主动确认下载 */}
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
          path="/workspace"
          element={
            <RequireAuth>
              <WorkspacePage />
            </RequireAuth>
          }
        />
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
          path="/members"
          element={
            <RequireAuth>
              <SettingsPage standalone="members" />
            </RequireAuth>
          }
        />
        <Route path="/regions" element={<Navigate to="/products" replace />} />
        <Route
          path="/products"
          element={
            <RequireAuth>
              <ProductsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/permissions"
          element={
            <RequireAuth>
              <SettingsPage standalone="access" />
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
    </Suspense>
  )
}
