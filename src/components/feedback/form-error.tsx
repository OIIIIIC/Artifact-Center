import { AnimatePresence, motion } from 'framer-motion'

import { cn } from '@/lib/utils'

interface FormErrorProps {
  message?: string | null
  className?: string
}

/** 预留错误文本高度，避免错误反复出现时推动相邻控件。 */
export function FormError({ message, className }: FormErrorProps) {
  return (
    <div className={cn('min-h-[1.125rem] overflow-hidden', className)} aria-live="polite">
      <AnimatePresence initial={false} mode="wait">
        {message ? (
          <motion.p
            key={message}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
            className="text-[0.8125rem] text-destructive"
            role="alert"
          >
            {message}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
