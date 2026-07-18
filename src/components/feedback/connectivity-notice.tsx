import { CloudOff, ServerCrash } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getConnectivityStatus,
  setConnectivityStatus,
  subscribeConnectivityStatus,
} from '@/services/http'

export function ConnectivityNotice() {
  const { t } = useTranslation()
  const status = useSyncExternalStore(
    subscribeConnectivityStatus,
    getConnectivityStatus,
    getConnectivityStatus,
  )

  useEffect(() => {
    const onOffline = () => setConnectivityStatus('offline')
    const onOnline = () => setConnectivityStatus(null)
    if (!navigator.onLine) onOffline()
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  if (!status) return null

  const offline = status === 'offline'
  const Icon = offline ? CloudOff : ServerCrash
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[200] w-[min(23rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover px-3.5 py-3 shadow-md lg:left-[calc(var(--sidebar-width)+1rem)]">
      <div className="flex items-start gap-2.5">
        <Icon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          strokeWidth={1.75}
        />
        <div>
          <p className="text-[0.8125rem] font-medium text-foreground">
            {offline ? t('common.offlineTitle') : t('common.serviceUnavailableTitle')}
          </p>
          <p className="mt-0.5 text-[0.75rem] leading-relaxed text-muted-foreground">
            {offline
              ? t('common.offlineDescription')
              : t('common.serviceUnavailableDescription')}
          </p>
        </div>
      </div>
    </div>
  )
}
