import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import type { Application } from '@/types/application'

interface StepSuccessProps {
  application: Application
  version: string
  onAnother: () => void
}

export function StepSuccess({ application, version, onAnother }: StepSuccessProps) {
  const { t } = useTranslation()

  return (
    <div className="flex w-full flex-col items-center py-10 text-center sm:py-14">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border/60">
        <CheckCircle2 className="size-7 text-foreground" strokeWidth={1.5} />
      </div>
      <h2 className="text-[1.25rem] font-semibold tracking-tight text-foreground">
        {t('upload.published')}
      </h2>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{application.name}</span>
        {' · '}
        <span className="font-mono">v{version}</span>
        <br />
        {t('upload.publishedDesc')}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button asChild className="rounded-lg">
          <Link to={`/applications/${application.id}`}>
            {t('upload.viewApplication')}
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-lg border-0 bg-muted/40 ring-1 ring-border/60"
          onClick={onAnother}
        >
          {t('upload.uploadAnother')}
        </Button>
      </div>
    </div>
  )
}
