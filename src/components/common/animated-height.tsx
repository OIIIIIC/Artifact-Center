import { motion, useReducedMotion } from 'framer-motion'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Animate document-flow height without scaling cards or the text inside them. */
export function AnimatedHeight({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()
  const reduceMotion = useReducedMotion()

  useLayoutEffect(() => {
    const element = content.current
    if (!element) return
    const measure = () => setHeight(element.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      initial={false}
      animate={{ height: reduceMotion ? 'auto' : (height ?? 'auto') }}
      transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.2, 0, 0, 1] }}
      className="-m-1 overflow-hidden"
    >
      <div ref={content} className="p-1">
        {children}
      </div>
    </motion.div>
  )
}
