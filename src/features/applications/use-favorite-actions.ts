import { createContext, useContext } from 'react'

type FavoriteActions = {
  toggleFavorite: (applicationId: string, name?: string) => void
  favoritePendingId?: string
}
export const FavoriteActionsContext = createContext<FavoriteActions | null>(null)

export function useFavoriteActions() {
  const actions = useContext(FavoriteActionsContext)
  if (!actions) throw new Error('FavoriteActionsProvider is required')
  return actions
}
