import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiApplicationPage } from '@/services/api/applications'
import type { ApplicationBuildConfig } from '@/services/api/jenkins'

type Target = NonNullable<ApplicationBuildConfig['outputTargets']>[number]

export function BuildOutputTargets({
  value,
  onChange,
  readOnly,
}: {
  value: Target[]
  onChange: (value: Target[]) => void
  readOnly: boolean
}) {
  const { t } = useTranslation()
  return (
    <section className="space-y-3">
      <h4 className="text-sm font-medium">{t('builds.outputTargets')}</h4>
      <p className="text-xs text-muted-foreground">{t('builds.outputTargetsHelp')}</p>
      {value.map((target, index) => (
        <TargetRow
          key={index}
          target={target}
          index={index}
          readOnly={readOnly}
          onChange={(next) =>
            onChange(value.map((item, i) => (i === index ? next : item)))
          }
          onRemove={() => onChange(value.filter((_, i) => i !== index))}
        />
      ))}
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          disabled={value.length >= 20}
          onClick={() =>
            onChange([...value, { name: '', pattern: '', applicationId: '' }])
          }
        >
          {t('builds.addOutputTarget')}
        </Button>
      )}
    </section>
  )
}

function TargetRow({
  target,
  index,
  readOnly,
  onChange,
  onRemove,
}: {
  target: Target
  index: number
  readOnly: boolean
  onChange: (target: Target) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const results = useQuery({
    queryKey: ['build-target-search', search],
    queryFn: ({ signal }) =>
      apiApplicationPage({ q: search, limit: 20, sort: 'name' }, signal),
    enabled: !readOnly,
  })
  const choices = (results.data?.items ?? []).filter((app) => app.status !== 'archived')
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <label className="block text-xs" htmlFor={`output-pattern-${index}`}>
        {t('builds.outputPattern')} {index + 1}
      </label>
      <Input
        id={`output-pattern-${index}`}
        required
        maxLength={300}
        placeholder="artifacts/caregiver-inner-*.apk"
        value={target.pattern}
        onChange={(e) => onChange({ ...target, pattern: e.target.value })}
      />
      {!readOnly && (
        <Input
          aria-label={`${t('builds.searchTarget')} ${index + 1}`}
          placeholder={t('builds.searchTarget')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      <label className="block text-xs" htmlFor={`output-app-${index}`}>
        {t('builds.publishTarget')} {index + 1}
      </label>
      <select
        id={`output-app-${index}`}
        required
        value={target.applicationId}
        className="w-full rounded-md border border-input bg-background p-2 text-sm"
        onChange={(e) => {
          const app = choices.find((item) => item.id === e.target.value)
          if (app) onChange({ ...target, applicationId: app.id, name: app.name })
        }}
      >
        <option value="">{t('builds.chooseTarget')}</option>
        {target.applicationId &&
          !choices.some((app) => app.id === target.applicationId) && (
            <option value={target.applicationId}>{target.name}</option>
          )}
        {choices.map((app) => (
          <option key={app.id} value={app.id}>
            {app.name} · {app.region.name}
          </option>
        ))}
      </select>
      {results.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('builds.targetLoadFailed')}
        </p>
      )}
      {!readOnly && (
        <Button type="button" variant="ghost" onClick={onRemove}>
          {t('jenkins.remove')}
        </Button>
      )}
    </div>
  )
}
