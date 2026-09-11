import assert from 'node:assert/strict'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { build } from 'vite'

// Run: node e2e/workspace-favorite.mjs (requires Playwright Chromium).
// Render the production component and CSS: DOM-only clicks cannot detect overlays.
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FavoriteActionsProvider } from '../../../src/features/applications/favorite-actions-provider.tsx';
import { usePersonalWorkspace } from '../../../src/features/applications/use-personal-workspace.ts';
import { PersonalWorkspace } from '../../../src/features/applications/personal-workspace.tsx';
import '../../../src/i18n/index.ts';
import '../../../src/index.css';
const application = {
  id: 'favorite-test', name: 'Favorite test', description: 'Test application',
  platform: 'android', region: { id: 'test', name: 'Test' },
  latestVersion: '1.0.0', updatedAt: '2026-09-11T00:00:00Z',
};
function Fixture() {
  const location = useLocation();
  const { workspace, toggleFavorite } = usePersonalWorkspace();
  const favorite = workspace.favoriteApplicationIds.includes(application.id);
  return React.createElement(React.Fragment, null,
    React.createElement('output', { id: 'location' }, location.pathname),
    React.createElement('output', { id: 'favorite' }, String(favorite)),
    React.createElement(PersonalWorkspace, {
      applications: [application],
      workspace, onToggleFavorite: (id) => toggleFavorite(id, application.name), onRestoreFilters: () => {},
    }));
}
createRoot(document.getElementById('root')).render(
  React.createElement(QueryClientProvider, { client: new QueryClient({defaultOptions: {queries: {retry: false}}}) },
    React.createElement(FavoriteActionsProvider, null,
      React.createElement(MemoryRouter, { initialEntries: ['/workspace'] }, React.createElement(Fixture)))));
`

const fixtureDirectory = 'output/playwright/workspace-favorite'
await mkdir(fixtureDirectory, { recursive: true })
await writeFile(`${fixtureDirectory}/fixture.js`, fixture)
const result = await build({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    write: false,
    minify: false,
    sourcemap: false,
    lib: {
      entry: `${fixtureDirectory}/fixture.js`,
      formats: ['es'],
      fileName: 'fixture',
    },
  },
})
const assets = result[0].output
const javascript = assets.find((asset) => asset.type === 'chunk').code
const css = assets
  .filter((asset) => asset.fileName.endsWith('.css'))
  .map((asset) => asset.source)
  .join('\n')
const server = createServer((request, response) => {
  const isScript = request.url === '/fixture.js'
  response.setHeader('Content-Type', isScript ? 'text/javascript' : 'text/html')
  response.end(
    isScript
      ? javascript
      : `<html><head><style>${css}</style></head><body><div id="root" style="max-width:1100px;padding:40px"></div><script type="module" src="/fixture.js"></script></body></html>`,
  )
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] })
  const address = server.address()
  for (const reducedMotion of ['reduce', 'no-preference']) {
    const page = await browser.newPage({
      reducedMotion,
      viewport: { width: 1440, height: 900 },
    })
    page.setDefaultTimeout(15000)
    page.on('requestfailed', (request) => console.error(request.url(), request.failure()))
    page.on('pageerror', (error) => console.error(error.message))
    let savedFavorite = true
    await page.route('**/api/workspace**', async (route) => {
      if (route.request().method() === 'PUT') {
        savedFavorite = route.request().postDataJSON().favorite
        await route.fulfill({ json: { favorite: savedFavorite } })
      } else {
        await route.fulfill({
          json: {
            favoriteApplicationIds: savedFavorite ? ['favorite-test'] : [],
            recentApplications: [],
            preferences: {
              platform: 'all',
              sort: 'updated',
              regionId: null,
              query: '',
              favoriteOnly: false,
              responsibleOnly: false,
            },
          },
        })
      }
    })
    await page.goto(`http://127.0.0.1:${address.port}/`, {
      waitUntil: 'domcontentloaded',
    })
    const card = page.getByRole('article')
    const star = card.getByRole('button')
    await star.waitFor()
    // Wait for the entry/hover animations, then use physical pointer hit testing.
    await page.waitForTimeout(700)
    await star.hover({ force: true })
    await page.waitForTimeout(700)
    const box = await star.boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('#favorite')).toHaveText('false')
    assert.equal(
      await page.locator('#location').textContent(),
      '/workspace',
      `${reducedMotion}: star must not open details`,
    )
    await expect(card).toHaveCount(0)
    const undo = page.getByRole('button', { name: '撤销', exact: true })
    await expect(undo).toBeVisible()
    const capsule = undo.locator('..')
    const capsuleBox = await capsule.boundingBox()
    assert.ok(capsuleBox.y < 100, 'undo must appear at the top')
    assert.ok(
      Math.abs(
        capsuleBox.x +
          capsuleBox.width / 2 -
          (await page.evaluate(() => document.documentElement.clientWidth)) / 2,
      ) < 2,
      'undo must be centered',
    )
    await capsule.hover()
    await page.waitForTimeout(5200)
    await expect(undo).toBeVisible()
    await page.screenshot({
      path: `output/playwright/workspace-undo-${reducedMotion}.png`,
    })
    if (reducedMotion === 'no-preference') {
      const samples = await undo.evaluate(
        (button) =>
          new Promise((resolve) => {
            const surface = button.parentElement.parentElement
            const values = []
            button.click()
            const sample = () => {
              if (!surface.isConnected) return resolve(values)
              values.push(Number(getComputedStyle(surface).opacity))
              requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
          }),
      )
      assert.ok(
        samples.some((value) => value > 0 && value < 1),
        'undo must fade out before removal',
      )
    } else {
      await undo.click()
    }
    await expect(card).toHaveCount(1)
    await page.reload()
    await page.getByRole('article').getByRole('link').click()
    // Router transitions may render after Playwright has completed the click.
    await expect(page.locator('#location')).toHaveText('/applications/favorite-test')
    await page.reload()
    await star.waitFor()
    await page.waitForTimeout(700)
    const cardBox = await card.boundingBox()
    await page.mouse.click(cardBox.x + 38, cardBox.y + 38)
    await expect(page.locator('#location'), 'avatar area must open details').toHaveText(
      '/applications/favorite-test',
    )
    await page.reload()
    await star.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#favorite'), 'keyboard must remove favorite').toHaveText(
      'false',
    )
    assert.equal(await page.locator('#location').textContent(), '/workspace')
    await expect(undo).toBeVisible()
    await undo.focus()
    await page.keyboard.press('Enter')
    await expect(card).toHaveCount(1)
    await star.click()
    await expect(undo).toBeVisible()
    await page.mouse.move(1400, 850)
    await expect(undo).toHaveCount(0, { timeout: 7000 })
    assert.equal(savedFavorite, false, 'expiry must keep the removal')
    console.log(
      `PASS (${reducedMotion}): pointer/keyboard remove favorite; card/avatar open details`,
    )
    await page.close()
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser?.close()
  server.close()
  await rm(`${fixtureDirectory}/fixture.js`)
}
