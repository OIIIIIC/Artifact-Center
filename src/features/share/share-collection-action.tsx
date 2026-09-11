import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { Product, Project } from '@/types/application'
import { ShareCollectionDialog } from './share-collection-dialog'

/** Keep dialog interaction local so opening it does not rerender the application tree. */
export function ShareCollectionAction({
  product,
  project,
}: {
  product: Product
  project?: Project
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" size="lg" variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="size-3.5" strokeWidth={1.75} />
        {t(project ? 'share.collectionProjectAction' : 'share.collectionAction')}
      </Button>
      {open
        ? createPortal(
            <ShareCollectionDialog
              open
              onOpenChange={setOpen}
              region={product}
              project={project}
            />,
            document.body,
          )
        : null}
    </>
  )
}
