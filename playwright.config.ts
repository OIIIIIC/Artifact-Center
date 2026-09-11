import { defineConfig, devices } from '@playwright/test'

/**
 * The suite deliberately does not start services. It only exercises an already
 * running local Artifact Center instance after its own readiness preflight.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /core-journey\.spec\.ts/,
  outputDir: 'output/e2e/test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['./e2e/core-journey/redacting-reporter.ts'],
    ['list'],
    ['json', { outputFile: 'output/e2e/core-journey-report.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5178',
    ...devices['Desktop Chrome'],
    acceptDownloads: true,
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
    headless: process.env.E2E_HEADED !== '1',
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'terra-core-e2e',
    },
  ],
})
