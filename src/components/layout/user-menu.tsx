import { LogOut, Settings, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

export function UserMenu({ className }: { className?: string }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!user) return null

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return (
    <div ref={rootRef} className={cn('relative ml-1', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 rounded-full p-0"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('auth.accountMenu')}
      >
        <Avatar size="sm" className="size-7">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-[11px] font-medium">
            {initials || 'U'}
          </AvatarFallback>
        </Avatar>
      </Button>

      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl',
            'bg-popover text-popover-foreground shadow-[var(--shadow-sm)]',
            'ring-1 ring-border/70',
          )}
        >
          <div className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2.5">
            <Avatar size="sm" className="size-8 shrink-0">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[10px] font-medium">
                {initials || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-[0.8125rem] font-medium text-foreground">
                {user.name}
              </p>
              <p className="truncate text-[0.75rem] text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
          <div className="p-1">
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[0.8125rem] text-muted-foreground">
              <UserRound className="size-3.5 opacity-70" strokeWidth={1.75} />
              <span>{t(`settings.role.${user.role}`)}</span>
            </div>
            <button
              type="button"
              role="menuitem"
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.8125rem]',
                'text-foreground transition-colors duration-[var(--duration-hover)]',
                'hover:bg-muted/50',
              )}
              onClick={() => {
                setOpen(false)
                navigate('/settings')
              }}
            >
              <Settings className="size-3.5 opacity-70" strokeWidth={1.75} />
              {t('settings.openSettings')}
            </button>
            <button
              type="button"
              role="menuitem"
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.8125rem]',
                'text-foreground transition-colors duration-[var(--duration-hover)]',
                'hover:bg-muted/50',
              )}
              onClick={() => {
                setOpen(false)
                logout()
                navigate('/login', { replace: true })
              }}
            >
              <LogOut className="size-3.5 opacity-70" strokeWidth={1.75} />
              {t('auth.logout')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
