import { Activity, HardDrive, MapPinned, Palette, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppLayout, PageContainer, PageHeader } from '@/components/layout'
import { AppearanceSettingsPanel } from '@/features/settings/appearance-settings-panel'
import { DiagnosticsSettingsPanel } from '@/features/settings/diagnostics-settings-panel'
import { MembersSettingsPanel } from '@/features/settings/members-settings-panel'
import { ProfileSecurityPanel } from '@/features/settings/profile-security-panel'
import { RegionsSettingsPanel } from '@/features/settings/regions-settings-panel'
import { RetentionSettingsPanel } from '@/features/settings/retention-settings-panel'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

type SettingsSection = 'general' | 'regions' | 'appearance' | 'retention' | 'diagnostics'

const SECTIONS: SettingsSection[] = ['general', 'regions', 'appearance', 'retention']

export function SettingsPage({ standalone }: { standalone?: 'members' }) {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin')
  const [section, setSection] = useState<SettingsSection>('general')
  const sections = isAdmin ? [...SECTIONS, 'diagnostics' as const] : SECTIONS
  const standaloneMembers = standalone === 'members'
  const sectionMeta = {
    general: { label: t('settings.navGeneral'), icon: UserRound },
    regions: { label: t('settings.navRegions'), icon: MapPinned },
    appearance: { label: t('settings.navAppearance'), icon: Palette },
    retention: { label: t('settings.navRetention'), icon: HardDrive },
    diagnostics: { label: t('settings.navDiagnostics'), icon: Activity },
  } satisfies Record<SettingsSection, { label: string; icon: typeof UserRound }>

  return (
    <AppLayout
      breadcrumbs={[{ label: standaloneMembers ? t('nav.members') : t('nav.settings') }]}
      contentClassName={section === 'diagnostics' ? 'xl:overflow-hidden' : undefined}
    >
      <PageContainer
        rhythm="product"
        className={cn(
          section === 'general' && !standaloneMembers && 'xl:pb-6',
          section === 'diagnostics' &&
            'xl:flex xl:h-full xl:flex-col xl:overflow-hidden xl:pb-6',
        )}
      >
        <PageHeader
          title={standaloneMembers ? t('settings.membersTitle') : t('settings.title')}
          description={standaloneMembers ? t('settings.membersDesc') : undefined}
        />

        <div
          className={cn(
            'mt-5 flex flex-col gap-8 sm:mt-6',
            !standaloneMembers && 'lg:flex-row lg:gap-10 xl:gap-12',
            section === 'diagnostics' && 'xl:min-h-0 xl:flex-1',
          )}
        >
          {!standaloneMembers ? (
            <nav
              aria-label={t('settings.sectionNav')}
              className="flex shrink-0 gap-1 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:w-[var(--settings-nav-width)] lg:flex-col lg:overflow-visible lg:pb-0"
            >
              {sections.map((id) => {
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
              })}
            </nav>
          ) : null}

          <div
            className={cn(
              'min-w-0 flex-1',
              !standaloneMembers && '[&_[data-slot=form-stack]]:max-w-none',
              section === 'diagnostics' &&
                'xl:h-full xl:min-h-0 xl:overflow-hidden xl:[&>section]:flex xl:[&>section]:h-full xl:[&>section]:min-h-0 xl:[&>section]:flex-col',
            )}
          >
            {standaloneMembers ? <MembersSettingsPanel hideHeader /> : null}
            {!standaloneMembers && section === 'general' ? (
              <ProfileSecurityPanel />
            ) : null}
            {!standaloneMembers && section === 'appearance' ? (
              <AppearanceSettingsPanel />
            ) : null}
            {!standaloneMembers && section === 'regions' ? (
              <RegionsSettingsPanel isAdmin={isAdmin} />
            ) : null}
            {!standaloneMembers && section === 'retention' ? (
              <RetentionSettingsPanel isAdmin={isAdmin} />
            ) : null}
            {!standaloneMembers && isAdmin && section === 'diagnostics' ? (
              <DiagnosticsSettingsPanel />
            ) : null}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
