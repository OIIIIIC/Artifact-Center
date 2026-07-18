import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'

import { AuthBootstrap } from '@/components/auth-bootstrap'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryProvider } from '@/providers/query-provider'
import { ThemeProvider } from '@/providers/theme-provider'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <BrowserRouter>
          <TooltipProvider delayDuration={200}>
            <AuthBootstrap>
              {children}
              <Toaster />
            </AuthBootstrap>
          </TooltipProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryProvider>
  )
}
