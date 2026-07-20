import { useQuery } from '@tanstack/react-query'
import { Download, FileArchive, Loader2, MapPin, Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { BlankLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ArtifactRiskNotice } from '@/features/applications/artifact-risk-warning'
import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { useDownloadArtifact } from '@/features/applications/use-download-artifact'
import { resolveShareToken } from '@/features/share/resolve-share'
import { formatAbsoluteDate, formatFileSize } from '@/lib/format'
import { getArtifactChannel, getArtifactRiskStatus } from '@/types/artifact'

export function ShareDownloadPage() {
  const { token = '' } = useParams()
  const { t } = useTranslation()
  const { download, isBusy, downloadConfirmation } = useDownloadArtifact()
  const resolveQuery = useQuery({
    queryKey: ['share-resolve', token],
    queryFn: () => resolveShareToken(token),
    enabled: Boolean(token),
    staleTime: 30_000,
    retry: 1,
  })

  const result = resolveQuery.data
  if (resolveQuery.isLoading || !result) {
    return (
      <BlankLayout>
        <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      </BlankLayout>
    )
  }

  if (!result.ok) {
    const expired = result.reason === 'expired'
    const revoked = result.reason === 'revoked'
    return (
      <BlankLayout>
        <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border/60">
            <Package className="size-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {expired
              ? t('share.expiredTitle')
              : revoked
                ? t('share.revokedTitle')
                : t('share.invalidTitle')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {expired
              ? t('share.expiredDesc')
              : revoked
                ? t('share.revokedDesc')
                : t('share.invalidDesc')}
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/login">{t('share.goLogin')}</Link>
          </Button>
        </div>
      </BlankLayout>
    )
  }

  return (
    <BlankLayout>
      <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <header>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('share.landingKicker')}
          </p>
          <div className="mt-2">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {result.link.title || t('share.collectionFallbackTitle')}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {result.region ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {result.region.name}
                  </span>
                ) : null}
                {result.sharedBy ? (
                  <span>{t('share.sharedByLine', { name: result.sharedBy })}</span>
                ) : null}
                {result.link.expiresAt ? (
                  <span>
                    {t('share.expiresAt', {
                      date: formatAbsoluteDate(result.link.expiresAt),
                    })}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8 space-y-3" aria-label={t('share.collectionItems')}>
          {result.items.map((item) => {
            const artifact = item.artifact
            const PlatformIcon = PLATFORM_ICON[item.application.platform]
            const busy = isBusy(`share:${item.id}`)
            const riskStatus = artifact
              ? item.application.status === 'archived'
                ? ('applicationArchived' as const)
                : getArtifactRiskStatus(artifact)
              : null

            return (
              <article
                key={item.id}
                className="rounded-2xl bg-card/60 p-4 ring-1 ring-border/70 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                    <PlatformIcon className="size-4.5" strokeWidth={1.6} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">
                        {item.application.name}
                      </h2>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
                        {item.mode === 'latest'
                          ? t('share.modeLatestShort')
                          : t('share.modePinnedShort')}
                      </span>
                    </div>
                    {artifact ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        v{artifact.version} ·{' '}
                        {t(`channel.${getArtifactChannel(artifact)}`)}
                        {' · '}
                        {formatFileSize(artifact.sizeBytes)}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-destructive">
                        {t('share.collectionItemUnavailable')}
                      </p>
                    )}
                  </div>
                  {artifact ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void download({
                          id: `share:${item.id}`,
                          artifactId: artifact.id,
                          filename: artifact.filename,
                          version: artifact.version,
                          sizeBytes: artifact.sizeBytes,
                          shareToken: result.serverToken,
                          shareItemId: item.id,
                          riskStatus,
                        })
                      }
                    >
                      {busy ? <Loader2 className="animate-spin" /> : <Download />}
                      <span className="hidden sm:inline">{t('share.downloadItem')}</span>
                    </Button>
                  ) : null}
                </div>

                {artifact ? (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileArchive className="size-3.5 shrink-0" />
                      <span
                        className="min-w-0 truncate font-mono"
                        title={artifact.filename}
                      >
                        {artifact.filename}
                      </span>
                      <span className="ml-auto shrink-0">
                        {t('detail.build', { number: artifact.buildNumber })}
                      </span>
                    </div>
                    {artifact.releaseNotes.trim() ? (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {artifact.releaseNotes.trim()}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {riskStatus ? (
                  <ArtifactRiskNotice
                    risk={riskStatus}
                    context="download"
                    className="mt-3"
                  />
                ) : null}
              </article>
            )
          })}
        </section>

        {result.items.length > 1 ? (
          <p className="mt-7 text-center text-xs text-muted-foreground">
            {t('share.collectionDownloadHint')}
          </p>
        ) : null}
        <p className="mt-6 text-center text-[0.6875rem] text-muted-foreground/80">
          {t('brand.name')} · {t('share.landingFooter')}
        </p>
        {downloadConfirmation}
      </main>
    </BlankLayout>
  )
}
