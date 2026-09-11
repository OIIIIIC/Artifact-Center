import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiCreateRegion, apiUpdateRegion } from '@/services/api'
import type { Product } from '@/types/application'
import { directoryError, useDirectoryMutation } from './directory-management'

export type ProductDraft = { name: string; code: string; sortOrder: string }

export function ProductEditor({
  product,
  draft,
  onChange,
  onCancel,
  onSaved,
}: {
  product?: Product
  draft: ProductDraft
  onChange: (draft: ProductDraft) => void
  onCancel: () => void
  onSaved: (product: Product) => void
}) {
  const { t } = useTranslation()
  const mutation = useDirectoryMutation()
  const [error, setError] = useState('')
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (mutation.busy) return
    const body = {
      name: draft.name.trim(),
      code: draft.code.trim(),
      sortOrder: Number(draft.sortOrder),
    }
    if (
      !body.name ||
      !/^[a-zA-Z0-9_-]+$/.test(body.code) ||
      !Number.isInteger(body.sortOrder) ||
      body.sortOrder < 0 ||
      body.sortOrder > 9999
    ) {
      setError(t('settings.regionInvalid'))
      return
    }
    setError('')
    try {
      let saved: Product | undefined
      await mutation.mutateAsync(async () => {
        saved = product
          ? await apiUpdateRegion(product.id, body)
          : await apiCreateRegion(body)
      })
      if (saved) onSaved(saved)
      toast.success(t(product ? 'settings.regionUpdated' : 'settings.regionCreated'))
    } catch (caught) {
      const message = directoryError(caught, t)
      setError(message)
      toast.error(message)
    }
  }
  return (
    <form
      aria-label={t(product ? 'settings.editRegionTitle' : 'settings.addRegionTitle')}
      onSubmit={(event) => void save(event)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !mutation.busy) {
          event.stopPropagation()
          onCancel()
        }
      }}
      className="space-y-3 border-b border-border/70 pb-5"
    >
      <label className="block space-y-1.5 text-xs text-muted-foreground">
        <span>{t('settings.regionName')}</span>
        <Input
          autoFocus
          maxLength={120}
          required
          disabled={mutation.busy}
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>
      <label className="block space-y-1.5 text-xs text-muted-foreground">
        <span>{t('settings.regionCode')}</span>
        <Input
          maxLength={64}
          required
          disabled={mutation.busy}
          value={draft.code}
          placeholder="care_product"
          className="font-mono"
          onChange={(event) => onChange({ ...draft, code: event.target.value })}
        />
      </label>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer py-1">{t('settings.regionSortOrder')}</summary>
        <label className="mt-2 block space-y-1.5">
          <span>{t('settings.regionSortOrderShortHint')}</span>
          <Input
            type="number"
            min={0}
            max={9999}
            required
            disabled={mutation.busy}
            value={draft.sortOrder}
            onChange={(event) => onChange({ ...draft, sortOrder: event.target.value })}
          />
        </label>
      </details>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={mutation.busy}
          onClick={onCancel}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={mutation.busy || !draft.name.trim() || !draft.code.trim()}
        >
          {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
