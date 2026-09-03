import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(packageRoot, 'dist')
const outputFile = resolve(outputDirectory, 'artifact-center-mcp.mjs')

await mkdir(outputDirectory, { recursive: true })
await build({
  entryPoints: [resolve(packageRoot, 'src/index.js')],
  outfile: outputFile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

const digest = createHash('sha256').update(await readFile(outputFile)).digest('hex')
await writeFile(resolve(outputDirectory, 'artifact-center-mcp.sha256'), `${digest}\n`)
console.log(`Built ${outputFile}`)
