import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/store/auth-store'

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const userId = useAuthStore((state) => state.user?.id ?? null)
  // Remount observers too, so placeholderData cannot carry data into another account.
  return <QuerySession key={userId}>{children}</QuerySession>
}

function QuerySession({ children }: QueryProviderProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  useEffect(
    () =>
      useAuthStore.subscribe((next, previous) => {
        if (next.user?.id !== previous.user?.id) {
          // Clear synchronously at the session boundary, including inactive queries.
          // Query cancellation prevents late responses from repopulating this cache.
          client.clear()
        }
      }),
    [client],
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
