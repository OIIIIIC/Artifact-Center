import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { BlankLayout } from '@/components/layout'
import { LocaleSwitch } from '@/components/layout/locale-switch'
import { ThemeSwitch } from '@/components/layout/theme-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

/**
 * Login — minimal, brand-first (not ERP).
 * Mock: any non-empty email + password; demo@enterprise.local recommended.
 */
export function LoginPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : '/'

  const [email, setEmail] = useState('demo@enterprise.local')
  const [password, setPassword] = useState('Demo@2026')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={from} replace />
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await login({ email, password })
    setLoading(false)
    if (!result.ok) {
      if (result.code === 'wrong_password') {
        setError(t('auth.errorWrongPassword'))
      } else if (result.code === 'weak_password') {
        setError(t('auth.errorWeakPassword'))
      } else if (result.code === 'invalid_email') {
        setError(t('auth.errorInvalidEmail'))
      } else if (result.code === 'empty') {
        setError(t('auth.errorEmpty'))
      } else {
        setError(t('auth.errorWrongPassword'))
      }
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <BlankLayout className="relative flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-0.5 sm:top-6 sm:right-6">
        <LocaleSwitch compact />
        <ThemeSwitch compact />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-[var(--page-padding-x)] py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex flex-col items-center text-center">
            <div
              className={cn(
                'mb-4 flex size-11 items-center justify-center rounded-xl',
                'bg-foreground text-[13px] font-semibold tracking-tight text-background',
              )}
              aria-hidden
            >
              AC
            </div>
            <h1 className="text-[1.5rem] font-semibold tracking-tight text-foreground">
              {t('brand.name')}
            </h1>
            <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
              {t('auth.subtitle')}
            </p>
          </div>

          <form
            onSubmit={(e) => void onSubmit(e)}
            className={cn(
              'space-y-4 rounded-2xl bg-card/80 p-6 ring-1 ring-border/70',
              'dark:bg-card/50 dark:ring-border',
            )}
          >
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="text-[0.8125rem] font-medium text-foreground"
              >
                {t('auth.email')}
              </label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                className="h-10 rounded-lg"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="text-[0.8125rem] font-medium text-foreground"
              >
                {t('auth.password')}
              </label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className="h-10 rounded-lg"
                disabled={loading}
                required
              />
            </div>

            {error ? (
              <p className="text-[0.8125rem] text-muted-foreground" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>

            <p className="text-center text-[0.75rem] leading-relaxed text-muted-foreground/80">
              {t('auth.demoHint')}
            </p>
          </form>
        </div>
      </div>
    </BlankLayout>
  )
}
