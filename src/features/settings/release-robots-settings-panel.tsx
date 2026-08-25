import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  Check,
  CircleCheckBig,
  ChevronDown,
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

const MCP_PATH_STORAGE_KEY = 'artifact-center:mcp-path'

function getSavedMcpPath() {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(MCP_PATH_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

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

export function ReleaseRobotsSettingsPanel({ hideHeader = false }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('Codex 发布机器人')
  const [validDays, setValidDays] = useState('90')
  const [creating, setCreating] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [mcpPath, setMcpPath] = useState(getSavedMcpPath)
  const [copied, setCopied] = useState(false)
  const [setupCopied, setSetupCopied] = useState(false)
  const [tokenSaved, setTokenSaved] = useState(false)
  const [discardTokenOpen, setDiscardTokenOpen] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [credentialVerified, setCredentialVerified] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
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
  const historicalRobots = robots.filter(isInactive)
  const apiUrl =
    typeof window === 'undefined'
      ? API_BASE_URL
      : new URL(API_BASE_URL.replace(/^\//, ''), `${window.location.origin}/`).toString()
  const setupCommand =
    createdToken && mcpPath.trim()
      ? [
          `$env:ARTIFACT_CENTER_URL = '${apiUrl.replace(/\/$/, '')}'`,
          `$env:ARTIFACT_CENTER_TOKEN = '${createdToken}'`,
          `$mcpPath = '${escapePowerShellSingleQuotedValue(mcpPath.trim())}'`,
          '',
          'codex mcp add artifact-center `',
          '  --env ARTIFACT_CENTER_URL=$env:ARTIFACT_CENTER_URL `',
          '  --env ARTIFACT_CENTER_TOKEN=$env:ARTIFACT_CENTER_TOKEN `',
          '  -- node "$mcpPath\\src\\index.js"',
        ].join('\n')
      : ''

  const updateMcpPath = (value: string) => {
    setMcpPath(value)
    setSetupCopied(false)
    try {
      window.localStorage.setItem(MCP_PATH_STORAGE_KEY, value)
    } catch {
      // The command can still be generated when browser storage is unavailable.
    }
  }

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

  const renderRobot = (robot: ReleaseRobotDto) => {
    const inactive = isInactive(robot)
    return (
      <li key={robot.id} className="flex min-w-0 items-center gap-3 px-4 py-4 sm:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/45 text-muted-foreground">
          <Bot className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[0.875rem] font-medium">{robot.name}</span>
            {!inactive ? (
              <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[0.6875rem] text-emerald-700 dark:text-emerald-400">
                {t('settings.releaseRobotActiveStatus')}
              </span>
            ) : null}
            {robot.channels.map((channel) => (
              <span
                key={channel}
                className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.6875rem] text-primary"
              >
                {channel === 'beta' ? 'Beta' : t('channel.stable')}
              </span>
            ))}
            {inactive ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
                {t(
                  robot.revokedAt
                    ? 'settings.releaseRobotRevokedStatus'
                    : 'settings.releaseRobotExpiredStatus',
                )}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[0.75rem] text-muted-foreground">
            {t('settings.releaseRobotDates', {
              expires: formatDate(robot.expiresAt, i18n.language),
              used: formatDate(robot.lastUsedAt, i18n.language),
            })}
          </p>
        </div>
        {!inactive ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRevoking(robot)}
            aria-label={t('settings.revokeReleaseRobot', { name: robot.name })}
          >
            <ShieldOff className="size-3.5 text-destructive" />
            <span className="text-destructive">{t('settings.revokeCredential')}</span>
          </Button>
        ) : null}
      </li>
    )
  }

  return (
    <SettingsPanel
      title={t('settings.releaseRobotsTitle')}
      description={t('settings.releaseRobotsDesc')}
      wide
      hideHeader={hideHeader}
    >
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {[
          ['settings.releaseRobotScopeTitle', 'settings.releaseRobotScopeDesc'],
          ['settings.releaseRobotChannelTitle', 'settings.releaseRobotChannelDesc'],
          ['settings.releaseRobotSecretTitle', 'settings.releaseRobotSecretDesc'],
        ].map(([title, description]) => (
          <div
            key={title}
            className="flex items-start gap-2.5 rounded-xl bg-muted/30 p-3 ring-1 ring-border/60"
          >
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-primary"
              strokeWidth={1.8}
            />
            <div>
              <p className="text-[0.8125rem] font-medium">{t(title)}</p>
              <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
                {t(description)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-card/70 ring-1 ring-border/70">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 sm:px-5">
          <p className="text-[0.75rem] text-muted-foreground">
            {t('settings.releaseRobotActiveCount', { count: activeRobots.length })}
          </p>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            {t('settings.addReleaseRobot')}
          </Button>
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
        ) : (
          <>
            {activeRobots.length ? (
              <ul className="divide-y divide-border/60">
                {activeRobots.map(renderRobot)}
              </ul>
            ) : (
              <div className="px-5 py-10 text-center">
                <KeyRound className="mx-auto size-5 text-muted-foreground/60" />
                <p className="mt-3 text-[0.875rem] font-medium">
                  {t('settings.noActiveReleaseRobots')}
                </p>
                <p className="mt-1 text-[0.75rem] text-muted-foreground">
                  {t('settings.noActiveReleaseRobotsHint')}
                </p>
              </div>
            )}
            {historicalRobots.length ? (
              <div className="border-t border-border/60">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-3 text-left text-[0.8125rem] font-medium hover:bg-muted/30"
                  aria-expanded={historyOpen}
                  onClick={() => setHistoryOpen((open) => !open)}
                >
                  {t('settings.releaseRobotHistory', {
                    count: historicalRobots.length,
                  })}
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {historyOpen ? (
                  <ul className="divide-y divide-border/60 border-t border-border/60 bg-muted/10">
                    {historicalRobots.map(renderRobot)}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
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
              />
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
              <div className="mb-3 grid gap-1.5 text-[0.75rem] font-medium">
                <label htmlFor="release-robot-mcp-path">
                  {t('settings.releaseRobotMcpPathLabel')}
                </label>
                <Input
                  id="release-robot-mcp-path"
                  value={mcpPath}
                  onChange={(event) => updateMcpPath(event.target.value)}
                  placeholder={t('settings.releaseRobotMcpPathPlaceholder')}
                  autoComplete="off"
                  aria-describedby="release-robot-mcp-path-hint"
                />
                <span
                  id="release-robot-mcp-path-hint"
                  className="text-[0.6875rem] font-normal text-muted-foreground"
                >
                  {t('settings.releaseRobotMcpPathHint')}
                </span>
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-[0.6875rem] leading-relaxed ring-1 ring-border/70">
                {setupCommand || t('settings.releaseRobotSetupAwaitingPath')}
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
