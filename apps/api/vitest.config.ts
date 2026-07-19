import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node environment for backend tests (no DOM needed)
    environment: 'node',
    // Global test APIs (describe, it, expect, vi)
    globals: true,
    // Include only backend tests
    include: ['src/**/*.{test,spec}.ts'],
  },
})
