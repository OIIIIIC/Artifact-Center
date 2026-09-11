import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'

/** Animate document-flow height without scaling cards or the text inside them. */
export function AnimatedHeight({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null)
  const height = useMotionValue<number | 'auto'>('auto')
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const element = content.current
    if (!element || reduceMotion) return
    let previous: number | undefined
    let stop: (() => void) | undefined
    // ResizeObserver delivers the browser's completed layout. Do not force another
    // layout or a synchronous React render for every timeline section on entry.
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize[0]?.blockSize
      if (next === undefined || next === previous) return
      stop?.()
      if (previous === undefined) height.set(next)
      else {
        const animation = animate(height, next, {
          duration: 0.32,
          ease: [0.2, 0, 0, 1],
        })
        stop = () => animation.stop()
      }
      previous = next
    })
    observer.observe(element, { box: 'border-box' })
    return () => {
      observer.disconnect()
      stop?.()
    }
  }, [height, reduceMotion])

  return (
    <motion.div
      initial={false}
      style={{ height: reduceMotion ? 'auto' : height }}
      className="-m-1 overflow-hidden"
    >
      <div ref={content} className="p-1">
        {children}
      </div>
    </motion.div>
  )
}
