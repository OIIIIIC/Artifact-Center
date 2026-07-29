import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { Layers3, MapPin } from 'lucide-react'
import { useRef } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { Region } from '@/types/application'

interface RegionSwitcherProps {
  regions: Region[]
  selected: string
  counts: Record<string, number>
  onChange: (regionId: string) => void
}

const easeOut = [0.2, 0, 0, 1] as const

function RegionChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3',
        'text-[0.8125rem] font-medium transition-colors duration-200',
        'ease-[cubic-bezier(0.2,0,0,1)]',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {active ? (
        <motion.span
          layoutId={reduceMotion ? undefined : 'region-filter-pill'}
          className={cn(
            'absolute inset-0 rounded-lg bg-background shadow-[var(--shadow-xs)]',
            'ring-1 ring-inset ring-border/60 dark:bg-card',
          )}
          transition={{ duration: 0.22, ease: easeOut }}
          aria-hidden
        />
      ) : null}
      <span className="relative z-[1] inline-flex items-center gap-2">{children}</span>
    </button>
  )
}

export function RegionSwitcher({
  regions,
  selected,
  counts,
  onChange,
}: RegionSwitcherProps) {
  const { t } = useTranslation()
  const drag = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 })
  const suppressClick = useRef(false)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    drag.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
    }
    suppressClick.current = false
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    const delta = event.clientX - drag.current.startX
    if (!drag.current.moved && Math.abs(delta) > 4) {
      drag.current.moved = true
      suppressClick.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (!drag.current.moved) return
    event.preventDefault()
    event.currentTarget.scrollLeft = drag.current.scrollLeft - delta
  }

  const endPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    drag.current.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
  }

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
  }

  return (
    <LayoutGroup id="application-region-filter">
      <div
        className="flex w-full max-w-full items-center gap-1 overflow-hidden rounded-xl bg-muted/30 p-1"
        role="group"
        aria-label={t('applications.regionFilter')}
      >
        <RegionChip active={selected === 'all'} onClick={() => onChange('all')}>
          <Layers3 className="size-3.5 opacity-65" strokeWidth={1.75} />
          {t('applications.allRegions')}
        </RegionChip>
        <div
          data-slot="region-scroll"
          className="flex min-w-0 flex-1 cursor-grab touch-pan-x select-none items-center gap-1 overflow-x-auto overscroll-x-contain active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
          onClickCapture={onClickCapture}
        >
          {regions.map((region) => (
            <RegionChip
              key={region.id}
              active={selected === region.id}
              onClick={() => onChange(region.id)}
            >
              <MapPin className="size-3.5 opacity-65" strokeWidth={1.75} />
              {region.name}
              <span className="text-[0.6875rem] tabular-nums text-muted-foreground/70">
                {counts[region.id] ?? 0}
              </span>
            </RegionChip>
          ))}
        </div>
      </div>
    </LayoutGroup>
  )
}
