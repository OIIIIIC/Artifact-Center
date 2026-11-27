import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getJenkinsRequestErrorMessage } from '@/lib/jenkins-request-error'
import {
  apiGetApplicationBuildConfig,
  apiSaveApplicationBuildConfig,
  apiTestApplicationBuildConfig,
  jenkinsKeys,
  type ApplicationBuildConfig,
  type ApplicationBuildSettings,
} from '@/services/api/jenkins'
import { useAuthStore } from '@/store/auth-store'
import type { Application } from '@/types/application'
import { BuildOutputTargets } from './build-output-targets'

export function ApplicationBuildSettingsPanel({
  application,
}: {
  application: Application
}) {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin')
  const query = useQuery({
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: jenkinsKeys.application(application.id),
    queryFn: () => apiGetApplicationBuildConfig(application.id),
  })
  return (
    <section className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h3 className="font-semibold">{t('jenkins.buildTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('jenkins.buildDescription')}</p>
      </div>
      {query.isPending ? (
        <p role="status">{t('jenkins.loading')}</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{t('jenkins.loadFailed')}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t('jenkins.reload')}
          </Button>
        </div>
      ) : (
        <BuildForm
          key={`${application.id}-${query.data.config?.revision ?? 0}`}
          settings={query.data}
          applicationId={application.id}
          readOnly={!isAdmin || application.status === 'archived'}
        />
      )}
    </section>
  )
}

function BuildForm({
  settings,
  applicationId,
  readOnly,
}: {
  settings: ApplicationBuildSettings
  applicationId: string
  readOnly: boolean
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [config, setConfig] = useState<ApplicationBuildConfig>(
    settings.config ?? {
      enabled: false,
      jobPath: '',
      artifactPattern: 'artifacts/*',
      parameters: [],
      revision: 0,
    },
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const selectedConnectionId = config.connectionId ?? 'default'
  const connectionReady = settings.connections
    ? Boolean(
        settings.connections.find((c) => c.id === selectedConnectionId)?.enabled &&
        (settings.keyReady ?? true),
      )
    : settings.connectionReady
  async function run(save: boolean) {
    setBusy(true)
    setError('')
    setResult('')
    try {
      if (save) {
        const saved = await apiSaveApplicationBuildConfig(applicationId, config)
        toast.success(t('jenkins.saved'))
        client.setQueryData(jenkinsKeys.application(applicationId), {
          ...settings,
          config: saved.config,
        })
      } else {
        const tested = await apiTestApplicationBuildConfig(applicationId, config)
        setResult(
          t('jenkins.jobSuccess', {
            name: tested.fullName,
            parameters: tested.parameters.map((p) => p.name).join(', ') || '—',
          }),
        )
      }
    } catch (caught) {
      setError(
        getJenkinsRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('jenkins.operationFailed'),
        }),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void run(true)
      }}
      onChange={() => {
        setError('')
        setResult('')
      }}
    >
      {readOnly && (
        <p className="text-sm text-muted-foreground">{t('jenkins.readOnly')}</p>
      )}
      {!connectionReady && (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
        >
          {t('jenkins.connectionNeeded')}
        </p>
      )}
      {config.revision > 0 && (
        <p className="text-xs text-muted-foreground">{t('jenkins.configSaved')}</p>
      )}
      <fieldset disabled={readOnly || busy} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="build-connection" className="text-sm font-medium">
            {t('jenkins.connection')}
          </label>
          <select
            id="build-connection"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={selectedConnectionId}
            onChange={(e) => setConfig({ ...config, connectionId: e.target.value })}
          >
            {!settings.connections?.some((c) => c.id === selectedConnectionId) && (
              <option value={selectedConnectionId}>{selectedConnectionId}</option>
            )}
            {settings.connections?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.enabled ? '' : ` (${t('jenkins.connectionDisabled')})`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="build-job" className="text-sm font-medium">
            {t('jenkins.jobPath')}
          </label>
          <Input
            id="build-job"
            required
            maxLength={300}
            value={config.jobPath}
            onChange={(e) => setConfig({ ...config, jobPath: e.target.value })}
            placeholder="henan"
          />
          <p className="text-xs text-muted-foreground">{t('jenkins.jobPathHelp')}</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="build-pattern" className="text-sm font-medium">
            {t('jenkins.artifactPattern')}
          </label>
          <Input
            id="build-pattern"
            required
            maxLength={300}
            value={config.artifactPattern}
            onChange={(e) => setConfig({ ...config, artifactPattern: e.target.value })}
            placeholder="artifacts/*.tar.gz"
          />
          <p className="text-xs text-muted-foreground">{t('jenkins.patternHelp')}</p>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">{t('jenkins.parameters')}</p>
          <p className="text-xs text-muted-foreground">{t('jenkins.parametersHelp')}</p>
          {config.parameters.map((parameter, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1.5fr_auto]"
            >
              <div className="space-y-1">
                <label htmlFor={`build-param-name-${index}`} className="text-xs">
                  {t('jenkins.parameterName')} {index + 1}
                </label>
                <Input
                  id={`build-param-name-${index}`}
                  required
                  maxLength={100}
                  pattern="[A-Za-z_][A-Za-z0-9_]*"
                  value={parameter.name}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      parameters: config.parameters.map((p, i) =>
                        i === index ? { ...p, name: e.target.value } : p,
                      ),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`build-param-value-${index}`} className="text-xs">
                  {t('jenkins.parameterValue')} {index + 1}
                </label>
                <textarea
                  id={`build-param-value-${index}`}
                  rows={2}
                  maxLength={4000}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm disabled:opacity-50"
                  value={parameter.value}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      parameters: config.parameters.map((p, i) =>
                        i === index ? { ...p, value: e.target.value } : p,
                      ),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                className="self-end"
                aria-label={`${t('jenkins.removeParameter')} ${index + 1}`}
                onClick={() =>
                  setConfig({
                    ...config,
                    parameters: config.parameters.filter((_, i) => i !== index),
                  })
                }
              >
                {t('jenkins.remove')}
              </Button>
            </div>
          ))}
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              disabled={config.parameters.length >= 30}
              onClick={() =>
                setConfig({
                  ...config,
                  parameters: [...config.parameters, { name: '', value: '' }],
                })
              }
            >
              {t('jenkins.addParameter')}
            </Button>
          )}
        </div>
        <BuildOutputTargets
          value={config.outputTargets ?? []}
          onChange={(outputTargets) => setConfig({ ...config, outputTargets })}
          readOnly={readOnly}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          {t('jenkins.buildEnabled')}
        </label>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!connectionReady}
              onClick={(e) => {
                if (e.currentTarget.form?.reportValidity()) void run(false)
              }}
            >
              {t('jenkins.testJob')}
            </Button>
            <Button type="submit" disabled={config.enabled && !connectionReady}>
              {t('jenkins.save')}
            </Button>
          </div>
        )}
      </fieldset>
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('jenkins.working')}
        </p>
      )}
      {result && (
        <p role="status" className="text-sm text-emerald-600">
          {result}
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void client.invalidateQueries({
                queryKey: jenkinsKeys.application(applicationId),
              })
            }
          >
            {t('jenkins.reload')}
          </Button>
        </div>
      )}
    </form>
  )
}
