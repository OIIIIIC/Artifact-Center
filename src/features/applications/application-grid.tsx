import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { ApplicationCard } from '@/features/applications/application-card'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'

interface ApplicationGridProps {
  applications: Application[]
  className?: string
  /**
   * 筛选维度变化时的过渡键（平台 / 地域 / 排序）。
   * 同格叠层 crossfade，避免退场清空造成闪烁。
   */
  transitionKey?: string
  /** 新筛选结果正在加载时保持当前网格，并给出极轻的忙碌语义。 */
  refreshing?: boolean
}

const easeOut = [0.2, 0, 0, 1] as const

/**
 * Responsive object grid with generous gaps (README breathing room).
 * Mobile 1 · Tablet 2 · Laptop 3 · Desktop 4
 */
export function ApplicationGrid({
  applications,
  className,
  transitionKey = 'grid',
  refreshing = false,
}: ApplicationGridProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="grid" aria-busy={refreshing}>
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={transitionKey}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2, ease: easeOut }}
          className="col-start-1 row-start-1 min-w-0"
        >
          <ul
            className={cn(
              'grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5',
              className,
            )}
          >
            {applications.map((app) => (
              <li key={app.id} className="min-w-0">
                <ApplicationCard application={app} />
              </li>
            ))}
          </ul>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
