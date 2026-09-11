import { MoreHorizontal } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function DirectoryMenu({
  label,
  disabled,
  children,
}: {
  label: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 min-w-44 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function DirectoryMenuItem({
  children,
  onSelect,
  disabled,
  destructive,
  asChild,
}: {
  children: ReactNode
  onSelect?: () => void
  disabled?: boolean
  destructive?: boolean
  asChild?: boolean
}) {
  return (
    <DropdownMenu.Item
      asChild={asChild}
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-xs outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        destructive && 'text-destructive',
      )}
    >
      {children}
    </DropdownMenu.Item>
  )
}

export function DirectoryMenuNote({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="max-w-60 px-2.5 py-2 text-[0.6875rem] font-normal text-muted-foreground">
      {children}
    </DropdownMenu.Label>
  )
}
