import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { FavoriteActionsContext } from './use-favorite-actions'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { UndoCapsule } from '@/components/feedback/undo-capsule'
import { queryKeys } from '@/lib/query-keys'
import { apiSetApplicationFavorite, type PersonalWorkspace } from '@/services/api'

type FavoriteChange = {
  applicationId: string
  name?: string
  favorite: boolean
  restoreOrder?: string[]
}
type UndoEntry = FavoriteChange & { order: string[]; key: number }
/** Restore relative to surviving neighbours, even after other favorites change. */
function withFavorite(ids: string[], id: string, favorite: boolean, order?: string[]) {
  const next = ids.filter((item) => item !== id)
  if (!favorite) return next
  const following = order
    ?.slice(order.indexOf(id) + 1)
    .find((item) => next.includes(item))
  const preceding = order
    ?.slice(0, order.indexOf(id))
    .reverse()
    .find((item) => next.includes(item))
  const index = following
    ? next.indexOf(following)
    : preceding
      ? next.indexOf(preceding) + 1
      : order
        ? next.length
        : 0
  next.splice(index, 0, id)
  return next
}

export function FavoriteActionsProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const reduceMotion = useReducedMotion()
  const { t } = useTranslation()
  const [entries, setEntries] = useState<UndoEntry[]>([])
  const pending = useRef(new Set<string>())
  const sequence = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const dismiss = (id: string) =>
    setEntries((current) => current.filter((item) => item.applicationId !== id))
  const mutation = useMutation({
    mutationKey: ['workspace-favorite'],
    mutationFn: (change: FavoriteChange) =>
      apiSetApplicationFavorite(
        change.applicationId,
        change.favorite,
        Boolean(change.restoreOrder),
      ),
    onMutate: async (change) => {
      await client.cancelQueries({ queryKey: queryKeys.personalWorkspace })
      const previous = client.getQueryData<PersonalWorkspace>(queryKeys.personalWorkspace)
      client.setQueryData<PersonalWorkspace>(
        queryKeys.personalWorkspace,
        (current) =>
          current && {
            ...current,
            favoriteApplicationIds: withFavorite(
              current.favoriteApplicationIds,
              change.applicationId,
              change.favorite,
              change.restoreOrder,
            ),
          },
      )
      return { order: previous?.favoriteApplicationIds ?? [] }
    },
    onError: (_error, change, context) => {
      if (!mounted.current) return
      // Roll back this application only; preserve other concurrent edits.
      client.setQueryData<PersonalWorkspace>(
        queryKeys.personalWorkspace,
        (current) =>
          current && {
            ...current,
            favoriteApplicationIds: withFavorite(
              current.favoriteApplicationIds,
              change.applicationId,
              context?.order.includes(change.applicationId) ?? false,
              context?.order,
            ),
          },
      )
      toast.error(t('applications.workspace.favoriteUpdateFailed'), {
        position: 'top-center',
      })
    },
    onSettled: async (_data, error, change, context) => {
      if (!mounted.current) return
      if (client.isMutating({ mutationKey: ['workspace-favorite'] }) === 1) {
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.personalWorkspace }),
          client.invalidateQueries({ queryKey: ['applications', 'page'] }),
        ])
      }
      pending.current.delete(change.applicationId)
      if (!mounted.current || error || change.favorite) return
      setEntries((current) => [
        ...current.filter((item) => item.applicationId !== change.applicationId),
        {
          ...change,
          order: context?.order ?? [],
          key: ++sequence.current,
        },
      ])
    },
  })
  const apply = (change: FavoriteChange) => {
    if (pending.current.has(change.applicationId)) return
    pending.current.add(change.applicationId)
    dismiss(change.applicationId)
    mutation.mutate(change)
  }

  return (
    <FavoriteActionsContext.Provider
      value={{
        toggleFavorite: (applicationId, name) =>
          apply({
            applicationId,
            name,
            favorite: !client
              .getQueryData<PersonalWorkspace>(queryKeys.personalWorkspace)
              ?.favoriteApplicationIds.includes(applicationId),
          }),
        favoritePendingId: mutation.isPending
          ? mutation.variables?.applicationId
          : undefined,
      }}
    >
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-[max(4.5rem,env(safe-area-inset-top))] z-[80] flex flex-col items-center gap-2 px-4">
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.div
                key={entry.key}
                layout={reduceMotion ? false : 'position'}
                className="max-w-full"
                initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
              >
                <UndoCapsule
                  message={
                    entry.name
                      ? t('applications.workspace.favoriteRemovedNamed', {
                          name: entry.name,
                        })
                      : t('applications.workspace.favoriteRemoved')
                  }
                  onExpire={() => dismiss(entry.applicationId)}
                  onUndo={() =>
                    apply({
                      applicationId: entry.applicationId,
                      favorite: true,
                      restoreOrder: entry.order,
                    })
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </FavoriteActionsContext.Provider>
  )
}
