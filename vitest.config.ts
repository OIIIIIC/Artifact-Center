import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // jsdom for DOM APIs (React component rendering)
    environment: 'jsdom',
    // Global test APIs (describe, it, expect, vi) — no imports needed
    globals: true,
    // Setup file: extend expect with jest-dom matchers
    setupFiles: ['./src/test/setup.ts'],
    // Include only frontend tests (exclude apps/ from root config)
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // CSS imports in components should not break tests
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },
})
