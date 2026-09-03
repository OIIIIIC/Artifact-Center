import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  Check,
  CircleCheckBig,
  ClipboardList,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  ShieldOff,
  Terminal,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { copyText } from '@/lib/clipboard'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { API_BASE_URL } from '@/services/http'
import {
  apiCreateReleaseRobot,
  apiListReleaseRobots,
  apiRevokeReleaseRobot,
  type ReleaseRobotDto,
} from '@/services/api'
import { SettingsPanel } from './settings-panel'

function escapePowerShellSingleQuotedValue(value: string) {
  return value.replace(/'/g, "''")
}

function formatDate(value: string | null, language: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(language === 'en-US' ? 'en-US' : 'zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function ReleaseRobotsSettingsPanel({
  hideHeader = false,
  onViewAudit,
}: {
  hideHeader?: boolean
  onViewAudit?: () => void
}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [validDays, setValidDays] = useState('90')
  const [creating, setCreating] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [setupCopied, setSetupCopied] = useState(false)
  const [tokenSaved, setTokenSaved] = useState(false)
  const [discardTokenOpen, setDiscardTokenOpen] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [credentialVerified, setCredentialVerified] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<ReleaseRobotDto | null>(null)

  const robotsQuery = useQuery({
    queryKey: queryKeys.releaseRobots.all,
    queryFn: apiListReleaseRobots,
  })

  const create = async () => {
    const days = Number(validDays)
    if (!name.trim() || !Number.isInteger(days) || days < 1 || days > 3650) {
      setFormError(t('settings.releaseRobotInvalid'))
      return
    }
    setCreating(true)
    setFormError(null)
    try {
      const result = await apiCreateReleaseRobot({
        name: name.trim(),
        expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
      })
      setCreatedToken(result.token)
      setCopied(false)
      setSetupCopied(false)
      setTokenSaved(false)
      setDiscardTokenOpen(false)
      setCredentialVerified(false)
      setCreateOpen(false)
      setName('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.releaseRobots.all })
      toast.success(t('settings.releaseRobotCreated'))
    } catch (caught) {
      setFormError(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('settings.releaseRobotCreateFailed'),
        }),
      )
    } finally {
      setCreating(false)
    }
  }

  const revoke = async () => {
    if (!revoking) return
    try {
      await apiRevokeReleaseRobot(revoking.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.releaseRobots.all })
      toast.success(t('settings.releaseRobotRevoked'))
      setRevoking(null)
    } catch (caught) {
      toast.error(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('settings.releaseRobotRevokeFailed'),
        }),
      )
    }
  }

  const copyToken = async () => {
    if (!createdToken) return
    const ok = await copyText(createdToken)
    setCopied(ok)
    toast[ok ? 'success' : 'error'](
      t(ok ? 'settings.releaseRobotTokenCopied' : 'settings.releaseRobotTokenCopyFailed'),
    )
  }

  const robots = robotsQuery.data ?? []
  const isInactive = (robot: ReleaseRobotDto) =>
    Boolean(robot.revokedAt) ||
    Boolean(robot.expiresAt && new Date(robot.expiresAt) <= new Date())
  const activeRobots = robots.filter((robot) => !isInactive(robot))
  const apiUrl =
    typeof window === 'undefined'
      ? API_BASE_URL
      : new URL(API_BASE_URL.replace(/^\//, ''), `${window.location.origin}/`).toString()
  const mcpClientUrl =
    typeof window === 'undefined'
      ? '/downloads/artifact-center-mcp.mjs'
      : new URL('/downloads/artifact-center-mcp.mjs', window.location.origin).toString()
  const mcpChecksumUrl = mcpClientUrl.replace(/\.mjs$/, '.sha256')
  const setupCommand = createdToken
    ? [
        `$artifactCenterUrl = '${escapePowerShellSingleQuotedValue(apiUrl.replace(/\/$/, ''))}'`,
        `$artifactCenterToken = '${escapePowerShellSingleQuotedValue(createdToken)}'`,
        `$mcpClientUrl = '${escapePowerShellSingleQuotedValue(mcpClientUrl)}'`,
        `$mcpChecksumUrl = '${escapePowerShellSingleQuotedValue(mcpChecksumUrl)}'`,
        `$mcpInstallDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Artifact Center\\MCP'`,
        `$mcpClientPath = Join-Path $mcpInstallDir 'artifact-center-mcp.mjs'`,
        `$mcpChecksumPath = Join-Path $mcpInstallDir 'artifact-center-mcp.sha256'`,
        '',
        'New-Item -ItemType Directory -Force -Path $mcpInstallDir | Out-Null',
        'Invoke-WebRequest -UseBasicParsing -Uri $mcpClientUrl -OutFile $mcpClientPath',
        'Invoke-WebRequest -UseBasicParsing -Uri $mcpChecksumUrl -OutFile $mcpChecksumPath',
        '$expectedHash = (Get-Content -Raw -LiteralPath $mcpChecksumPath).Trim()',
        '$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $mcpClientPath).Hash.ToLowerInvariant()',
        "if ($actualHash -ne $expectedHash) { throw 'Artifact Center MCP integrity check failed.' }",
        '',
        'codex mcp add artifact-center `',
        '  --env ARTIFACT_CENTER_URL=$artifactCenterUrl `',
        '  --env ARTIFACT_CENTER_TOKEN=$artifactCenterToken `',
        '  -- node "$mcpClientPath"',
      ].join('\n')
    : ''

  const copySetupCommand = async () => {
    if (!setupCommand) return
    const ok = await copyText(setupCommand)
    setSetupCopied(ok)
    toast[ok ? 'success' : 'error'](
      t(ok ? 'settings.releaseRobotSetupCopied' : 'settings.releaseRobotTokenCopyFailed'),
    )
  }

  const verifyCreatedCredential = async () => {
    if (!createdToken) return
    setVerifying(true)
    try {
      const response = await fetch(`${API_BASE_URL}/release/applications`, {
        headers: { Authorization: `Bearer ${createdToken}` },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setCredentialVerified(true)
      toast.success(t('settings.releaseRobotVerifySucceeded'))
    } catch {
      setCredentialVerified(false)
      toast.error(t('settings.releaseRobotVerifyFailed'))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <SettingsPanel
      title={t('settings.releaseRobotsTitle')}
      description={t('settings.releaseRobotsDesc')}
      wide
      hideHeader={hideHeader}
    >
      <div className="overflow-hidden rounded-2xl bg-card/80 ring-1 ring-border/70 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
                {t('settings.releaseRobotListTitle')}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-emerald-700 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {t('settings.releaseRobotActiveCount', { count: activeRobots.length })}
              </span>
            </div>
            <p className="mt-1 text-[0.75rem] text-muted-foreground">
              {t('settings.releaseRobotListDesc')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onViewAudit ? (
              <Button type="button" size="sm" variant="outline" onClick={onViewAudit}>
                <ClipboardList className="size-3.5" />
                {t('settings.releaseRobotViewAudit')}
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              {t('settings.addReleaseRobot')}
            </Button>
          </div>
        </div>

        {robotsQuery.isLoading ? (
          <div className="flex min-h-36 items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : robotsQuery.isError ? (
          <p className="px-5 py-10 text-center text-[0.8125rem] text-destructive">
            {t('settings.releaseRobotsLoadFailed')}
          </p>
        ) : robots.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Bot className="mx-auto size-5 text-muted-foreground/60" />
            <p className="mt-3 text-[0.875rem] font-medium">
              {t('settings.noReleaseRobots')}
            </p>
            <p className="mt-1 text-[0.75rem] text-muted-foreground">
              {t('settings.noReleaseRobotsHint')}
            </p>
          </div>
        ) : activeRobots.length ? (
          <Table className="min-w-[38rem] table-fixed">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[23%]" />
              <col className="w-[17%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
            </colgroup>
            <TableHeader className="bg-muted/35 text-[0.6875rem] text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-5 font-medium sm:px-6">
                  {t('settings.releaseRobotColumnName')}
                </TableHead>
                <TableHead className="h-11 px-3 font-medium">
                  {t('settings.releaseRobotColumnAccess')}
                </TableHead>
                <TableHead className="h-11 px-3 font-medium">
                  {t('settings.releaseRobotColumnLastUsed')}
                </TableHead>
                <TableHead className="h-11 px-3 font-medium">
                  {t('settings.releaseRobotColumnExpires')}
                </TableHead>
                <TableHead className="h-11 px-4 text-right font-medium">
                  {t('settings.releaseRobotColumnActions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeRobots.map((robot) => (
                <TableRow key={robot.id} className="h-[4.75rem] hover:bg-muted/20">
                  <TableCell className="px-5 py-3 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary ring-1 ring-primary/10">
                        <Bot className="size-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[0.8125rem] font-medium text-foreground">
                          {robot.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-emerald-700 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          {t('settings.releaseRobotActiveStatus')}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <p className="text-[0.8125rem] font-medium text-foreground">
                      {t('settings.releaseRobotAllApplications')}
                    </p>
                    <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                      {t('settings.releaseRobotAllowedChannels')}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-normal px-3 py-3 text-[0.75rem] leading-5 text-muted-foreground">
                    {robot.lastUsedAt
                      ? formatDate(robot.lastUsedAt, i18n.language)
                      : t('settings.releaseRobotNeverUsed')}
                  </TableCell>
                  <TableCell className="whitespace-normal px-3 py-3 text-[0.75rem] leading-5 text-muted-foreground">
                    {formatDate(robot.expiresAt, i18n.language)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevoking(robot)}
                      aria-label={t('settings.revokeReleaseRobot', { name: robot.name })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <ShieldOff className="size-3.5" />
                      <span className="hidden 2xl:inline">
                        {t('settings.revokeCredential')}
                      </span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-5 py-12 text-center">
            <KeyRound className="mx-auto size-5 text-muted-foreground/60" />
            <p className="mt-3 text-[0.875rem] font-medium">
              {t('settings.noActiveReleaseRobots')}
            </p>
            <p className="mt-1 text-[0.75rem] text-muted-foreground">
              {t('settings.noActiveReleaseRobotsHint')}
            </p>
          </div>
        )}
      </div>

      <Modal open={createOpen} onOpenChange={setCreateOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t('settings.addReleaseRobotTitle')}</ModalTitle>
            <ModalDescription>{t('settings.addReleaseRobotDesc')}</ModalDescription>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <label className="grid gap-1.5 text-[0.8125rem] font-medium">
              {t('settings.releaseRobotName')}
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder={t('settings.releaseRobotNamePlaceholder')}
              />
              <span className="text-[0.6875rem] font-normal text-muted-foreground">
                {t('settings.releaseRobotNameHint')}
              </span>
            </label>
            <label className="grid gap-1.5 text-[0.8125rem] font-medium">
              {t('settings.releaseRobotValidDays')}
              <Input
                type="number"
                min={1}
                max={3650}
                value={validDays}
                onChange={(event) => setValidDays(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[30, 90, 180, 365].map((days) => (
                <Button
                  key={days}
                  type="button"
                  size="xs"
                  variant={validDays === String(days) ? 'secondary' : 'outline'}
                  onClick={() => setValidDays(String(days))}
                >
                  {t('settings.releaseRobotDaysPreset', { count: days })}
                </Button>
              ))}
            </div>
            {formError ? (
              <p className="text-[0.75rem] text-destructive">{formError}</p>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void create()} disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : null}
              {t(
                creating
                  ? 'settings.creatingReleaseRobot'
                  : 'settings.createReleaseRobot',
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        open={Boolean(createdToken)}
        onOpenChange={(open) => {
          if (open) return
          if (tokenSaved) {
            setCreatedToken(null)
            return
          }
          setDiscardTokenOpen(true)
        }}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t('settings.releaseRobotTokenTitle')}</ModalTitle>
            <ModalDescription>{t('settings.releaseRobotTokenDesc')}</ModalDescription>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <p className="mb-1.5 text-[0.75rem] font-medium">
                {t('settings.releaseRobotTokenLabel')}
              </p>
              <div className="rounded-lg bg-muted/50 p-3 font-mono text-[0.75rem] break-all ring-1 ring-border/70">
                {createdToken}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-medium">
                <Terminal className="size-3.5" />
                {t('settings.releaseRobotSetupTitle')}
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-[0.6875rem] leading-relaxed ring-1 ring-border/70">
                {setupCommand}
              </pre>
              <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
                {t('settings.releaseRobotSetupHint')}
              </p>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-border/70 p-3 text-[0.75rem]">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={tokenSaved}
                onChange={(event) => setTokenSaved(event.target.checked)}
              />
              <span>{t('settings.releaseRobotSavedConfirmation')}</span>
            </label>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => void copyToken()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {t(
                copied
                  ? 'settings.releaseRobotTokenCopied'
                  : 'settings.copyReleaseRobotToken',
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!setupCommand}
              onClick={() => void copySetupCommand()}
            >
              {setupCopied ? (
                <Check className="size-4" />
              ) : (
                <Terminal className="size-4" />
              )}
              {t(
                setupCopied
                  ? 'settings.releaseRobotSetupCopied'
                  : 'settings.copyReleaseRobotSetup',
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={verifying}
              onClick={() => void verifyCreatedCredential()}
            >
              {verifying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : credentialVerified ? (
                <CircleCheckBig className="size-4 text-emerald-600" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {t(
                credentialVerified
                  ? 'settings.releaseRobotVerified'
                  : 'settings.verifyReleaseRobot',
              )}
            </Button>
            <Button
              type="button"
              disabled={!tokenSaved}
              onClick={() => setCreatedToken(null)}
            >
              {t('common.done')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={discardTokenOpen} onOpenChange={setDiscardTokenOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t('settings.releaseRobotDiscardTokenTitle')}</ModalTitle>
            <ModalDescription>
              {t('settings.releaseRobotDiscardTokenDesc')}
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardTokenOpen(false)}
            >
              {t('settings.continueSavingReleaseRobotToken')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDiscardTokenOpen(false)
                setCreatedToken(null)
              }}
            >
              {t('settings.discardReleaseRobotToken')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={Boolean(revoking)} onOpenChange={(open) => !open && setRevoking(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t('settings.revokeReleaseRobotTitle')}</ModalTitle>
            <ModalDescription>
              {t('settings.revokeReleaseRobotDesc', { name: revoking?.name })}
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setRevoking(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void revoke()}>
              {t('settings.confirmRevokeReleaseRobot')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </SettingsPanel>
  )
}
