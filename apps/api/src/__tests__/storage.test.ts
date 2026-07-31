import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { env } from '../env.js'
import { absolutePathFor } from '../lib/storage.js'

describe('制品存储路径', () => {
  it('解析后的正常路径保持在存储根目录内', () => {
    const absolute = absolutePathFor('application/artifact.apk')
    const relative = path.relative(path.resolve(env.storagePath), absolute)

    expect(relative).toBe(path.join('application', 'artifact.apk'))
    expect(relative.startsWith('..')).toBe(false)
  })

  it.each(['../files-evil/payload.bin', '../../escape.bin'])(
    '拒绝越过存储根目录：%s',
    (storageKey) => {
      expect(() => absolutePathFor(storageKey)).toThrow('path_traversal')
    },
  )
})
