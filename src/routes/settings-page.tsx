import {
  ClipboardList,
  HardDrive,
  Box,
  Palette,
  Bot,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'

import { AppLayout, PageContainer } from '@/components/layout'
import { AccessPermissionsPanel } from '@/features/settings/access-permissions-panel'
import { AppearanceSettingsPanel } from '@/features/settings/appearance-settings-panel'
import { MembersSettingsPanel } from '@/features/settings/members-settings-panel'
import { OperationLogsSettingsPanel } from '@/features/settings/operation-logs-settings-panel'
import { ProfileSecurityPanel } from '@/features/settings/profile-security-panel'
import { ReleaseRobotsSettingsPanel } from '@/features/settings/release-robots-settings-panel'
import { RegionsSettingsPanel } from '@/features/settings/regions-settings-panel'
import { RetentionSettingsPanel } from '@/features/settings/retention-settings-panel'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

type SettingsSection =
  | 'general'
  | 'appearance'
  | 'retention'
  | 'robots'
  | 'members'
  | 'regions'
  | 'access'
  | 'audit'
type SettingsStandalone = Extract<SettingsSection, 'members' | 'regions' | 'access'>

const PERSONAL_SECTIONS: SettingsSection[] = ['general', 'appearance']
const PLATFORM_SECTIONS: SettingsSection[] = ['retention']
const MANAGEMENT_SECTIONS: SettingsSection[] = [
  'robots',
  'members',
  'regions',
  'access',
  'audit',
]

export function SettingsPage({ standalone }: { standalone?: SettingsStandalone }) {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin')
  const [section, setSection] = useState<SettingsSection>(standalone ?? 'general')

  if (standalone && !isAdmin) {
    return <Navigate to="/settings" replace />
  }

  const sectionMeta = {
    general: { label: t('settings.navGeneral'), icon: UserRound },
    appearance: { label: t('settings.navAppearance'), icon: Palette },
    retention: { label: t('settings.navRetention'), icon: HardDrive },
    robots: { label: t('settings.navReleaseRobots'), icon: Bot },
    members: { label: t('settings.navMembers'), icon: Users },
    regions: { label: t('settings.navRegions'), icon: Box },
    access: { label: t('settings.navAccess'), icon: ShieldCheck },
    audit: { label: t('settings.navAudit'), icon: ClipboardList },
  } satisfies Record<SettingsSection, { label: string; icon: typeof UserRound }>
  const renderNavItem = (id: SettingsSection) => {
    const meta = sectionMeta[id]
    const Icon = meta.icon
    const active = section === id

    return (
      <button
        key={id}
        type="button"
        onClick={() => setSection(id)}
        className={cn(
          'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.8125rem] font-medium transition-colors duration-[var(--duration-hover)]',
          active
            ? 'bg-muted/70 text-foreground'
            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
        )}
        aria-current={active ? 'page' : undefined}
      >
        <Icon className="size-3.5 opacity-70" strokeWidth={1.75} />
        {meta.label}
      </button>
    )
  }

  return (
    <AppLayout
      breadcrumbs={[{ label: t('settings.title') }]}
      contentClassName="lg:overflow-hidden"
    >
      <PageContainer rhythm="product" className={cn('lg:h-full lg:py-0')}>
        <div
          className={cn(
            'flex flex-col gap-8 lg:h-full lg:min-h-0 lg:flex-row lg:gap-10 xl:gap-12',
          )}
        >
          <aside className="shrink-0 lg:h-full lg:w-[var(--settings-nav-width)] lg:overflow-hidden lg:py-8">
            <nav
              aria-label={t('settings.sectionNav')}
              className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
            >
              <SettingsNavGroup label={t('settings.groupPersonal')}>
                {PERSONAL_SECTIONS.map(renderNavItem)}
              </SettingsNavGroup>
              <SettingsNavGroup label={t('settings.groupPlatform')}>
                {PLATFORM_SECTIONS.map(renderNavItem)}
              </SettingsNavGroup>
              {isAdmin ? (
                <SettingsNavGroup
                  label={t('settings.groupManagement')}
                  className="border-t border-border/60 pt-3 lg:mt-2"
                >
                  {MANAGEMENT_SECTIONS.map(renderNavItem)}
                </SettingsNavGroup>
              ) : null}
            </nav>
          </aside>

          <div
            className={cn(
              'min-w-0 flex-1 lg:min-h-0 lg:overflow-x-hidden lg:overflow-y-auto lg:px-1 lg:py-8 lg:[scrollbar-gutter:stable]',
              '[&_[data-slot=form-stack]]:max-w-none',
            )}
          >
            {section === 'general' ? <ProfileSecurityPanel /> : null}
            {section === 'appearance' ? <AppearanceSettingsPanel hideHeader /> : null}
            {section === 'retention' ? (
              <RetentionSettingsPanel isAdmin={isAdmin} hideHeader />
            ) : null}
            {isAdmin && section === 'members' ? (
              <MembersSettingsPanel hideHeader />
            ) : null}
            {isAdmin && section === 'robots' ? (
              <ReleaseRobotsSettingsPanel
                hideHeader
                onViewAudit={() => setSection('audit')}
              />
            ) : null}
            {isAdmin && section === 'regions' ? (
              <RegionsSettingsPanel isAdmin={isAdmin} hideHeader />
            ) : null}
            {isAdmin && section === 'access' ? (
              <AccessPermissionsPanel isAdmin={isAdmin} hideHeader />
            ) : null}
            {isAdmin && section === 'audit' ? (
              <OperationLogsSettingsPanel hideHeader />
            ) : null}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  )
}

function SettingsNavGroup({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex shrink-0 flex-col gap-1', className)}>
      <p className="hidden px-3 pb-0.5 pt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground lg:block">
        {label}
      </p>
      {children}
    </div>
  )
}
