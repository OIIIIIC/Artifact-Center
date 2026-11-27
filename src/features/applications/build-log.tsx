import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { getJenkinsRequestErrorMessage } from '@/lib/jenkins-request-error'
import { buildLogText } from '@/lib/build-log-text'
import { apiBuildLog, type BuildRun } from '@/services/api/builds'

export function BuildLog({ run, active }: { run: BuildRun; active: boolean }) {
  const { t } = useTranslation()
  const cursor = useRef(0)
  const [text, setText] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (!active || run.buildNumber === null) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function load() {
      let more = true
      try {
        const result = await apiBuildLog(
          run.applicationId,
          run.id,
          cursor.current,
          controller.signal,
        )
        if (controller.signal.aborted) return
        cursor.current = result.nextStart
        setText((previous) => (previous + result.text).slice(-200_000))
        if (result.truncated || result.nextStart > 200_000) setTruncated(true)
        setError('')
        more =
          result.more ||
          ['running', 'queued', 'submitting', 'unknown'].includes(run.status)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(
          getJenkinsRequestErrorMessage(caught, {
            offline: t('common.requestFailedOffline'),
            unavailable: t('common.requestFailedUnavailable'),
            fallback: t('builds.logFailed'),
          }),
        )
      }
      if (!controller.signal.aborted && more) timer = setTimeout(() => void load(), 4000)
    }
    void load()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [active, run.applicationId, run.id, run.buildNumber, run.status, reload, t])
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('builds.log')}</h3>
        <Button size="sm" variant="ghost" onClick={() => setReload((value) => value + 1)}>
          {t('builds.refresh')}
        </Button>
      </div>
      {truncated && (
        <p className="text-xs text-muted-foreground">{t('builds.logTruncated')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <pre
        aria-label={t('builds.log')}
        className="max-h-96 min-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/50 p-4 font-mono text-xs leading-5"
      >
        {buildLogText(text) ||
          (run.buildNumber === null ? t('builds.waitingLog') : t('builds.emptyLog'))}
      </pre>
    </section>
  )
}
