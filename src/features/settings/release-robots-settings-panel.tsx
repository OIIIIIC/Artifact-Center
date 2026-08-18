import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Check, Copy, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react'
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
import {
  apiCreateReleaseRobot,
  apiListReleaseRobots,
  apiRevokeReleaseRobot,
  type ReleaseRobotDto,
} from '@/services/api'
import { SettingsPanel } from './settings-panel'

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
  const [copied, setCopied] = useState(false)
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

  return (
    <SettingsPanel
      title={t('settings.releaseRobotsTitle')}
      description={t('settings.releaseRobotsDesc')}
      wide
      hideHeader={hideHeader}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ['settings.releaseRobotScopeTitle', 'settings.releaseRobotScopeDesc'],
          ['settings.releaseRobotChannelTitle', 'settings.releaseRobotChannelDesc'],
          ['settings.releaseRobotSecretTitle', 'settings.releaseRobotSecretDesc'],
        ].map(([title, description]) => (
          <div key={title} className="rounded-xl bg-muted/35 p-4 ring-1 ring-border/60">
            <ShieldCheck className="mb-3 size-4 text-primary" strokeWidth={1.8} />
            <p className="text-[0.8125rem] font-medium">{t(title)}</p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-muted-foreground">
              {t(description)}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-card/70 ring-1 ring-border/70">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 sm:px-5">
          <p className="text-[0.75rem] text-muted-foreground">
            {t('settings.releaseRobotCount', { count: robots.length })}
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
          <ul className="divide-y divide-border/60">
            {robots.map((robot) => {
              const inactive =
                Boolean(robot.revokedAt) ||
                Boolean(robot.expiresAt && new Date(robot.expiresAt) <= new Date())
              return (
                <li
                  key={robot.id}
                  className="flex min-w-0 items-center gap-3 px-4 py-4 sm:px-5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/45 text-muted-foreground">
                    <Bot className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[0.875rem] font-medium">
                        {robot.name}
                      </span>
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
                      variant="ghost"
                      size="icon"
                      onClick={() => setRevoking(robot)}
                      aria-label={t('settings.revokeReleaseRobot', { name: robot.name })}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
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
        onOpenChange={(open) => !open && setCreatedToken(null)}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t('settings.releaseRobotTokenTitle')}</ModalTitle>
            <ModalDescription>{t('settings.releaseRobotTokenDesc')}</ModalDescription>
          </ModalHeader>
          <ModalBody>
            <div className="rounded-lg bg-muted/50 p-3 font-mono text-[0.75rem] break-all ring-1 ring-border/70">
              {createdToken}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" onClick={() => void copyToken()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {t(
                copied
                  ? 'settings.releaseRobotTokenCopied'
                  : 'settings.copyReleaseRobotToken',
              )}
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
