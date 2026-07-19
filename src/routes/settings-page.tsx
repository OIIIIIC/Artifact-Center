import { HardDrive, Palette, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppLayout, PageContainer, PageHeader } from '@/components/layout'
import { AppearanceSettingsPanel } from '@/features/settings/appearance-settings-panel'
import { MembersSettingsPanel } from '@/features/settings/members-settings-panel'
import { ProfileSecurityPanel } from '@/features/settings/profile-security-panel'
import { RetentionSettingsPanel } from '@/features/settings/retention-settings-panel'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

type SettingsSection = 'general' | 'appearance' | 'retention'

const SECTIONS: SettingsSection[] = ['general', 'appearance', 'retention']

export function SettingsPage({ standalone }: { standalone?: 'members' }) {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin')
  const [section, setSection] = useState<SettingsSection>('general')
  const standaloneMembers = standalone === 'members'
  const sectionMeta = {
    general: { label: t('settings.navGeneral'), icon: UserRound },
    appearance: { label: t('settings.navAppearance'), icon: Palette },
    retention: { label: t('settings.navRetention'), icon: HardDrive },
  } satisfies Record<SettingsSection, { label: string; icon: typeof UserRound }>

  return (
    <AppLayout
      breadcrumbs={[{ label: standaloneMembers ? t('nav.members') : t('nav.settings') }]}
    >
      <PageContainer rhythm="product">
        <PageHeader
          title={standaloneMembers ? t('settings.membersTitle') : t('settings.title')}
          description={
            standaloneMembers ? t('settings.membersDesc') : t('settings.description')
          }
        />

        <div
          className={cn(
            'mt-8 flex flex-col gap-8 sm:mt-9',
            !standaloneMembers && 'lg:flex-row lg:gap-10 xl:gap-12',
          )}
        >
          {!standaloneMembers ? (
            <nav
              aria-label={t('settings.sectionNav')}
              className="flex shrink-0 gap-1 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:w-[var(--settings-nav-width)] lg:flex-col lg:overflow-visible lg:pb-0"
            >
              {SECTIONS.map((id) => {
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

          <div className="min-w-0 flex-1">
            {standaloneMembers ? <MembersSettingsPanel hideHeader /> : null}
            {!standaloneMembers && section === 'general' ? (
              <ProfileSecurityPanel />
            ) : null}
            {!standaloneMembers && section === 'appearance' ? (
              <AppearanceSettingsPanel />
            ) : null}
            {!standaloneMembers && section === 'retention' ? (
              <RetentionSettingsPanel isAdmin={isAdmin} />
            ) : null}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
