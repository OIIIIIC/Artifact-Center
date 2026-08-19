import { useQueryClient } from '@tanstack/react-query'
import { Braces, Loader2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { FormError } from '@/components/feedback'
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
import { isApplicationCode, sanitizeApplicationCodeInput } from '@/lib/application-code'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { apiBulkUpdateApplicationCodes } from '@/services/api'
import type { Application } from '@/types/application'

interface BulkApplicationCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applications: Application[]
}

export function BulkApplicationCodeDialog({
  open,
  onOpenChange,
  applications,
}: BulkApplicationCodeDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      applications.map((application) => [application.id, application.applicationCode]),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orderedApplications = useMemo(
    () =>
      [...applications].sort(
        (left, right) =>
          left.region.name.localeCompare(right.region.name) ||
          left.name.localeCompare(right.name),
      ),
    [applications],
  )
  const normalizedQuery = query.trim().toLowerCase()
  const visibleApplications = normalizedQuery
    ? orderedApplications.filter((application) =>
        [
          application.name,
          application.region.name,
          application.packageName,
          values[application.id] ?? '',
        ].some((value) => value.toLowerCase().includes(normalizedQuery)),
      )
    : orderedApplications

  const updates = orderedApplications.flatMap((application) => {
    const applicationCode = (values[application.id] ?? '').trim()
    return applicationCode !== application.applicationCode
      ? [{ id: application.id, applicationCode }]
      : []
  })
  const invalidIds = new Set(
    orderedApplications
      .filter((application) => !isApplicationCode((values[application.id] ?? '').trim()))
      .map((application) => application.id),
  )

  const changeCode = (applicationId: string, value: string) => {
    setValues((current) => ({
      ...current,
      [applicationId]: sanitizeApplicationCodeInput(value),
    }))
    setError(null)
  }

  const save = async () => {
    if (updates.length === 0 || invalidIds.size > 0) return
    setSaving(true)
    setError(null)
    try {
      const updated = await apiBulkUpdateApplicationCodes(updates)
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      toast.success(t('applications.bulkCodeSaved', { count: updated }))
      onOpenChange(false)
    } catch (caught) {
      setError(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('applications.bulkCodeSaveFailed'),
        }),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <ModalContent className="w-[min(52rem,calc(100vw-2rem))]">
        <ModalHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
              <Braces className="size-4" strokeWidth={1.75} />
            </span>
            <div>
              <ModalTitle>{t('applications.bulkCodeTitle')}</ModalTitle>
              <ModalDescription>{t('applications.bulkCodeDescription')}</ModalDescription>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="space-y-4">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('applications.bulkCodeSearch')}
              aria-label={t('applications.bulkCodeSearch')}
              className="pl-9"
            />
          </label>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {t('applications.bulkCodeVisibleCount', {
                visible: visibleApplications.length,
                total: applications.length,
              })}
            </span>
            <span>
              {t('applications.bulkCodeChangedCount', { count: updates.length })}
            </span>
          </div>

          <div className="max-h-[28rem] divide-y divide-border/60 overflow-y-auto rounded-xl ring-1 ring-border/70">
            {visibleApplications.map((application) => {
              const invalid = invalidIds.has(application.id)
              return (
                <div
                  key={application.id}
                  className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={application.name}>
                      {application.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {application.region.name} · {application.packageName}
                    </p>
                  </div>
                  <div>
                    <Input
                      value={values[application.id] ?? ''}
                      maxLength={48}
                      aria-invalid={invalid || undefined}
                      aria-label={t('applications.bulkCodeInputLabel', {
                        name: application.name,
                      })}
                      className="font-mono"
                      onChange={(event) => changeCode(application.id, event.target.value)}
                    />
                    {invalid ? (
                      <p className="mt-1 text-[0.6875rem] text-destructive">
                        {t('appSettings.applicationCodeInvalid')}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('applications.bulkCodeHint')}
          </p>
          {error ? <FormError message={error} /> : null}
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={saving || updates.length === 0 || invalidIds.size > 0}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {saving
              ? t('applications.bulkCodeSaving')
              : t('applications.bulkCodeSave', { count: updates.length })}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
