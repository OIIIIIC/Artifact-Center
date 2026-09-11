import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useProjects } from './use-projects'

export function ProjectSelect({
  productId,
  value,
  onChange,
  disabled,
  currentProjectId,
}: {
  productId: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  currentProjectId?: string
}) {
  const { t } = useTranslation()
  const { projects, loading, error, refetch } = useProjects()
  const options = projects.filter((p) => p.productId === productId)
  return (
    <div className="space-y-1.5">
      <label className="text-[0.8125rem] font-medium" htmlFor="application-project">
        {t('directory.project')}
      </label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled || loading || !productId || !!error}
      >
        <SelectTrigger id="application-project" className="w-full">
          <SelectValue
            placeholder={t(loading ? 'directory.loading' : 'directory.chooseProject')}
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((p) => (
            <SelectItem
              key={p.id}
              value={p.id}
              disabled={!p.enabled && p.id !== currentProjectId}
            >
              {p.name}
              {!p.enabled ? ` · ${t('settings.regionInactive')}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()}>
          {t('directory.loadFailed')} · {t('common.retry')}
        </Button>
      ) : null}
    </div>
  )
}
