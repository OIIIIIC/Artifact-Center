import path from 'path'
import { createReadStream, statSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const mcpClientFilename = 'artifact-center-mcp.mjs'
const mcpChecksumFilename = 'artifact-center-mcp.sha256'
const mcpDistributionDirectory = path.resolve(
  __dirname,
  'plugins/artifact-center-mcp/dist',
)

function artifactCenterMcpDistribution(): Plugin {
  return {
    name: 'artifact-center-mcp-distribution',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?', 1)[0]
        const filename = pathname?.startsWith('/downloads/')
          ? pathname.slice('/downloads/'.length)
          : ''
        if (
          (filename !== mcpClientFilename && filename !== mcpChecksumFilename) ||
          (request.method !== 'GET' && request.method !== 'HEAD')
        ) {
          next()
          return
        }

        const source = path.join(mcpDistributionDirectory, filename)
        try {
          const metadata = statSync(source)
          response.statusCode = 200
          response.setHeader(
            'Content-Type',
            filename.endsWith('.sha256')
              ? 'text/plain; charset=utf-8'
              : 'text/javascript',
          )
          response.setHeader('Content-Length', metadata.size)
          response.setHeader('Cache-Control', 'no-cache')
          if (request.method === 'HEAD') {
            response.end()
            return
          }
          createReadStream(source).pipe(response)
        } catch {
          next()
        }
      })
    },
    async closeBundle() {
      const targetDirectory = path.resolve(__dirname, 'dist/downloads')
      await mkdir(targetDirectory, { recursive: true })
      await Promise.all(
        [mcpClientFilename, mcpChecksumFilename].map((filename) =>
          copyFile(
            path.join(mcpDistributionDirectory, filename),
            path.join(targetDirectory, filename),
          ),
        ),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), artifactCenterMcpDistribution()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Frontend uses /api → Artifact Center API
      // Note: Windows may reserve 3001; local .env uses 4001 when needed.
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
