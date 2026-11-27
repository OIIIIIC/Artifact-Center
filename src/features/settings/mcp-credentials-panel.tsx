import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { copyText } from '@/lib/clipboard'
import { request, API_BASE_URL } from '@/services/http'
import { SettingsPanel } from './settings-panel'

type Credential = {
  id: string
  name: string
  expiresAt: string
  revokedAt: string | null
}
const key = ['personal-mcp-credentials']
export function McpCredentialsPanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState('Codex')
  const [days, setDays] = useState('90')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const credentials = useQuery({
    queryKey: key,
    queryFn: () => request<{ items: Credential[] }>('/account/mcp-credentials'),
  })
  const apiUrl = new URL(API_BASE_URL, window.location.origin)
    .toString()
    .replace(/\/$/, '')
  const clientUrl = new URL(
    '/downloads/artifact-center-mcp.mjs',
    window.location.origin,
  ).toString()
  const quote = (value: string) => `'${value.replace(/'/g, "''")}'`
  const setup = token
    ? [
        `$mcpDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Artifact Center\\MCP'`,
        'New-Item -ItemType Directory -Force -Path $mcpDir | Out-Null',
        "$mcpFile = Join-Path $mcpDir 'artifact-center-mcp.mjs'",
        `Invoke-WebRequest -UseBasicParsing -Uri ${quote(clientUrl)} -OutFile $mcpFile`,
        `$expected = (Invoke-WebRequest -UseBasicParsing -Uri ${quote(clientUrl.replace(/\.mjs$/, '.sha256'))}).Content.Trim()`,
        '$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $mcpFile).Hash.ToLowerInvariant()',
        "if ($actual -ne $expected) { throw 'Artifact Center MCP integrity check failed' }",
        `codex mcp add artifact-center --env ARTIFACT_CENTER_URL=${quote(apiUrl)} --env ARTIFACT_CENTER_TOKEN=${quote(token)} -- node "$mcpFile"`,
      ].join('\n')
    : ''
  const create = async () => {
    setBusy(true)
    try {
      const result = await request<{ token: string }>('/account/mcp-credentials', {
        method: 'POST',
        body: { name, validDays: Number(days) },
      })
      setToken(result.token)
      await queryClient.invalidateQueries({ queryKey: key })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('mcp.failed'))
    } finally {
      setBusy(false)
    }
  }
  const revoke = async (id: string) => {
    setBusy(true)
    try {
      await request(`/account/mcp-credentials/${id}`, { method: 'DELETE' })
      await queryClient.invalidateQueries({ queryKey: key })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('mcp.failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <SettingsPanel title={t('mcp.title')} description={t('mcp.description')}>
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">{t('mcp.security')}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-2 text-sm">
            {t('mcp.name')}
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </label>
          <label className="space-y-2 text-sm">
            {t('mcp.days')}
            <Input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </label>
          <Button
            disabled={
              busy ||
              Boolean(token) ||
              !name.trim() ||
              !Number.isInteger(Number(days)) ||
              Number(days) < 1 ||
              Number(days) > 365
            }
            onClick={() => void create()}
          >
            {t('mcp.create')}
          </Button>
        </div>
        {token ? (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm">{t('mcp.once')}</p>
            <pre
              className="overflow-x-auto whitespace-pre text-xs"
              aria-label={t('mcp.setup')}
            >
              {setup}
            </pre>
            <Button
              onClick={() =>
                void copyText(setup).then((ok) => {
                  if (ok) toast.success(t('mcp.copied'))
                })
              }
            >
              {t('mcp.copy')}
            </Button>
            <Button variant="outline" onClick={() => setToken('')}>
              {t('mcp.saved')}
            </Button>
          </div>
        ) : null}
        {credentials.isLoading ? <p>{t('mcp.loading')}</p> : null}
        {credentials.isError ? <p role="alert">{t('mcp.failed')}</p> : null}
        {credentials.data?.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('mcp.empty')}</p>
        ) : null}
        {credentials.data?.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 border-b py-3 text-sm"
          >
            <div>
              <p>{item.name}</p>
              <p className="text-muted-foreground">
                {t('mcp.expires')}: {new Date(item.expiresAt).toLocaleString()}
              </p>
            </div>
            {item.revokedAt ? (
              <span>{t('mcp.revoked')}</span>
            ) : new Date(item.expiresAt) <= new Date() ? (
              <span>{t('mcp.expired')}</span>
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void revoke(item.id)}
              >
                {t('mcp.revoke')}
              </Button>
            )}
          </div>
        ))}
      </div>
    </SettingsPanel>
  )
}
