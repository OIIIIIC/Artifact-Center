import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Trash2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/feedback'
import { cn } from '@/lib/utils'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

interface AvatarUploadProps {
  name: string
  avatarUrl?: string | null
  onChange: (dataUrl: string | null) => void | Promise<void>
  disabled?: boolean
  className?: string
}

/**
 * Avatar picker — uploads as data URL via profile API.
 */
export function AvatarUpload({
  name,
  avatarUrl,
  onChange,
  disabled,
  className,
}: AvatarUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  const onPick = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const onFile = (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('settings.avatarErrorType'))
      return
    }
    if (file.size > MAX_BYTES) {
      setError(t('settings.avatarErrorSize'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') onChange(result)
      else setError(t('settings.avatarErrorType'))
    }
    reader.onerror = () => setError(t('settings.avatarErrorType'))
    reader.readAsDataURL(file)
  }

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className={cn(
          'group relative size-16 shrink-0 overflow-hidden rounded-full',
          'ring-1 ring-border/70 outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/40',
          'disabled:pointer-events-none disabled:opacity-60',
        )}
        aria-label={t('settings.avatarChange')}
      >
        <Avatar className="size-16">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-[0.9375rem] font-medium">
            {initials || 'U'}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'bg-foreground/45 text-background opacity-0',
            'transition-opacity duration-[var(--duration-hover)]',
            'group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
        >
          <Camera className="size-4" strokeWidth={1.75} />
        </span>
      </button>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-0 bg-muted/40 ring-1 ring-border/60"
            disabled={disabled}
            onClick={onPick}
          >
            {t('settings.avatarUpload')}
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              disabled={disabled}
              onClick={() => {
                setError(null)
                onChange(null)
              }}
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              {t('settings.avatarRemove')}
            </Button>
          ) : null}
        </div>
        <p className="text-[0.75rem] text-muted-foreground">{t('settings.avatarHint')}</p>
        <FormError message={error} className="[&_p]:text-[0.75rem]" />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
