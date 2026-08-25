import { MapPin, Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import { StatusBadge, UserAvatar } from '@/components/common'
import { ApplicationAvatar } from '@/features/applications/application-avatar'
import { APPLICATION_STATUS_LABEL } from '@/features/applications/application-status-meta'
import { AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { PLATFORM_ICON, PLATFORM_LABEL } from '@/features/applications/platform-meta'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Application, ApplicationStatus } from '@/types/application'

interface ApplicationCardProps {
  application: Application
  className?: string
}

function statusKey(status: ApplicationStatus): string | null {
  if (status === 'active') return null
  /** Same keys as detail / settings — one lifecycle vocabulary */
  return `appSettings.status.${status}`
}

/**
 * 列表卡片只负责识别与进入详情；下载 / 分享放在详情页，
 * 方便用户先看清更新时间与变更内容再操作。
 */
export function ApplicationCard({ application, className }: ApplicationCardProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const currentUser = useAuthStore((state) => state.user)
  const PlatformIcon = PLATFORM_ICON[application.platform]

  const sKey = statusKey(application.status)
  const members = (application.members ?? []).filter(
    (member) => member.id !== currentUser?.id,
  )
  const visibleMembers = members.slice(0, 2)
  const statusVariant =
    application.status === 'new'
      ? 'new'
      : application.status === 'beta'
        ? 'beta'
        : application.status === 'deprecated'
          ? 'deprecated'
          : application.status === 'archived'
            ? 'archived'
            : application.status === 'active'
              ? 'success'
              : 'default'

  const hasVersion = Boolean(application.latestVersion.trim())

  // force re-format when locale changes
  void i18n.language

  return (
    <Link
      to={`/applications/${application.id}`}
      state={{
        returnTo: `${location.pathname}${location.search}`,
      }}
      className={cn(
        'group/card relative flex h-full flex-col rounded-xl bg-card p-5',
        'shadow-[var(--shadow-xs)] ring-1 ring-border/60',
        'transition-[box-shadow,ring-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
        'hover:shadow-[var(--shadow-md)] hover:ring-border-strong/70',
        'dark:shadow-none dark:ring-border dark:hover:ring-border-strong',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <ApplicationAvatar application={application} className="size-12" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3
              className="line-clamp-2 min-w-0 break-words text-[0.9375rem] leading-snug font-semibold tracking-tight text-foreground"
              title={application.name}
            >
              {application.name}
            </h3>
            {sKey ? (
              <StatusBadge
                status={statusVariant}
                className={cn(
                  'shrink-0',
                  application.status === 'new'
                    ? 'uppercase'
                    : 'normal-case tracking-normal',
                )}
              >
                {t(sKey)}
              </StatusBadge>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-1 text-[0.8125rem] leading-relaxed font-normal text-muted-foreground">
            {application.description}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-5 items-center gap-1 rounded-md bg-muted/55 px-1.5 text-[11px] font-medium text-foreground/75 dark:bg-muted/45">
          <MapPin className="size-3 opacity-65" strokeWidth={1.75} aria-hidden />
          {application.region.name}
        </span>
        <span className="inline-flex h-5 items-center gap-1 rounded-md bg-muted/50 px-1.5 text-[11px] text-muted-foreground dark:bg-muted/40">
          <PlatformIcon className="size-3 opacity-70" strokeWidth={1.75} aria-hidden />
          {t(`platform.${application.platform}`)}
        </span>
        {hasVersion ? (
          <span className="inline-flex h-5 items-center rounded-md bg-muted/40 px-1.5 font-mono text-[11px] text-muted-foreground dark:bg-muted/30">
            v{application.latestVersion}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <AvatarGroup aria-label={t('applications.membersLabel')}>
            {currentUser ? (
              <UserAvatar
                user={currentUser}
                size="sm"
                title={currentUser.name}
                fallbackClassName="text-[0.625rem] font-medium"
              />
            ) : null}
            {visibleMembers.map((member) => (
              <UserAvatar
                key={member.id}
                user={member}
                size="sm"
                title={member.name}
                fallbackClassName="text-[0.625rem] font-medium"
              />
            ))}
            {members.length > visibleMembers.length ? (
              <AvatarGroupCount className="text-[0.625rem] font-medium">
                +{members.length - visibleMembers.length}
              </AvatarGroupCount>
            ) : null}
          </AvatarGroup>
          <time
            className="truncate text-[0.75rem] text-muted-foreground/70"
            dateTime={application.latestArtifactUploadedAt ?? application.updatedAt}
            title={application.latestArtifactUploadedAt ?? application.updatedAt}
          >
            {formatRelativeTime(
              application.latestArtifactUploadedAt ?? application.updatedAt,
            )}
          </time>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[0.75rem] text-muted-foreground/70">
          <Package className="size-3.5" strokeWidth={1.75} aria-hidden />
          {t('applications.artifactsCount', { count: application.artifactCount })}
        </span>
      </div>
    </Link>
  )
}

// re-export for any leftover imports
export { APPLICATION_STATUS_LABEL, PLATFORM_LABEL }
