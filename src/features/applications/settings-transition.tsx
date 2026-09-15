import { motion, useIsPresent, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

/** Keep fading-out controls out of keyboard navigation and prevent duplicate saves. */
export function SettingsTransition({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const present = useIsPresent()
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 4 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: reduced ? 0 : 0.18, ease: 'easeOut' },
      }}
      exit={{
        opacity: 0,
        y: reduced ? 0 : -3,
        transition: { duration: reduced ? 0 : 0.1 },
      }}
      inert={!present}
      aria-hidden={!present || undefined}
    >
      {children}
    </motion.div>
  )
}
