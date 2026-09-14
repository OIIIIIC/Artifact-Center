import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  Folder,
  GripVertical,
  Loader2,
  Plus,
  Power,
  Trash2,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  apiCreateProject,
  apiDeleteProject,
  apiReorderProjects,
  apiUpdateProject,
} from '@/services/api'
import type { Product, Project } from '@/types/application'
import { directoryError, useDirectoryMutation } from './directory-management'
import { DirectoryMenu, DirectoryMenuItem, DirectoryMenuNote } from './directory-menu'

export type ProjectDraft = { id: string; name: string; code?: string; error?: string }

function ProjectRow({
  project,
  disabled,
  onDragStart,
  onDragEnd,
  onMove,
  children,
}: {
  project: Project
  disabled: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMove: (direction: number) => void
  children: ReactNode
}) {
  const controls = useDragControls()
  const reduced = useReducedMotion()
  const { t } = useTranslation()
  return (
    <Reorder.Item
      value={project.id}
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      transition={{ duration: reduced ? 0 : 0.18 }}
      whileDrag={{ zIndex: 10, scale: reduced ? 1 : 1.008 }}
      data-project-id={project.id}
      className="relative flex items-center gap-2 border-b border-border/65 bg-card py-4 sm:gap-3 sm:py-5"
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={t('directory.reorderProject', { name: project.name })}
        aria-describedby="project-sort-hint"
        className="flex h-9 w-6 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground/55 hover:bg-muted hover:text-foreground focus-visible:outline-ring disabled:cursor-default disabled:opacity-35 active:cursor-grabbing"
        onPointerDown={(event) => {
          if (!disabled) controls.start(event)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            onMove(event.key === 'ArrowUp' ? -1 : 1)
          }
        }}
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </Reorder.Item>
  )
}

export function ProjectsManager({
  product,
  projects,
  counts,
  draft,
  onDraftChange,
}: {
  product: Product
  projects: Project[]
  counts: Map<string, number> | null
  draft?: ProjectDraft
  onDraftChange: (draft: ProjectDraft | undefined) => void
}) {
  const { t } = useTranslation()
  const mutation = useDirectoryMutation()
  const [order, setOrder] = useState<string[] | null>(null)
  const [dragging, setDragging] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const orderRef = useRef<string[] | null>(null)
  const dragBaseline = useRef<string[]>([])
  const listRef = useRef<HTMLUListElement>(null)
  const newButton = useRef<HTMLButtonElement>(null)
  const busy = mutation.busy || dragging
  const projectMap = new Map(projects.map((p) => [p.id, p]))
  const ids = (order ?? projects.map((p) => p.id)).filter((id) => projectMap.has(id))
  const focusRow = (id: string) =>
    requestAnimationFrame(() => {
      if (id === 'new') newButton.current?.focus()
      else
        listRef.current
          ?.querySelector<HTMLButtonElement>(`[data-project-id="${id}"] [data-rename]`)
          ?.focus()
    })

  const save = async () => {
    if (!draft || busy || !draft.name.trim()) return
    const editing = draft
    const code = editing.code?.trim().toLowerCase() || null
    if (code && (code.length > 64 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(code))) {
      onDraftChange({ ...editing, error: t('directory.projectCodeInvalid') })
      return
    }
    try {
      let saved: Project | undefined
      await mutation.mutateAsync(async () => {
        saved =
          editing.id === 'new'
            ? await apiCreateProject(product.id, {
                name: editing.name.trim(),
                code,
                sortOrder: Math.min(
                  9999,
                  Math.max(0, ...projects.map((p) => p.sortOrder)) + 1,
                ),
              })
            : await apiUpdateProject(editing.id, { name: editing.name.trim(), code })
      })
      onDraftChange(undefined)
      if (saved) {
        setHighlight(saved.id)
        focusRow(saved.id)
      }
      toast.success(t('directory.projectSaved', { name: editing.name.trim() }))
    } catch (error) {
      const message = directoryError(error, t)
      onDraftChange({ ...editing, error: message })
      toast.error(message)
    }
  }

  const persistOrder = async (next: string[], expected: string[]) => {
    if (next.every((id, i) => id === expected[i])) {
      setOrder(null)
      orderRef.current = null
      return
    }
    setOrder(next)
    try {
      await mutation.mutateAsync(() => apiReorderProjects(product.id, next, expected))
      toast.success(t('directory.orderSaved'))
    } catch (error) {
      toast.error(directoryError(error, t))
    } finally {
      setOrder(null)
      orderRef.current = null
    }
  }

  const move = (id: string, direction: number) => {
    if (busy || draft) return
    const expected = projects.map((p) => p.id)
    const index = expected.indexOf(id),
      target = index + direction
    if (index < 0 || target < 0 || target >= expected.length) return
    const next = [...expected]
    next.splice(target, 0, next.splice(index, 1)[0])
    void persistOrder(next, expected)
  }

  const changeStatus = async (project: Project) => {
    if (busy || project.isDefault) return
    try {
      await mutation.mutateAsync(() =>
        apiUpdateProject(project.id, { enabled: !project.enabled }),
      )
      toast.success(
        t(
          project.enabled
            ? 'directory.projectDisabledFeedback'
            : 'directory.projectEnabledFeedback',
          { name: project.name },
        ),
      )
    } catch (error) {
      toast.error(directoryError(error, t))
    }
  }

  const remove = async (project: Project) => {
    if (busy || !counts || project.isDefault || counts.get(project.id)) return
    try {
      await mutation.mutateAsync(() => apiDeleteProject(project.id))
      setDeletingId(null)
      toast.success(t('directory.projectDeleted', { name: project.name }))
    } catch (error) {
      toast.error(directoryError(error, t))
    }
  }

  const editor = draft ? (
    <form
      aria-label={t(
        draft.id === 'new' ? 'directory.newProject' : 'directory.renameProject',
      )}
      className="min-w-0 flex-1 space-y-2 py-1"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) {
          event.stopPropagation()
          onDraftChange(undefined)
          focusRow(draft.id)
        }
      }}
    >
      <label className="block space-y-2 text-xs text-muted-foreground">
        <span>{t('directory.projectName')}</span>
        <Input
          autoFocus
          required
          maxLength={120}
          value={draft.name}
          disabled={busy}
          placeholder={t('directory.projectNamePlaceholder')}
          onChange={(event) =>
            onDraftChange({ ...draft, name: event.target.value, error: undefined })
          }
        />
      </label>
      <label className="block space-y-2 text-xs text-muted-foreground">
        <span>{t('directory.projectCode')}</span>
        <Input
          maxLength={64}
          aria-label={t('directory.projectCode')}
          value={draft.code ?? ''}
          disabled={busy}
          placeholder="shiyan"
          className="font-mono"
          onChange={(event) =>
            onDraftChange({ ...draft, code: event.target.value, error: undefined })
          }
        />
        <span className="block leading-relaxed">
          {t('directory.projectCodeHint', { code: product.code })}
        </span>
      </label>
      <p className="break-all text-xs text-muted-foreground">
        {t('directory.projectFilenamePreview', {
          prefix: (draft.code?.trim().toLowerCase() || product.code).replace(
            /[^a-z0-9.-]+/gi,
            '-',
          ),
        })}
      </p>
      {draft.error ? (
        <p role="alert" className="text-xs text-destructive">
          {draft.error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto hidden text-[0.6875rem] text-muted-foreground sm:block">
          {t('directory.editKeyboardHint')}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            onDraftChange(undefined)
            focusRow(draft.id)
          }}
        >
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={busy || !draft.name.trim()}>
          {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {t(draft.id === 'new' ? 'directory.createProject' : 'common.save')}
        </Button>
      </div>
    </form>
  ) : null

  return (
    <section aria-label={t('directory.projects')}>
      <div className="flex items-center justify-end gap-3">
        <Button
          ref={newButton}
          type="button"
          size="sm"
          disabled={busy || !product.enabled || !!draft}
          onClick={() => {
            setDeletingId(null)
            onDraftChange({ id: 'new', name: '' })
          }}
        >
          <Plus className="size-3.5" />
          {t('directory.newProject')}
        </Button>
      </div>
      {!product.enabled ? (
        <p className="mb-3 text-xs text-muted-foreground">
          {t('directory.productDisabled')}
        </p>
      ) : null}
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground sm:gap-3">
        <span aria-hidden="true" className="w-6 shrink-0" />
        <span aria-hidden="true" className="hidden w-10 shrink-0 sm:block" />
        <span className="min-w-0 flex-1">{t('directory.projectName')}</span>
        <span className="w-20 shrink-0 sm:w-1/4">{t('directory.applicationCount')}</span>
        <span aria-hidden="true" className="w-20 shrink-0" />
      </div>
      <Reorder.Group
        ref={listRef}
        axis="y"
        values={ids}
        layoutScroll
        className="border-t border-border/65"
        onReorder={(next: string[]) => {
          orderRef.current = next
          setOrder(next)
        }}
      >
        {draft && (draft.id === 'new' || !projectMap.has(draft.id)) ? (
          <li className="flex border-b border-border/65 py-4">{editor}</li>
        ) : null}
        {ids.map((id, index) => {
          const project = projectMap.get(id)!
          const count = counts ? (counts.get(id) ?? 0) : null
          return (
            <ProjectRow
              key={id}
              project={project}
              disabled={busy || !!draft || ids.length < 2}
              onDragStart={() => {
                dragBaseline.current = projects.map((p) => p.id)
                setDragging(true)
              }}
              onDragEnd={() => {
                setDragging(false)
                void persistOrder(
                  orderRef.current ?? dragBaseline.current,
                  dragBaseline.current,
                )
              }}
              onMove={(direction) => move(id, direction)}
            >
              {draft?.id === id ? (
                editor
              ) : (
                <>
                  <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-muted/65 text-muted-foreground sm:flex">
                    <Folder className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'flex flex-wrap items-center gap-2 rounded-md',
                        highlight === id &&
                          'motion-safe:animate-[project-saved_1.2s_ease-out]',
                      )}
                      onAnimationEnd={() => setHighlight(null)}
                    >
                      <span className="break-all text-sm font-medium">
                        {project.name}
                      </span>
                      {project.isDefault ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                          {t('directory.defaultBadge')}
                        </span>
                      ) : null}
                      {!project.enabled ? (
                        <span className="text-xs text-muted-foreground">
                          {t('settings.regionInactive')}
                        </span>
                      ) : null}
                    </div>
                    {deletingId === id ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-destructive">
                          {t('directory.confirmDelete', { name: project.name })}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setDeletingId(null)}
                          >
                            {t('common.cancel')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => void remove(project)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <Link
                    className="w-20 shrink-0 rounded-sm text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-ring sm:w-1/4 sm:text-sm"
                    to={`/?product=${product.id}&project=${id}`}
                  >
                    {count === null
                      ? t('directory.countUnavailable')
                      : t('applications.count', { count })}
                  </Link>
                  <div className="flex w-20 shrink-0 items-center justify-end gap-0.5">
                    <Button
                      type="button"
                      data-rename
                      size="sm"
                      variant="ghost"
                      className="px-2 text-xs text-muted-foreground"
                      disabled={busy || !!draft}
                      aria-label={t('directory.renameNamedProject', {
                        name: project.name,
                      })}
                      onClick={() => {
                        setDeletingId(null)
                        onDraftChange({
                          id,
                          name: project.name,
                          code: project.code ?? '',
                        })
                      }}
                    >
                      {t('directory.editProjectAction')}
                    </Button>
                    <DirectoryMenu
                      label={t('directory.more', { name: project.name })}
                      disabled={busy || !!draft}
                    >
                      <DirectoryMenuItem
                        disabled={index === 0}
                        onSelect={() => move(id, -1)}
                      >
                        <ArrowUp className="size-3.5" />
                        {t('directory.moveUp')}
                      </DirectoryMenuItem>
                      <DirectoryMenuItem
                        disabled={index === ids.length - 1}
                        onSelect={() => move(id, 1)}
                      >
                        <ArrowDown className="size-3.5" />
                        {t('directory.moveDown')}
                      </DirectoryMenuItem>
                      {product.enabled && project.enabled ? (
                        <DirectoryMenuItem asChild>
                          <Link
                            to={`/applications/new?product=${product.id}&project=${id}`}
                          >
                            <Plus className="size-3.5" />
                            {t('applications.newApplication')}
                          </Link>
                        </DirectoryMenuItem>
                      ) : null}
                      {project.isDefault ? (
                        <DirectoryMenuNote>
                          {t('directory.defaultProtected')}
                        </DirectoryMenuNote>
                      ) : (
                        <>
                          <DirectoryMenuItem onSelect={() => void changeStatus(project)}>
                            <Power className="size-3.5" />
                            {t(
                              project.enabled
                                ? 'directory.disableProject'
                                : 'directory.enableProject',
                            )}
                          </DirectoryMenuItem>
                          <DirectoryMenuItem
                            destructive
                            disabled={count === null || count > 0}
                            onSelect={() => setDeletingId(id)}
                          >
                            <Trash2 className="size-3.5" />
                            {t('directory.deleteProject')}
                          </DirectoryMenuItem>
                          {count === null || count > 0 ? (
                            <DirectoryMenuNote>
                              {t(
                                count === null
                                  ? 'directory.countUnavailable'
                                  : 'directory.inUse',
                              )}
                            </DirectoryMenuNote>
                          ) : null}
                        </>
                      )}
                    </DirectoryMenu>
                  </div>
                </>
              )}
            </ProjectRow>
          )
        })}
      </Reorder.Group>
      <p
        id="project-sort-hint"
        className="mt-5 text-[0.6875rem] leading-relaxed text-muted-foreground"
      >
        {t('directory.sortHint')}
      </p>
    </section>
  )
}
