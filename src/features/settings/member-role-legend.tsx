import { useTranslation } from 'react-i18next'

import { MEMBER_ROLES } from './member-roles'

export function MemberRoleLegend() {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 px-3 text-xs text-muted-foreground">
      <p className="font-medium">{t('settings.roleLegendTitle')}</p>
      <dl className="space-y-3">
        {MEMBER_ROLES.map((role) => (
          <div key={role} className="space-y-1">
            <dt className="font-medium">{t(`settings.role.${role}`)}</dt>
            <dd className="leading-relaxed">{t(`settings.roleDesc.${role}`)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
