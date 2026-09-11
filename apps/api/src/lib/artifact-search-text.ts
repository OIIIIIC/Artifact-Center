import { sql, type SQLWrapper } from 'drizzle-orm'

/** Indexed candidate text. The original per-field predicates still verify matches. */
export function artifactSearchText(columns: {
  version: SQLWrapper
  filename: SQLWrapper
  originalFilename: SQLWrapper
  buildNumber: SQLWrapper
  uploaderName: SQLWrapper
  releaseNotes: SQLWrapper
}) {
  return sql`(${columns.version} || ' ' || ${columns.filename} || ' ' || ${columns.originalFilename} || ' ' || ${columns.buildNumber} || ' ' || ${columns.uploaderName} || ' ' || ${columns.releaseNotes})`
}
