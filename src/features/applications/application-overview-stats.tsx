import { useTranslation } from 'react-i18next'

import type { Application } from '@/types/application'

interface ApplicationOverviewStatsProps {
  applications: Application[]
  activeMemberCount?: number
}

export function ApplicationOverviewStats({
  applications,
  activeMemberCount,
}: ApplicationOverviewStatsProps) {
  const { t } = useTranslation()
  const androidCount = applications.filter(
    (application) => application.platform === 'android',
  ).length
  const platformCount = new Set(applications.map((application) => application.platform))
    .size
  const androidShare = applications.length
    ? Math.round((androidCount / applications.length) * 100)
    : 0
  const artifactCount = applications.reduce(
    (total, application) => total + application.artifactCount,
    0,
  )
  const platforms = ['android', 'windows', 'zip'] as const
  const platformSummary = platforms
    .map((platform) => ({
      platform,
      count: applications.filter((application) => application.platform === platform)
        .length,
    }))
    .filter(({ count }) => count > 0)
    .map(({ platform, count }) => `${t(`platform.${platform}`)} ${count}`)
    .join(' · ')
  /** 将范围信息压缩为页尾摘要，避免在应用列表上形成 Dashboard 视觉重心。 */
  const stats = [
    {
      label: t('applications.stats.total'),
      value: applications.length,
      detail: t('applications.artifactsCount', { count: artifactCount }),
    },
    {
      label: t('applications.stats.android'),
      value: androidCount,
      detail: t('applications.stats.androidShare', { percent: androidShare }),
    },
    {
      label: t('applications.stats.platforms'),
      value: platformCount,
      detail: platformSummary,
    },
    {
      label: t('applications.stats.members'),
      value: activeMemberCount ?? '—',
      detail: t('applications.stats.membersAvailable'),
    },
  ]

  return (
    <section aria-label={t('applications.stats.aria')}>
      <ul className="grid divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {stats.map((stat) => {
          return (
            <li key={stat.label} className="min-w-0 px-4 py-3.5 sm:px-5">
              <span className="block text-[0.75rem] font-medium text-muted-foreground">
                {stat.label}
              </span>
              <div className="mt-1 flex min-w-0 items-baseline gap-2">
                <strong className="shrink-0 text-[1.125rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">
                  {stat.value}
                </strong>
                <span
                  className="truncate text-[0.75rem] text-muted-foreground/80"
                  title={stat.detail}
                >
                  {stat.detail}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
