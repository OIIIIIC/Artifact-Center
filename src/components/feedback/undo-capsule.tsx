import { useEffect, useRef, useState } from 'react'
import { useIsPresent } from 'framer-motion'
import { Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type UndoCapsuleProps = {
  message: string
  onUndo: () => void
  onExpire: () => void
}

/** One clock drives both the outline and expiry, including hover/focus pauses. */
export function UndoCapsule({ message, onUndo, onExpire }: UndoCapsuleProps) {
  const { t } = useTranslation()
  const present = useIsPresent()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(document.hidden)
  const [remaining, setRemaining] = useState(5000)
  const remainingRef = useRef(5000)
  const expireRef = useRef(onExpire)
  useEffect(() => {
    expireRef.current = onExpire
  }, [onExpire])
  useEffect(() => {
    const update = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    if (hovered || focused || hidden || !present) return
    let previous = performance.now()
    let frame: number
    const tick = (now: number) => {
      remainingRef.current = Math.max(0, remainingRef.current - (now - previous))
      previous = now
      setRemaining(remainingRef.current)
      if (remainingRef.current === 0) expireRef.current()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [hovered, focused, hidden, present])

  return (
    <div
      aria-hidden={!present}
      style={{ pointerEvents: present ? 'auto' : 'none' }}
      className="pointer-events-auto relative flex h-12 max-w-full items-center gap-3 rounded-full border border-border/70 bg-popover px-5 text-sm text-popover-foreground shadow-lg"
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') setHovered(true)
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
    >
      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible text-amber-500/65"
        aria-hidden="true"
      >
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 * (1 - remaining / 5000)}
          strokeLinecap="round"
        />
      </svg>
      <span role="status" className="min-w-0 truncate" title={message}>
        {message}
      </span>
      <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
      <button
        type="button"
        disabled={!present}
        onClick={onUndo}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Undo2 className="size-3.5" aria-hidden="true" />
        {t('applications.workspace.undo')}
      </button>
    </div>
  )
}
