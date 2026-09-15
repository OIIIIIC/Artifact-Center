import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { repositoryBindingsSchema } from './repository-binding.js'

describe('仓库绑定迁移与数据库筛选', () => {
  it('保留旧应用，并按同一条绑定中的仓库、分支、目录筛选', async () => {
    const db = new PGlite()
    try {
      await db.exec(
        "CREATE TABLE applications (id text PRIMARY KEY); INSERT INTO applications VALUES ('legacy');",
      )
      await db.exec(
        await readFile(
          new URL('../../drizzle/0028_repository_bindings.sql', import.meta.url),
          'utf8',
        ),
      )
      expect(
        (
          await db.query<{ repository_bindings: unknown }>(
            'SELECT repository_bindings FROM applications',
          )
        ).rows[0].repository_bindings,
      ).toEqual([])
      const bindings = repositoryBindingsSchema.parse([
        {
          repository: 'git@git.example:team/app.git',
          branch: 'main',
          directory: 'apps/care',
        },
        { repository: 'https://git.example/team/app', branch: 'beta', directory: '' },
      ])
      await db.query(
        'INSERT INTO applications (id, repository_bindings) VALUES ($1, $2::jsonb)',
        ['bound', JSON.stringify(bindings)],
      )
      const query = (branch: string, directory: string) =>
        db.query<{ id: string }>(
          'SELECT id FROM applications WHERE repository_bindings @> $1::jsonb',
          [
            JSON.stringify([
              { repositoryKey: 'git.example/team/app', branch, directory },
            ]),
          ],
        )
      expect((await query('main', 'apps/care')).rows).toEqual([{ id: 'bound' }])
      expect((await query('main', '')).rows).toEqual([])
      expect((await query('other', 'apps/care')).rows).toEqual([])
    } finally {
      await db.close()
    }
  }, 30_000)
})
