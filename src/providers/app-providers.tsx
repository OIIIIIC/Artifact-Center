import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'

import { AuthBootstrap } from '@/components/auth-bootstrap'
import { ConnectivityNotice } from '@/components/feedback'
import { Toaster } from '@/components/ui/sonner'
import { UploadTaskIndicator } from '@/features/upload/upload-task-indicator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryProvider } from '@/providers/query-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { UploadManagerProvider } from '@/features/upload/upload-manager'
import { useAuthStore } from '@/store/auth-store'
import { ApplicationEntryPreparation } from '@/features/applications/application-entry'

interface AppProvidersProps {
  children: ReactNode
}

/**
 * 已登录会话才挂载上传管理器与任务条，避免登录/公开下载页拉取上传链路模块（PERF-01）。
 */
function AuthenticatedShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)

  if (!user) {
    return (
      <>
        {children}
        <ConnectivityNotice />
        <Toaster />
      </>
    )
  }

  return (
    <UploadManagerProvider>
      <ApplicationEntryPreparation />
      {children}
      <ConnectivityNotice />
      <UploadTaskIndicator />
      <Toaster />
    </UploadManagerProvider>
  )
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <BrowserRouter>
          <TooltipProvider delayDuration={200}>
            <AuthBootstrap>
              <AuthenticatedShell>{children}</AuthenticatedShell>
            </AuthBootstrap>
          </TooltipProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryProvider>
  )
}
