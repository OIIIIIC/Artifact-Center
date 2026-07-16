import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useModKeyLabel } from '@/hooks/use-mod-key-label'
import { cn } from '@/lib/utils'

interface ApplicationSearchProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Visual center of Applications home.
 * Shortcut chip is decorative only.
 */
export function ApplicationSearch({
  value,
  onChange,
  className,
}: ApplicationSearchProps) {
  const shortcut = useModKeyLabel('K')

  return (
    <div className={cn('group/search relative w-full', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-[var(--duration-hover)] group-focus-within/search:text-foreground/80"
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, package, or owner…"
        aria-label="Search applications"
        className={cn(
          'h-12 w-full rounded-xl bg-muted/35 pr-24 pl-11',
          'text-[0.9375rem] text-foreground placeholder:text-muted-foreground/70',
          'ring-1 ring-border/60 outline-none',
          'transition-[background-color,box-shadow,ring-color] duration-[var(--duration-page)] ease-standard',
          'hover:bg-muted/45 hover:ring-border',
          'focus-visible:bg-card focus-visible:ring-ring/35 focus-visible:ring-[3px]',
          'dark:bg-muted/20 dark:hover:bg-muted/30 dark:focus-visible:bg-card',
        )}
      />
      <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1">
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground transition-colors duration-[var(--duration-hover)] hover:text-foreground"
            onClick={() => onChange('')}
            aria-label="Clear search"
          >
            <X className="size-4" />
          </Button>
        ) : null}
        <kbd
          className={cn(
            'pointer-events-none hidden select-none items-center rounded-md',
            'bg-background/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground',
            'ring-1 ring-border/70 sm:inline-flex dark:bg-background/40',
          )}
        >
          {shortcut}
        </kbd>
      </div>
    </div>
  )
}
