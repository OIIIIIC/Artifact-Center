import { createHash } from 'node:crypto'
import { sql, type SQLWrapper } from 'drizzle-orm'
import { z } from 'zod'

const cursorSchema = z.object({
  scope: z.string(),
  value: z.string().max(500),
  id: z.string().uuid(),
})
export function readCollectionPage(query: Record<string, string>, scope: string) {
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .parse(query.limit ?? 24)
  const scopeKey = createHash('sha256').update(scope).digest('hex').slice(0, 24)
  const cursor = query.cursor
    ? cursorSchema.parse(
        JSON.parse(Buffer.from(query.cursor.slice(0, 2000), 'base64url').toString()),
      )
    : null
  if (cursor && cursor.scope !== scopeKey)
    throw new Error('Cursor does not match filters')
  return { limit, cursor, scope: scopeKey }
}
export type CollectionPage = ReturnType<typeof readCollectionPage>

export function afterCursor(
  page: CollectionPage,
  column: SQLWrapper,
  id: SQLWrapper,
  ascending = false,
  timestamp = false,
) {
  if (!page.cursor) return undefined
  if (timestamp) {
    const iso = page.cursor.value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
    if (!z.string().datetime({ offset: true }).safeParse(iso).success)
      throw new Error('Invalid cursor timestamp')
  }
  return ascending
    ? sql`(${column}, ${id}) > (${page.cursor.value}, ${page.cursor.id})`
    : sql`(${column}, ${id}) < (${page.cursor.value}, ${page.cursor.id})`
}

export function nextCursor(
  page: CollectionPage,
  rows: { id: string; cursorValue: string }[],
) {
  if (rows.length <= page.limit) return null
  const last = rows[page.limit - 1]
  return Buffer.from(
    JSON.stringify({ scope: page.scope, value: last.cursorValue, id: last.id }),
  ).toString('base64url')
}
