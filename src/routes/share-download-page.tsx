import { Download, Loader2, Package } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { BlankLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { useDownloadArtifact } from '@/features/applications/use-download-artifact'
import { resolveShareToken } from '@/features/share/resolve-share'
import { formatFileSize, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getArtifactChannel } from '@/types/artifact'

/**
 * Public share landing — `/d/:token`
 * Show what will be downloaded; user must click to download (no auto-start).
 */
export function ShareDownloadPage() {
  const { token = '' } = useParams()
  const { t, i18n } = useTranslation()
  void i18n.language
  const { download, isBusy } = useDownloadArtifact()

  // Re-resolve after zustand persist rehydrates
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setTimeout(() => setTick((n) => n + 1), 50)
    return () => window.clearTimeout(id)
  }, [token])

  const result = useMemo(() => resolveShareToken(token), [token, tick])
  const busy = result.ok ? isBusy(`share:${result.artifact.id}`) : false

  if (!result.ok) {
    const title =
      result.reason === 'expired'
        ? t('share.expiredTitle')
        : result.reason === 'artifact_missing'
          ? t('share.noArtifactTitle')
          : t('share.invalidTitle')
    const desc =
      result.reason === 'expired'
        ? t('share.expiredDesc')
        : result.reason === 'artifact_missing'
          ? t('share.noArtifactDesc')
          : t('share.invalidDesc')

    return (
      <BlankLayout>
        <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border/60">
            <Package className="size-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h1 className="text-[1.25rem] font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-muted-foreground">
            {desc}
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/login">{t('share.goLogin')}</Link>
          </Button>
        </div>
      </BlankLayout>
    )
  }

  const { application, artifact, link } = result
  const PlatformIcon = PLATFORM_ICON[artifact.platform]
  const channel = getArtifactChannel(artifact)

  return (
    <BlankLayout>
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
        <p className="text-[0.75rem] font-medium tracking-wide text-muted-foreground uppercase">
          {t('share.landingKicker')}
        </p>
        <h1 className="mt-2 text-[1.5rem] font-semibold tracking-tight text-foreground">
          {application.name}
        </h1>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          {link.mode === 'latest' ? t('share.landingLatest') : t('share.landingPinned')}
        </p>

        <div
          className={cn(
            'mt-8 rounded-2xl bg-muted/25 p-5 ring-1 ring-border/60',
            'dark:bg-muted/15 dark:ring-border/80',
          )}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-[0.8125rem]">
            <div>
              <dt className="text-[0.6875rem] text-muted-foreground/80 uppercase">
                {t('share.metaVersion')}
              </dt>
              <dd className="mt-0.5 font-mono font-medium text-foreground">
                v{artifact.version}
              </dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] text-muted-foreground/80 uppercase">
                {t('share.metaChannel')}
              </dt>
              <dd className="mt-0.5 text-foreground">{t(`channel.${channel}`)}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] text-muted-foreground/80 uppercase">
                {t('share.metaPlatform')}
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1.5 text-foreground">
                <PlatformIcon className="size-3.5 opacity-70" strokeWidth={1.75} />
                {t(`platform.${artifact.platform}`)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] text-muted-foreground/80 uppercase">
                {t('share.metaSize')}
              </dt>
              <dd className="mt-0.5 font-mono text-foreground">
                {formatFileSize(artifact.sizeBytes)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[0.6875rem] text-muted-foreground/80 uppercase">
                {t('share.metaFile')}
              </dt>
              <dd
                className="mt-0.5 truncate font-mono text-[0.8125rem] text-muted-foreground"
                title={artifact.filename}
              >
                {artifact.filename}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[0.6875rem] text-muted-foreground/80 uppercase">
                {t('share.metaBuild')}
              </dt>
              <dd className="mt-0.5 text-muted-foreground">
                {t('detail.build', { number: artifact.buildNumber })}
                {' · '}
                <time dateTime={artifact.uploadedAt}>
                  {formatRelativeTime(artifact.uploadedAt)}
                </time>
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-5 text-center text-[0.8125rem] text-muted-foreground">
          {t('share.confirmHint')}
        </p>

        <Button
          type="button"
          size="lg"
          className="mt-3 w-full"
          disabled={busy}
          onClick={() =>
            void download({
              id: `share:${artifact.id}`,
              filename: artifact.filename,
              version: artifact.version,
              sizeBytes: artifact.sizeBytes,
            })
          }
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <Download className="size-4" strokeWidth={1.75} />
          )}
          {busy
            ? t('share.downloading')
            : t('share.downloadCta', { version: artifact.version })}
        </Button>

        <p className="mt-6 text-center text-[0.6875rem] text-muted-foreground/80">
          {t('brand.name')} · {t('share.landingFooter')}
        </p>
      </div>
    </BlankLayout>
  )
}
