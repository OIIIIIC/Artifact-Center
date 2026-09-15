import { FormError } from '@/components/feedback'
import { Input } from '@/components/ui/input'
import {
  APPLICATION_FIELD_LIMITS,
  type ApplicationEditableField,
} from '@/lib/application-fields'
import { cn } from '@/lib/utils'
import { useId, type ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  const id = useId()
  return (
    <div className="group block min-w-0 space-y-1.5">
      <FieldLabel
        label={label}
        htmlFor={id}
        hint={hint}
        value={value}
        max={APPLICATION_FIELD_LIMITS[field]}
        optional={optional ? 'optional' : undefined}
      />
      <Input
        id={id}
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
      {error ? <FormError message={error} className="[&_p]:text-[0.75rem]" /> : null}
    </div>
  )
}

export function FieldLabel({
  label,
  value,
  max,
  optional,
  htmlFor,
  hint,
}: {
  htmlFor?: string
  hint?: string
  label: string
  value: string
  max: number
  optional?: string
}) {
  const { t } = useTranslation()
  const Label = htmlFor ? 'label' : 'span'
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-foreground">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${label} · ${t('common.help', { defaultValue: '说明' })}`}
                  className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-ring"
                >
                  <CircleHelp className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-72 leading-relaxed">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {optional ? (
          <span className="ml-1.5 font-normal text-muted-foreground">
            {t('createApp.optional')}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'text-[0.6875rem] tabular-nums text-muted-foreground transition-opacity group-focus-within:opacity-100',
          value.length < max * 0.9 && 'opacity-0',
        )}
      >
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
        'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-150 motion-reduce:transition-none',
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
