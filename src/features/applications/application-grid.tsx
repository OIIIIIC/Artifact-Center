import { ApplicationCard } from '@/features/applications/application-card'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'

interface ApplicationGridProps {
  applications: Application[]
  className?: string
}

/**
 * Responsive object grid with generous gaps (README breathing room).
 * Mobile 1 · Tablet 2 · Laptop 3 · Desktop 4
 */
export function ApplicationGrid({ applications, className }: ApplicationGridProps) {
  return (
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
  )
}
