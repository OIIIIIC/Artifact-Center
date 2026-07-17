import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Eye, EyeOff, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { checkPassword, type PasswordIssue, type PasswordStrength } from '@/lib/password'
import { cn } from '@/lib/utils'

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  disabled?: boolean
  /** Show strength meter for new passwords */
  showStrength?: boolean
  /** Compare against confirm / current */
  current?: string
  confirm?: string
  /** Show live match state vs confirm value (for confirm field) */
  matchAgainst?: string
  className?: string
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  showStrength,
  current,
  confirm,
  matchAgainst,
  className,
}: PasswordFieldProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const check = showStrength ? checkPassword(value, { current, confirm }) : null

  const matchState =
    matchAgainst !== undefined && value.length > 0
      ? matchAgainst === value
        ? 'match'
        : 'mismatch'
      : null

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'h-10 rounded-lg pr-10',
            matchState === 'match' &&
              'ring-1 ring-emerald-500/35 focus-visible:ring-emerald-500/40',
            matchState === 'mismatch' &&
              'ring-1 ring-destructive/30 focus-visible:ring-destructive/35',
          )}
          disabled={disabled}
          autoComplete={autoComplete}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tabIndex={-1}
          disabled={disabled}
          className={cn(
            'absolute top-1/2 right-1 size-8 -translate-y-1/2',
            'text-muted-foreground hover:text-foreground',
          )}
          aria-label={visible ? t('password.hidePassword') : t('password.showPassword')}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeOff className="size-3.5" strokeWidth={1.75} />
          ) : (
            <Eye className="size-3.5" strokeWidth={1.75} />
          )}
        </Button>
      </div>
      {matchState === 'match' ? (
        <p className="flex items-center gap-1 text-[0.6875rem] text-emerald-700 dark:text-emerald-300">
          <Check className="size-3" strokeWidth={2} />
          {t('password.matchOk')}
        </p>
      ) : null}
      {matchState === 'mismatch' ? (
        <p className="flex items-center gap-1 text-[0.6875rem] text-destructive">
          <X className="size-3" strokeWidth={2} />
          {t('password.issue.mismatch')}
        </p>
      ) : null}
      {showStrength && value ? (
        <PasswordStrengthMeter
          strength={check!.strength}
          score={check!.score}
          issues={check!.issues.filter(
            (i) => i !== 'mismatch' && i !== 'same_as_current',
          )}
        />
      ) : null}
    </div>
  )
}

export function PasswordStrengthMeter({
  strength,
  score,
  issues,
}: {
  strength: PasswordStrength
  score: number
  issues: PasswordIssue[]
}) {
  const { t } = useTranslation()
  const segments = 3
  const filled = strength === 'strong' ? 3 : strength === 'fair' ? 2 : score > 0 ? 1 : 0

  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1">
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-200',
                i < filled
                  ? strength === 'strong'
                    ? 'bg-emerald-500'
                    : strength === 'fair'
                      ? 'bg-amber-500'
                      : 'bg-destructive/80'
                  : 'bg-muted/70',
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            'shrink-0 text-[0.6875rem] font-medium',
            strength === 'strong' && 'text-emerald-700 dark:text-emerald-300',
            strength === 'fair' && 'text-amber-800 dark:text-amber-200',
            strength === 'weak' && 'text-destructive',
          )}
        >
          {t(`password.strength.${strength}`)}
        </span>
      </div>
      {issues.length > 0 ? (
        <ul className="space-y-0.5 text-[0.6875rem] text-muted-foreground">
          {issues.slice(0, 2).map((issue) => (
            <li key={issue}>· {t(`password.issue.${issue}`)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Quiet checklist of password rules (always visible). */
export function PasswordPolicyHints({ className }: { className?: string }) {
  const { t } = useTranslation()
  const items = [
    t('password.rule.length'),
    t('password.rule.letterDigit'),
    t('password.rule.notCommon'),
  ]
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {items.map((text) => (
        <li
          key={text}
          className={cn(
            'rounded-md bg-muted/40 px-2 py-1',
            'text-[0.6875rem] text-muted-foreground',
            'ring-1 ring-border/50',
          )}
        >
          {text}
        </li>
      ))}
    </ul>
  )
}
