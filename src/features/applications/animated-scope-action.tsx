import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

/** Include spacing in the animated width, with room for the button's focus ring. */
export function AnimatedScopeAction({
  visible,
  children,
}: {
  visible: boolean
  children: ReactNode
}) {
  return (
    <AnimatePresence initial={false}>
      {visible ? <ScopeActionContent>{children}</ScopeActionContent> : null}
    </AnimatePresence>
  )
}

function ScopeActionContent({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const isPresent = useIsPresent()
  return (
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: 'auto' }}
      exit={{
        width: 0,
        transition: { duration: reduceMotion ? 0 : 0.12, delay: reduceMotion ? 0 : 0.06 },
      }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
      aria-hidden={!isPresent || undefined}
      inert={!isPresent}
      className="shrink-0 overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          transition: {
            duration: reduceMotion ? 0 : 0.14,
            delay: reduceMotion ? 0 : 0.04,
          },
        }}
        exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.08 } }}
        className="w-max p-1"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
