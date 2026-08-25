import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, FileText, Loader2, Pencil, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { MarkdownPreview } from '@/components/common/markdown-preview'
import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal'
import { formatRelativeTime } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { apiUpdateReleaseNotes } from '@/services/api'
import type { ApplicationStatus } from '@/types/application'
import type { Release } from '@/types/release'

interface ReleaseNotesPanelProps {
  releases: Release[]
  applicationId?: string
  applicationStatus?: ApplicationStatus
  canManage: boolean
}

const COLLAPSE_NOTES_AFTER = 480

function shouldCollapseNotes(notes: string) {
  return notes.length > COLLAPSE_NOTES_AFTER || notes.split(/\r?\n/).length > 8
}

/**
 * Application Detail → Release notes tab.
 * Lists release notes from the server-side Release aggregate.
 */
export function ReleaseNotesPanel({
  releases,
  applicationId,
  applicationStatus,
  canManage,
}: ReleaseNotesPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Release | null>(null)
  const [draft, setDraft] = useState('')
  const [notesMode, setNotesMode] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState(false)
  const [expandedReleaseIds, setExpandedReleaseIds] = useState<Set<string>>(
    () => new Set(),
  )

  const uploadTo = applicationId ? `/upload?app=${applicationId}` : '/upload'
  const applicationArchived = applicationStatus === 'archived'
  const canEdit = Boolean(applicationId) && canManage && !applicationArchived

  const startEditing = (release: Release) => {
    setEditing(release)
    setDraft(release.releaseNotes)
    setNotesMode('edit')
  }

  const toggleExpanded = (releaseId: string) => {
    setExpandedReleaseIds((current) => {
      const next = new Set(current)
      if (next.has(releaseId)) next.delete(releaseId)
      else next.add(releaseId)
      return next
    })
  }

  const saveReleaseNotes = async () => {
    if (!editing || !applicationId) return
    setSaving(true)
    try {
      await apiUpdateReleaseNotes(applicationId, editing.id, draft)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.releases.byApp(applicationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.artifacts.byApp(applicationId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit.byApp(applicationId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit.global }),
      ])
      setEditing(null)
      toast.success(t('detail.releaseNotesSaved'))
    } catch (caught) {
      toast.error(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('detail.releaseNotesSaveFailed'),
        }),
      )
    } finally {
      setSaving(false)
    }
  }

  if (releases.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={t('detail.releaseNotesEmptyTitle')}
        description={t('detail.releaseNotesEmptyDesc')}
        className="py-14"
        action={
          !canManage ? undefined : applicationArchived ? (
            <Button
              type="button"
              size="lg"
              disabled
              title={t('artifactRisk.applicationArchivedApplicationDesc')}
            >
              <Upload className="size-3.5" strokeWidth={1.75} />
              {t('detail.uploadArtifact')}
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to={uploadTo}>
                <Upload className="size-3.5" strokeWidth={1.75} />
                {t('detail.uploadArtifact')}
              </Link>
            </Button>
          )
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          {t('detail.releaseNotesTitle')}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          {t('detail.releaseNotesHint')}
        </p>
      </div>

      <ul className="space-y-3">
        {releases.map((release) => (
          <li
            key={release.id}
            className={cn(
              'rounded-2xl bg-card/50 px-4 py-3.5 ring-1 ring-border/70',
              'dark:bg-card/30',
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[0.875rem] font-medium text-foreground">
                v{release.version}
                <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">
                  {release.artifactCount} {t('detail.artifactsTitle')}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <time
                  dateTime={release.publishedAt}
                  className="text-[0.75rem] text-muted-foreground"
                >
                  {formatRelativeTime(release.publishedAt)}
                </time>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => startEditing(release)}
                  >
                    <Pencil className="size-3" strokeWidth={1.75} />
                    {t(
                      release.releaseNotes.trim()
                        ? 'detail.editReleaseNotes'
                        : 'detail.addReleaseNotes',
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
            {release.releaseNotes.trim() ? (
              <>
                <div
                  className={cn(
                    'relative mt-2',
                    shouldCollapseNotes(release.releaseNotes) &&
                      !expandedReleaseIds.has(release.id) &&
                      'max-h-52 overflow-hidden',
                  )}
                >
                  <MarkdownPreview content={release.releaseNotes} />
                  {shouldCollapseNotes(release.releaseNotes) &&
                  !expandedReleaseIds.has(release.id) ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card/80 to-transparent" />
                  ) : null}
                </div>
                {shouldCollapseNotes(release.releaseNotes) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 h-9 w-full border-dashed bg-muted/35 font-medium text-foreground shadow-sm hover:bg-muted/65"
                    aria-expanded={expandedReleaseIds.has(release.id)}
                    onClick={() => toggleExpanded(release.id)}
                  >
                    {expandedReleaseIds.has(release.id) ? (
                      <ChevronUp className="size-3.5" strokeWidth={1.75} />
                    ) : (
                      <ChevronDown className="size-3.5" strokeWidth={1.75} />
                    )}
                    {t(
                      expandedReleaseIds.has(release.id)
                        ? 'detail.releaseNotesCollapse'
                        : 'detail.releaseNotesExpandFull',
                    )}
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-[0.8125rem] text-muted-foreground">
                {t('detail.releaseNotesEmpty')}
              </p>
            )}
            <p className="mt-2 text-[0.6875rem] text-muted-foreground/80">
              {release.createdBy}
              {release.artifactTypes.length
                ? ` · ${release.artifactTypes.join(' / ').toUpperCase()}`
                : ''}
            </p>
          </li>
        ))}
      </ul>

      <Modal
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null)
        }}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>
              {t('detail.editReleaseNotesTitle', { version: editing?.version ?? '' })}
            </ModalTitle>
            <ModalDescription>{t('detail.editReleaseNotesDesc')}</ModalDescription>
          </ModalHeader>
          <ModalBody className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="release-notes"
                className="text-[0.8125rem] font-medium text-foreground"
              >
                {t('detail.releaseNotesField')}
              </label>
              <div
                className="inline-flex shrink-0 rounded-lg bg-muted/50 p-0.5 ring-1 ring-border/60"
                role="tablist"
                aria-label={t('detail.releaseNotesField')}
              >
                {(['edit', 'preview'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={notesMode === mode}
                    onClick={() => setNotesMode(mode)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[0.75rem] font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      notesMode === mode
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t(`upload.notes${mode === 'edit' ? 'Edit' : 'Preview'}`)}
                  </button>
                ))}
              </div>
            </div>
            {notesMode === 'edit' ? (
              <textarea
                id="release-notes"
                value={draft}
                maxLength={8000}
                rows={10}
                autoFocus
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t('upload.notesPlaceholder')}
                className={cn(
                  'w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none',
                  'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                )}
              />
            ) : (
              <MarkdownPreview
                content={draft}
                empty={
                  <p className="text-[0.8125rem] text-muted-foreground">
                    {t('upload.notesPreviewEmpty')}
                  </p>
                }
                className="min-h-[15rem] rounded-lg bg-muted/20 p-3 ring-1 ring-border/60"
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void saveReleaseNotes()}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t('detail.saveReleaseNotes')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
