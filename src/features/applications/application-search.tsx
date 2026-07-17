import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ApplicationSearchProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * In-page catalog filter only — does not claim global ⌘K (that opens GlobalSearch).
 */
export function ApplicationSearch({
  value,
  onChange,
  className,
}: ApplicationSearchProps) {
  const { t } = useTranslation()

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
        placeholder={t('applications.searchPlaceholder')}
        aria-label={t('applications.searchAria')}
        className={cn(
          /* h-10 aligns with page action buttons (size lg) */
          'h-10 w-full rounded-xl bg-muted/35 pl-11',
          value ? 'pr-12' : 'pr-4',
          'text-[0.875rem] text-foreground placeholder:text-muted-foreground/70',
          'ring-1 ring-border/60 outline-none',
          'transition-[background-color,box-shadow,ring-color] duration-[var(--duration-page)] ease-standard',
          'hover:bg-muted/45 hover:ring-border',
          'focus-visible:bg-card focus-visible:ring-ring/35 focus-visible:ring-[3px]',
          'dark:bg-muted/20 dark:hover:bg-muted/30 dark:focus-visible:bg-card',
        )}
      />
      {value ? (
        <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground transition-colors duration-[var(--duration-hover)] hover:text-foreground"
            onClick={() => onChange('')}
            aria-label={t('applications.clearSearch')}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
