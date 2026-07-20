import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * 创建表单中的轻量命名参考，只在出现相似应用时展示。
 */
export function CreateAppReferenceRail({
  apps,
  className,
}: {
  apps: Application[]
  className?: string
}) {
  const { t } = useTranslation()
  if (apps.length === 0) return null

  return (
    <aside
      className={cn(
        'rounded-xl bg-muted/25 px-3.5 py-3 ring-1 ring-border/55 dark:bg-muted/15',
        className,
      )}
      aria-label={t('createApp.referenceTitle')}
    >
      <p className="text-[0.75rem] leading-relaxed text-muted-foreground">
        {t('createApp.referenceHintActive')}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {apps.map((app) => {
          const Icon = PLATFORM_ICON[app.platform]
          return (
            <li key={app.id}>
              <Link
                to={`/applications/${app.id}`}
                className={cn(
                  'inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg bg-background/70 px-2 py-1.5',
                  'text-[0.75rem] ring-1 ring-border/55 transition-colors',
                  'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                )}
              >
                <span
                  className="flex size-4 shrink-0 items-center justify-center rounded text-[8px] font-semibold text-muted-foreground"
                  aria-hidden
                >
                  {initialsOf(app.name)}
                </span>
                <span className="truncate font-medium text-foreground">{app.name}</span>
                <span className="text-muted-foreground/45" aria-hidden>
                  ·
                </span>
                <span className="shrink-0 text-muted-foreground">{app.region.name}</span>
                <Icon
                  className="size-3 shrink-0 text-muted-foreground/70"
                  strokeWidth={1.75}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
