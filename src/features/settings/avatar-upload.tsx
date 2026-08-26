import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Sparkles, Trash2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/feedback'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal'
import {
  DEFAULT_AVATAR_URLS,
  getUserAvatarUrl,
} from '@/components/common/user-avatar-url'
import { cn } from '@/lib/utils'
import { AvatarCropDialog, type AvatarCropSource } from './avatar-crop-dialog'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ACCEPT = 'image/jpeg,image/png,image/webp'
const SUPPORTED_TYPES = new Set(ACCEPT.split(','))

interface AvatarUploadProps {
  userId: string
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
  userId,
  name,
  avatarUrl,
  onChange,
  disabled,
  className,
}: AvatarUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [cropSource, setCropSource] = useState<AvatarCropSource | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(
    () => () => {
      if (cropSource) URL.revokeObjectURL(cropSource.url)
    },
    [cropSource],
  )

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  const isDisabled = disabled || saving
  const previewUrl = getUserAvatarUrl({ id: userId, avatarUrl })

  const saveAvatar = async (nextAvatarUrl: string | null) => {
    setSaving(true)
    try {
      await onChange(nextAvatarUrl)
    } finally {
      setSaving(false)
    }
  }

  const onPick = () => {
    if (isDisabled) return
    inputRef.current?.click()
  }

  const onFile = (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!SUPPORTED_TYPES.has(file.type)) {
      setError(t('settings.avatarErrorType'))
      return
    }
    if (file.size > MAX_BYTES) {
      setError(t('settings.avatarErrorSize'))
      return
    }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      setCropSource({
        url,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      setError(t('settings.avatarErrorType'))
    }
    image.src = url
  }

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      <button
        type="button"
        onClick={onPick}
        disabled={isDisabled}
        className={cn(
          'group relative size-16 shrink-0 overflow-hidden rounded-full',
          'ring-1 ring-border/70 outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/40',
          'disabled:pointer-events-none disabled:opacity-60',
        )}
        aria-label={t('settings.avatarChange')}
      >
        <Avatar className="size-16">
          <AvatarImage src={previewUrl} alt="" />
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
            disabled={isDisabled}
            onClick={onPick}
          >
            {t('settings.avatarUpload')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-0 bg-muted/40 ring-1 ring-border/60"
            disabled={isDisabled}
            onClick={() => setLibraryOpen(true)}
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            {t('settings.avatarLibrary')}
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              disabled={isDisabled}
              onClick={() => {
                setError(null)
                void saveAvatar(null)
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
        disabled={isDisabled}
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <AvatarCropDialog
        source={cropSource}
        onClose={() => setCropSource(null)}
        onSave={async (dataUrl) => {
          setError(null)
          await saveAvatar(dataUrl)
        }}
      />

      <Modal open={libraryOpen} onOpenChange={setLibraryOpen}>
        <ModalContent className="w-[min(34rem,calc(100vw-2rem))]">
          <ModalHeader>
            <ModalTitle>{t('settings.avatarLibraryTitle')}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div
              className="grid grid-cols-4 gap-3 sm:grid-cols-6"
              role="list"
              aria-label={t('settings.avatarLibraryGridLabel')}
            >
              {DEFAULT_AVATAR_URLS.map((avatarUrl, index) => (
                <div key={avatarUrl} role="listitem">
                  <button
                    type="button"
                    disabled={isDisabled}
                    aria-label={t('settings.avatarLibraryOption', {
                      number: index + 1,
                    })}
                    className={cn(
                      'group aspect-square w-full overflow-hidden rounded-full outline-none ring-1 ring-border/70',
                      'transition-transform duration-[var(--duration-hover)] hover:scale-105',
                      'focus-visible:ring-2 focus-visible:ring-ring/50',
                      'disabled:pointer-events-none disabled:opacity-60',
                    )}
                    onClick={() => {
                      void (async () => {
                        await saveAvatar(avatarUrl)
                        setLibraryOpen(false)
                      })()
                    }}
                  >
                    <img
                      src={avatarUrl}
                      alt=""
                      loading="lazy"
                      className="block size-full object-cover"
                    />
                  </button>
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => setLibraryOpen(false)}
            >
              {t('common.close')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
