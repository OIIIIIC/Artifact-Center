import { useState, type ComponentProps } from 'react'
import { TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/** Mount on first visit, then preserve forms and filters across tab changes. */
export function DetailTabContent({
  active,
  className,
  ...props
}: ComponentProps<typeof TabsContent> & { active: boolean }) {
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)
  if (!active && !visited) return null
  return (
    <TabsContent
      {...props}
      forceMount
      hidden={!active}
      className={cn(
        'data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-[detail-tab-enter_150ms_ease-out]!',
        className,
      )}
    />
  )
}
