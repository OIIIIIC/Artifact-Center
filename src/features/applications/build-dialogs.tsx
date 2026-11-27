import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { getJenkinsRequestErrorMessage } from '@/lib/jenkins-request-error'
import { createRequestId } from '@/lib/request-id'
import { ApiError } from '@/services/http'
import {
  apiPublishBuild,
  apiStartBuild,
  type BuildFile,
  type BuildPublication,
  type BuildRun,
} from '@/services/api/builds'
import type { ApplicationBuildConfig } from '@/services/api/jenkins'

export function StartBuildDialog({
  appId,
  config,
  hasUnknown,
  onClose,
  onStarted,
}: {
  appId: string
  config: ApplicationBuildConfig
  hasUnknown: boolean
  onClose: () => void
  onStarted: (run: BuildRun) => void
}) {
  const { t } = useTranslation()
  const [parameters, setParameters] = useState(config.parameters)
  const [requestKey, setRequestKey] = useState(createRequestId)
  const [unknown, setUnknown] = useState(hasUnknown)
  const [acknowledge, setAcknowledge] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function updateParameter(index: number, value: string) {
    setParameters((previous) =>
      previous.map((parameter, i) => (i === index ? { ...parameter, value } : parameter)),
    )
    setRequestKey(createRequestId())
  }
  async function submit() {
    setBusy(true)
    setError('')
    try {
      const { build } = await apiStartBuild(appId, {
        requestKey,
        configRevision: config.revision,
        parameters,
        acknowledgeUnknown: acknowledge,
      })
      onStarted(build)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'jenkins_unconfirmed_build')
        setUnknown(true)
      setError(
        getJenkinsRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('builds.startFailed'),
        }),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{t('builds.start')}</ModalTitle>
          <ModalDescription>
            {t('builds.startDescription', { job: config.jobPath })}
          </ModalDescription>
        </ModalHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <ModalBody className="space-y-4">
            <fieldset disabled={busy} className="space-y-4">
              {parameters.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('builds.defaultParameters')}
                </p>
              )}
              {parameters.map((parameter, index) => {
                const choices = config.parameterChoices?.find(
                  (definition) => definition.name === parameter.name,
                )?.choices
                const id = `run-param-${index}`
                const fieldClass =
                  'w-full rounded-md border border-input bg-background p-2 text-sm'
                return (
                  <div key={parameter.name} className="space-y-1">
                    <label htmlFor={id} className="text-sm font-medium">
                      {parameter.name}
                    </label>
                    {choices?.length ? (
                      <select
                        id={id}
                        value={parameter.value}
                        onChange={(e) => updateParameter(index, e.target.value)}
                        className={fieldClass}
                      >
                        {choices.map((choice) => (
                          <option key={choice} value={choice}>
                            {choice}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <textarea
                        id={id}
                        rows={2}
                        maxLength={4000}
                        value={parameter.value}
                        onChange={(e) => updateParameter(index, e.target.value)}
                        className={fieldClass}
                      />
                    )}
                  </div>
                )
              })}
              {unknown && (
                <label className="flex items-start gap-2 rounded-lg border border-amber-300 p-3 text-sm">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={acknowledge}
                    onChange={(e) => setAcknowledge(e.target.checked)}
                  />
                  {t('builds.unknownAcknowledge')}
                </label>
              )}
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy || (unknown && !acknowledge)}>
              {busy ? t('builds.submitting') : t('builds.start')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

export function PublishBuildDialog({
  run,
  file,
  previous,
  onClose,
  onPublished,
}: {
  run: BuildRun
  file: BuildFile
  previous?: BuildPublication
  onClose: () => void
  onPublished: () => void
}) {
  const { t } = useTranslation()
  const [version, setVersion] = useState(previous?.version ?? '')
  const [channel, setChannel] = useState<'beta' | 'stable'>(previous?.channel ?? 'beta')
  const [notes, setNotes] = useState(previous?.releaseNotes ?? '')
  const [confirmStable, setConfirmStable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    setBusy(true)
    setError('')
    try {
      await apiPublishBuild(run.applicationId, run.id, {
        relativePath: file.relativePath,
        version,
        channel,
        releaseNotes: notes,
        confirmStable,
      })
      onPublished()
    } catch (caught) {
      setError(
        getJenkinsRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('builds.publishFailed'),
        }),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{t('builds.publish')}</ModalTitle>
          <ModalDescription>{t('builds.publishDescription')}</ModalDescription>
        </ModalHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <ModalBody className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="break-all font-medium">{file.relativePath}</p>
              {file.targetName && (
                <p>
                  {t('builds.publishTarget')}: {file.targetName}
                </p>
              )}
              <p>
                {run.jobPath} · #{run.buildNumber}
              </p>
              <p className="break-all text-xs text-muted-foreground">
                {run.commits.join(', ') || t('builds.commitUnknown')}
              </p>
            </div>
            <fieldset disabled={busy} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="build-version" className="text-sm font-medium">
                  {t('builds.version')}
                </label>
                <Input
                  id="build-version"
                  required
                  maxLength={64}
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="build-channel" className="text-sm font-medium">
                  {t('builds.channel')}
                </label>
                <select
                  id="build-channel"
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"
                  value={channel}
                  onChange={(e) => {
                    setChannel(e.target.value as 'beta' | 'stable')
                    setConfirmStable(false)
                  }}
                >
                  <option value="beta">{t('builds.beta')}</option>
                  <option value="stable">{t('builds.stable')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="build-notes" className="text-sm font-medium">
                  {t('builds.notes')}
                </label>
                <textarea
                  id="build-notes"
                  rows={4}
                  maxLength={8000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
                />
              </div>
              {channel === 'stable' && (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={confirmStable}
                    onChange={(e) => setConfirmStable(e.target.checked)}
                  />
                  {t('builds.confirmStable')}
                </label>
              )}
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={
                busy || !version.trim() || (channel === 'stable' && !confirmStable)
              }
            >
              {busy ? t('builds.submitting') : t('builds.publish')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
