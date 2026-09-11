import { ApplicationAppearanceSettings } from '@/features/applications/application-appearance-settings'
import { ApplicationMembersPanel } from '@/features/applications/application-members-panel'
import { canDeleteApplication } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Application } from '@/types/application'
import { AlertTriangle, Info, Palette, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApplicationBasicSettings } from './application-basic-settings'
import { ApplicationDangerSettings } from './application-danger-settings'
type SettingsView = 'basic' | 'appearance' | 'members' | 'danger'
interface ApplicationSettingsPanelProps {
  application: Application
  autoOpenMembers?: boolean
}
export function ApplicationSettingsPanel({
  application,
  autoOpenMembers = false,
}: ApplicationSettingsPanelProps) {
  const { t } = useTranslation()
  const platformRole = useAuthStore((state) => state.user?.role)
  const canDelete = canDeleteApplication(platformRole)
  const [view, setView] = useState<SettingsView>(autoOpenMembers ? 'members' : 'basic')
  const views: Array<{
    id: SettingsView
    label: string
    icon: typeof Info
    visible: boolean
  }> = [
    { id: 'basic', label: t('appSettings.navBasic'), icon: Info, visible: true },
    {
      id: 'appearance',
      label: t('appSettings.navAppearance'),
      icon: Palette,
      visible: true,
    },
    { id: 'members', label: t('appSettings.navMembers'), icon: Users, visible: true },
    {
      id: 'danger',
      label: t('appSettings.navDanger'),
      icon: AlertTriangle,
      visible: canDelete,
    },
  ]
  return (
    <div className="grid min-h-[28rem] gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-8">
      <nav
        className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
        aria-label={t('appSettings.sectionNav')}
      >
        {views
          .filter((item) => item.visible)
          .map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => setView(item.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.8125rem] font-medium transition-colors',
                  view === item.id
                    ? 'bg-muted/70 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  item.id === 'danger' && view === item.id && 'text-destructive',
                )}
              >
                <Icon className="size-3.5 opacity-75" />
                {item.label}
              </button>
            )
          })}
      </nav>

      <div className="min-w-0">
        <div hidden={view !== 'basic'}>
          <ApplicationBasicSettings application={application} />
        </div>

        {view === 'members' ? (
          <ApplicationMembersPanel
            applicationId={application.id}
            autoOpen={autoOpenMembers}
          />
        ) : null}

        {view === 'appearance' ? (
          <ApplicationAppearanceSettings application={application} />
        ) : null}

        {canDelete ? (
          <div hidden={view !== 'danger'}>
            <ApplicationDangerSettings application={application} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
