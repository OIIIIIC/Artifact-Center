import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { cn } from '@/lib/utils'

const STAGE_SIZE = 288

export type AvatarCropSource = {
  url: string
  width: number
  height: number
}

type Point = { x: number; y: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function canvasDataUrl(
  source: AvatarCropSource,
  zoom: number,
  pan: Point,
): Promise<string> {
  const coverScale = Math.max(STAGE_SIZE / source.width, STAGE_SIZE / source.height)
  const scale = coverScale * zoom
  const sourceSize = STAGE_SIZE / scale
  const sx = (source.width - sourceSize) / 2 - pan.x / scale
  const sy = (source.height - sourceSize) / 2 - pan.y / scale
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Canvas is unavailable'))
        return
      }
      context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, 512, 512)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    image.onerror = () => reject(new Error('Image load failed'))
    image.src = source.url
  })
}

type AvatarCropDialogProps = {
  source: AvatarCropSource | null
  onClose: () => void
  onSave: (dataUrl: string) => void | Promise<void>
}

export function AvatarCropDialog({ source, onClose, onSave }: AvatarCropDialogProps) {
  if (!source) return null

  return (
    <AvatarCropEditor
      key={source.url}
      source={source}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function AvatarCropEditor({
  source,
  onClose,
  onSave,
}: {
  source: AvatarCropSource
  onClose: () => void
  onSave: (dataUrl: string) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const panLayerRef = useRef<HTMLDivElement>(null)
  const zoomLabelRef = useRef<HTMLSpanElement>(null)
  const zoomRef = useRef(1)
  const panRef = useRef<Point>({ x: 0, y: 0 })
  const frameRef = useRef<number | null>(null)
  const dragRef = useRef<{
    pointerId: number
    origin: Point
    startX: number
    startY: number
  } | null>(null)

  const coverScale = Math.max(STAGE_SIZE / source.width, STAGE_SIZE / source.height)
  const baseWidth = source.width * coverScale
  const baseHeight = source.height * coverScale

  const getMaxPan = (zoom: number) => {
    const nextWidth = baseWidth * zoom
    const nextHeight = baseHeight * zoom
    const nextMaxX = Math.max(0, (nextWidth - STAGE_SIZE) / 2)
    const nextMaxY = Math.max(0, (nextHeight - STAGE_SIZE) / 2)
    return { x: nextMaxX, y: nextMaxY }
  }

  const paintPreview = () => {
    frameRef.current = null
    const { x, y } = panRef.current
    panLayerRef.current?.style.setProperty('transform', `translate3d(${x}px, ${y}px, 0)`)
    imageRef.current?.style.setProperty(
      'transform',
      `translate3d(-50%, -50%, 0) scale(${zoomRef.current})`,
    )
  }

  const schedulePreviewPaint = () => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(paintPreview)
  }

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  const updateZoom = (nextZoom: number) => {
    zoomRef.current = nextZoom
    const maxPan = getMaxPan(nextZoom)
    panRef.current = {
      x: clamp(panRef.current.x, -maxPan.x, maxPan.x),
      y: clamp(panRef.current.y, -maxPan.y, maxPan.y),
    }
    if (zoomLabelRef.current)
      zoomLabelRef.current.textContent = `${Math.round(nextZoom * 100)}%`
    schedulePreviewPaint()
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSave(await canvasDataUrl(source, zoomRef.current, panRef.current))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
    >
      <ModalContent className="w-[min(28rem,calc(100vw-2rem))]">
        <ModalHeader>
          <ModalTitle>{t('settings.avatarCropTitle')}</ModalTitle>
          <ModalDescription>{t('settings.avatarCropDesc')}</ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-5">
          <div
            className="relative mx-auto size-72 touch-none overflow-hidden rounded-full bg-muted/60 ring-1 ring-border/70 cursor-grab active:cursor-grabbing"
            onPointerDown={(event) => {
              if (saving) return
              event.currentTarget.setPointerCapture(event.pointerId)
              dragRef.current = {
                pointerId: event.pointerId,
                origin: panRef.current,
                startX: event.clientX,
                startY: event.clientY,
              }
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current
              if (!drag || drag.pointerId !== event.pointerId) return
              const maxPan = getMaxPan(zoomRef.current)
              panRef.current = {
                x: clamp(
                  drag.origin.x + event.clientX - drag.startX,
                  -maxPan.x,
                  maxPan.x,
                ),
                y: clamp(
                  drag.origin.y + event.clientY - drag.startY,
                  -maxPan.y,
                  maxPan.y,
                ),
              }
              schedulePreviewPaint()
            }}
            onPointerUp={() => {
              dragRef.current = null
            }}
            onPointerCancel={() => {
              dragRef.current = null
            }}
            aria-label={t('settings.avatarCropStage')}
          >
            <div ref={panLayerRef} className="absolute inset-0 will-change-transform">
              <img
                ref={imageRef}
                src={source.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute top-1/2 left-1/2 max-w-none select-none will-change-transform"
                style={{
                  width: baseWidth,
                  height: baseHeight,
                  transform: 'translate3d(-50%, -50%, 0) scale(1)',
                }}
              />
            </div>
          </div>

          <label className="block space-y-2">
            <span className="flex items-center justify-between text-[0.8125rem] font-medium text-foreground">
              {t('settings.avatarCropZoom')}
              <span
                ref={zoomLabelRef}
                className="font-mono text-[0.75rem] text-muted-foreground"
              >
                100%
              </span>
            </span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              defaultValue="1"
              disabled={saving}
              onInput={(event) => updateZoom(Number(event.currentTarget.value))}
              className={cn(
                'w-full accent-foreground',
                saving && 'cursor-not-allowed opacity-60',
              )}
            />
          </label>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? t('settings.avatarCropping') : t('settings.avatarCropSave')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
