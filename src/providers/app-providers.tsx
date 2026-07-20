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

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <BrowserRouter>
          <UploadManagerProvider>
            <TooltipProvider delayDuration={200}>
              <AuthBootstrap>
                {children}
                <ConnectivityNotice />
                <UploadTaskIndicator />
                <Toaster />
              </AuthBootstrap>
            </TooltipProvider>
          </UploadManagerProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryProvider>
  )
}
