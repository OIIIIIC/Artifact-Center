import { Copy, Download, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { apiGenerateDiagnosticReport, type DiagnosticReportDto } from '@/services/api'

import { SettingsPanel } from './settings-panel'

const FIELD_CLASS = cn(
  'w-full rounded-lg border border-border/60 bg-muted/30 px-3 text-[0.875rem] outline-none',
  'transition-[box-shadow,background-color,border-color] duration-[var(--duration-hover)]',
  'placeholder:text-muted-foreground/60',
  'focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/30',
)

const TEXTAREA_CLASS = cn(FIELD_CLASS, 'min-h-24 resize-y py-2.5 leading-relaxed')

export function DiagnosticsSettingsPanel() {
  const { t } = useTranslation()
  const [sinceMinutes, setSinceMinutes] = useState<15 | 30 | 60>(30)
  const [requestId, setRequestId] = useState('')
  const [operation, setOperation] = useState('')
  const [expected, setExpected] = useState('')
  const [actual, setActual] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState<DiagnosticReportDto | null>(null)

  const generate = async () => {
    setGenerating(true)
    try {
      const nextReport = await apiGenerateDiagnosticReport({
        sinceMinutes,
        ...(requestId.trim() ? { requestId: requestId.trim() } : {}),
        ...(operation.trim() ? { operation: operation.trim() } : {}),
        ...(expected.trim() ? { expected: expected.trim() } : {}),
        ...(actual.trim() ? { actual: actual.trim() } : {}),
        ...(occurredAt.trim() ? { occurredAt: occurredAt.trim() } : {}),
        client: {
          page: window.location.pathname,
          browser: navigator.userAgent,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      })
      setReport(nextReport)
      toast.success(t('settings.diagnosticsGenerated'), {
        description: t('settings.diagnosticsGeneratedDesc', {
          count: nextReport.eventCount,
        }),
      })
    } catch (error) {
      toast.error(
        getRequestErrorMessage(error, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('settings.diagnosticsGenerateFailed'),
        }),
      )
    } finally {
      setGenerating(false)
    }
  }

  const copyReport = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report.markdown)
      toast.success(t('settings.diagnosticsCopied'))
    } catch {
      toast.error(t('settings.diagnosticsCopyFailed'))
    }
  }

  const downloadReport = () => {
    if (!report) return
    const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `artifact-center-diagnostics-${report.generatedAt.replace(/[:.]/g, '-')}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <SettingsPanel
      title={t('settings.diagnosticsTitle')}
      description={t('settings.diagnosticsDesc')}
      wide
    >
      <div className="grid gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-foreground/75"
              strokeWidth={1.8}
            />
            <div>
              <p className="text-[0.8125rem] font-medium text-foreground">
                {t('settings.diagnosticsPrivacyTitle')}
              </p>
              <p className="mt-1 text-[0.75rem] leading-relaxed text-muted-foreground">
                {t('settings.diagnosticsPrivacyDesc')}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('settings.diagnosticsTimeRange')}
              </span>
              <select
                value={sinceMinutes}
                onChange={(event) =>
                  setSinceMinutes(Number(event.target.value) as 15 | 30 | 60)
                }
                className={cn(FIELD_CLASS, 'h-10')}
              >
                <option value={15}>
                  {t('settings.diagnosticsMinutes', { count: 15 })}
                </option>
                <option value={30}>
                  {t('settings.diagnosticsMinutes', { count: 30 })}
                </option>
                <option value={60}>
                  {t('settings.diagnosticsMinutes', { count: 60 })}
                </option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('settings.diagnosticsOccurredAt')}
              </span>
              <Input
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                placeholder={t('settings.diagnosticsOccurredAtPlaceholder')}
                className={cn(FIELD_CLASS, 'h-10')}
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[0.8125rem] font-medium text-foreground">
              {t('settings.diagnosticsRequestId')}
            </span>
            <Input
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
              placeholder={t('settings.diagnosticsRequestIdPlaceholder')}
              className={cn(FIELD_CLASS, 'h-10 font-mono text-[0.8125rem]')}
            />
            <span className="block text-[0.75rem] text-muted-foreground">
              {t('settings.diagnosticsRequestIdHint')}
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-[0.8125rem] font-medium text-foreground">
              {t('settings.diagnosticsOperation')}
            </span>
            <Input
              value={operation}
              onChange={(event) => setOperation(event.target.value)}
              placeholder={t('settings.diagnosticsOperationPlaceholder')}
              className={cn(FIELD_CLASS, 'h-10')}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('settings.diagnosticsExpected')}
              </span>
              <textarea
                value={expected}
                onChange={(event) => setExpected(event.target.value)}
                placeholder={t('settings.diagnosticsExpectedPlaceholder')}
                className={TEXTAREA_CLASS}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('settings.diagnosticsActual')}
              </span>
              <textarea
                value={actual}
                onChange={(event) => setActual(event.target.value)}
                placeholder={t('settings.diagnosticsActualPlaceholder')}
                className={TEXTAREA_CLASS}
              />
            </label>
          </div>

          <Button
            type="button"
            size="lg"
            disabled={generating}
            onClick={() => void generate()}
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generating
              ? t('settings.diagnosticsGenerating')
              : t('settings.diagnosticsGenerate')}
          </Button>
        </div>

        <div className="min-w-0 rounded-2xl border border-border/70 bg-card/60 p-5 dark:bg-card/40 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[0.875rem] font-semibold text-foreground">
                {t('settings.diagnosticsPreview')}
              </h3>
              <p className="mt-1 text-[0.75rem] text-muted-foreground">
                {report
                  ? t('settings.diagnosticsPreviewReady', { count: report.eventCount })
                  : t('settings.diagnosticsPreviewEmpty')}
              </p>
            </div>
            {report ? (
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={copyReport}>
                  <Copy className="size-3.5" />
                  {t('settings.diagnosticsCopy')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={downloadReport}
                >
                  <Download className="size-3.5" />
                  {t('settings.diagnosticsDownload')}
                </Button>
              </div>
            ) : null}
          </div>

          <pre className="mt-4 min-h-[28rem] max-h-[42rem] overflow-auto rounded-xl border border-border/50 bg-muted/35 p-4 text-[0.75rem] leading-relaxed whitespace-pre-wrap text-muted-foreground xl:min-h-0 xl:max-h-none xl:flex-1">
            {report?.markdown ?? t('settings.diagnosticsPreviewPlaceholder')}
          </pre>
        </div>
      </div>
    </SettingsPanel>
  )
}
