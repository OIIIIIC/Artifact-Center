import { FormError } from '@/components/feedback'
import { Input } from '@/components/ui/input'
import {
  APPLICATION_FIELD_LIMITS,
  type ApplicationEditableField,
} from '@/lib/application-fields'
import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type EditableField = Exclude<ApplicationEditableField, 'owner'>

export function TextField({
  field,
  label,
  value,
  error,
  mono,
  optional,
  disabled,
  hint,
  onChange,
}: {
  field: EditableField
  label: string
  value: string
  error?: string
  mono?: boolean
  optional?: boolean
  disabled?: boolean
  hint?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1.5">
      <FieldLabel
        label={label}
        value={value}
        max={APPLICATION_FIELD_LIMITS[field]}
        optional={optional ? 'optional' : undefined}
      />
      <Input
        value={value}
        disabled={disabled}
        maxLength={APPLICATION_FIELD_LIMITS[field]}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          mono && 'font-mono text-[0.8125rem]',
          error && 'border-destructive',
        )}
        aria-invalid={Boolean(error) || undefined}
      />
      <FormError message={error} className="[&_p]:text-[0.75rem]" />
      {!error && hint ? (
        <span className="block text-[0.75rem] leading-relaxed text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

export function FieldLabel({
  label,
  value,
  max,
  optional,
}: {
  label: string
  value: string
  max: number
  optional?: string
}) {
  const { t } = useTranslation()
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="text-[0.8125rem] font-medium text-foreground">
        {label}
        {optional ? (
          <span className="ml-1.5 font-normal text-muted-foreground">
            {t('createApp.optional')}
          </span>
        ) : null}
      </span>
      <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
        {value.length} / {max}
      </span>
    </span>
  )
}

export function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
        active
          ? 'bg-foreground text-background'
          : 'bg-muted/40 text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function InfoCell({
  label,
  children,
  mono,
  className,
}: {
  label: string
  children: ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <dt className="text-[0.6875rem] font-medium text-muted-foreground/75 uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 break-words text-[0.875rem] text-foreground',
          mono && 'font-mono text-[0.8125rem] text-muted-foreground',
        )}
      >
        {children}
      </dd>
    </div>
  )
}
