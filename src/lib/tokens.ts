/**
 * JS-side Design Token references.
 * Prefer CSS variables / Tailwind classes in UI.
 * Use this module for animation configs and documentation demos.
 */

export const colorTokens = [
  'background',
  'surface',
  'surface-muted',
  'foreground',
  'primary',
  'secondary',
  'muted',
  'border',
  'border-strong',
  'ring',
  'success',
  'warning',
  'destructive',
  'info',
] as const

export const spacingTokens = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const

export const radiusTokens = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const

export const shadowTokens = ['none', 'xs', 'sm', 'md'] as const

export const motionTokens = {
  hover: 100,
  page: 150,
  modal: 180,
} as const

export const typographyTokens = [
  'display',
  'h1',
  'h2',
  'h3',
  'title',
  'body',
  'caption',
  'label',
  'code',
] as const

export type ColorToken = (typeof colorTokens)[number]
export type TypographyToken = (typeof typographyTokens)[number]
