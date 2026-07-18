import { ApiError, getConnectivityStatusForError } from '@/services/http'

export function getRequestErrorMessage(
  error: unknown,
  messages: { offline: string; unavailable: string; fallback: string },
) {
  const connectivity = getConnectivityStatusForError(error)
  if (connectivity === 'offline') return messages.offline
  if (connectivity === 'unavailable') return messages.unavailable
  return error instanceof ApiError && error.message ? error.message : messages.fallback
}
