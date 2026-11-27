import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getJenkinsRequestErrorMessage } from '@/lib/jenkins-request-error'
import {
  apiGetJenkinsSettings,
  apiSaveJenkinsSettings,
  apiTestJenkinsSettings,
  jenkinsKeys,
  type JenkinsSettings,
} from '@/services/api/jenkins'
import { SettingsPanel } from './settings-panel'

export function JenkinsSettingsPanel() {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState('default')
  const query = useQuery({
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: jenkinsKeys.connection,
    queryFn: apiGetJenkinsSettings,
  })
  return (
    <SettingsPanel title={t('jenkins.title')} description={t('jenkins.description')}>
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
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1 space-y-1.5">
              <label htmlFor="jenkins-connection" className="text-sm font-medium">
                {t('jenkins.connection')}
              </label>
              <select
                id="jenkins-connection"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {(
                  query.data.connections ??
                  (query.data.connection ? [query.data.connection] : [])
                ).map((c) => (
                  <option key={c.id ?? 'default'} value={c.id ?? 'default'}>
                    {c.name ?? c.baseUrl} · {c.baseUrl}
                  </option>
                ))}
                {!(
                  query.data.connections ??
                  (query.data.connection ? [query.data.connection] : [])
                ).some((c) => (c.id ?? 'default') === selectedId) && (
                  <option value={selectedId}>{t('jenkins.newConnection')}</option>
                )}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSelectedId(
                  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
                    b.toString(16).padStart(2, '0'),
                  ).join(''),
                )
              }
            >
              {t('jenkins.addConnection')}
            </Button>
          </div>
          <ConnectionForm
            key={`${selectedId}-${(query.data.connections ?? (query.data.connection ? [query.data.connection] : [])).find((c) => (c.id ?? 'default') === selectedId)?.revision ?? 0}`}
            connectionId={selectedId}
            settings={{
              ...query.data,
              connection:
                (
                  query.data.connections ??
                  (query.data.connection ? [query.data.connection] : [])
                ).find((c) => (c.id ?? 'default') === selectedId) ?? null,
            }}
          />
        </div>
      )}
    </SettingsPanel>
  )
}

function ConnectionForm({
  settings,
  connectionId,
}: {
  settings: JenkinsSettings
  connectionId: string
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const connection = settings.connection
  const [name, setName] = useState(connection?.name ?? 'Jenkins')
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? '')
  const [username, setUsername] = useState(connection?.username ?? '')
  const [token, setToken] = useState('')
  const [enabled, setEnabled] = useState(connection?.enabled ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const tokenRequired =
    !connection?.hasToken ||
    baseUrl.trim().replace(/\/+$/, '') !== connection.baseUrl ||
    username.trim() !== connection.username

  async function run(save: boolean) {
    setBusy(true)
    setError('')
    setResult('')
    const input = {
      id: connectionId,
      name,
      baseUrl,
      username,
      enabled,
      revision: connection?.revision ?? 0,
      ...(token.trim() ? { token: token.trim() } : {}),
    }
    try {
      if (save) {
        const saved = await apiSaveJenkinsSettings(input)
        toast.success(t('jenkins.saved'))
        client.setQueryData<JenkinsSettings>(jenkinsKeys.connection, (current) => ({
          ...saved,
          connection:
            connectionId === 'default' ? saved.connection : (current?.connection ?? null),
          connections: [
            ...(
              current?.connections ?? (current?.connection ? [current.connection] : [])
            ).filter((c) => (c.id ?? 'default') !== connectionId),
            ...(saved.connection ? [{ ...saved.connection, id: connectionId }] : []),
          ],
        }))
        await client.invalidateQueries({ queryKey: jenkinsKeys.applications })
      } else {
        const tested = await apiTestJenkinsSettings(input)
        setResult(t('jenkins.connectionSuccess', { version: tested.version }))
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
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        void run(true)
      }}
      onChange={() => {
        setResult('')
        setError('')
      }}
    >
      {!settings.keyReady && (
        <p
          role="alert"
          className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
        >
          {t('jenkins.keyMissing')}
        </p>
      )}
      {connection && (
        <p className="text-xs text-muted-foreground">
          {t('jenkins.savedAt', {
            time: new Date(connection.updatedAt).toLocaleString(),
          })}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="jenkins-name" className="text-sm font-medium">
            {t('jenkins.connectionName')}
          </label>
          <Input
            id="jenkins-name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="jenkins-url" className="text-sm font-medium">
            {t('jenkins.url')}
          </label>
          <Input
            id="jenkins-url"
            type="url"
            required
            maxLength={500}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://jenkins:8080"
          />
          <p className="text-xs text-muted-foreground">{t('jenkins.urlHelp')}</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="jenkins-username" className="text-sm font-medium">
            {t('jenkins.username')}
          </label>
          <Input
            id="jenkins-username"
            required
            maxLength={120}
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="jenkins-token" className="text-sm font-medium">
            API Token
          </label>
          <Input
            id="jenkins-token"
            type="password"
            required={tokenRequired}
            maxLength={1024}
            autoComplete="new-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={connection?.hasToken ? t('jenkins.tokenSaved') : ''}
          />
          <p className="text-xs text-muted-foreground">{t('jenkins.tokenHelp')}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {t('jenkins.enabled')}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              if (e.currentTarget.form?.reportValidity()) void run(false)
            }}
          >
            {t('jenkins.testConnection')}
          </Button>
          <Button type="submit" disabled={!settings.keyReady}>
            {t('jenkins.save')}
          </Button>
        </div>
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
              void client.invalidateQueries({ queryKey: jenkinsKeys.connection })
            }
          >
            {t('jenkins.reload')}
          </Button>
        </div>
      )}
    </form>
  )
}
