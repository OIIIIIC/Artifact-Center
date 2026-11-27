import { expect, it } from 'vitest'
import { matchesArtifactPattern } from './jenkins-build-client.js'

it.each([
  ['app.apk', '**/*.apk', true],
  ['out/release/app.apk', '**/*.apk', true],
  ['out/release/app.apk', 'out/*.apk', false],
  ['out/a/b/app.tar.gz', 'out/**/app.tar.gz', true],
  ['out/app.tar.gz', 'out/**/app.tar.gz', true],
  ['out/a+b.tar.gz', 'out/a+b.tar.gz', true],
  ['out/aab.tar.gz', 'out/a+b.tar.gz', false],
  ['../app.apk', '**', false],
  ['out/%2e%2e/app.apk', '**', false],
  ['a'.repeat(1000), '*a'.repeat(140) + 'b', false],
])('产物路径 %s 按 %s 匹配为 %s', (path, rule, expected) => {
  expect(matchesArtifactPattern(path, rule)).toBe(expected)
})
