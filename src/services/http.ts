/**
 * HTTP client placeholder — no backend calls during design-system bootstrap.
 * Extend when API integration starts.
 */

export type HttpError = {
  status: number
  message: string
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
