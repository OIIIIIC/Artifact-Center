import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import { ProductsWorkspace } from '@/features/products/products-workspace'
import { useAuthStore } from '@/store/auth-store'

export function ProductsPage() {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin')
  if (!isAdmin) return <Navigate to="/" replace />
  return (
    <AppLayout
      breadcrumbs={[{ label: t('settings.regionsTitle') }]}
      contentClassName="overflow-hidden [scrollbar-gutter:auto]"
    >
      <ProductsWorkspace />
    </AppLayout>
  )
}
