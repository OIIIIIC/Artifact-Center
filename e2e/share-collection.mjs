// Run: node e2e/share-collection.mjs
// Build the real page and toast with production CSS; intercept all API writes.
// Event Timing is diagnostic, not a hardware-independent pass/fail threshold.
import assert from 'node:assert/strict'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { chromium, expect } from '@playwright/test'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = `${root}/output/playwright/share-collection`
await mkdir(directory, { recursive: true })
await writeFile(
  `${directory}/fixture.tsx`,
  `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryProvider } from '../../../src/providers/query-provider';
import { ThemeProvider } from '../../../src/providers/theme-provider';
import { TooltipProvider } from '../../../src/components/ui/tooltip';
import { Toaster } from '../../../src/components/ui/sonner';
import { ApplicationsPage } from '../../../src/routes/applications-page';
import { useAuthStore } from '../../../src/store/auth-store';
import '../../../src/i18n';
import '../../../src/index.css';
useAuthStore.setState({user: {id:'fixture', name:'Test', email:'test@example.test',role:'admin'},bootstrapped:true});
createRoot(document.getElementById('root')!).render(<QueryProvider><ThemeProvider><TooltipProvider><MemoryRouter initialEntries={['/applications?product=p1&project=henan']}><ApplicationsPage /><Toaster /></MemoryRouter></TooltipProvider></ThemeProvider></QueryProvider>);
`,
)
const result = await build({
  configFile: false,
  root,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': `${root}/src` } },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api'),
  },
  build: {
    write: false,
    minify: true,
    lib: { entry: `${directory}/fixture.tsx`, formats: ['es'], fileName: 'fixture' },
  },
})
const assets = result[0].output
const js = assets.find((asset) => asset.type === 'chunk').code
const css = assets
  .filter((asset) => asset.fileName.endsWith('.css'))
  .map((asset) => asset.source)
  .join('\n')
const server = createServer((request, response) => {
  response.setHeader(
    'Content-Type',
    request.url === '/fixture.js'
      ? 'text/javascript'
      : request.url === '/fixture.css'
        ? 'text/css'
        : 'text/html',
  )
  response.end(
    request.url === '/fixture.js'
      ? js
      : request.url === '/fixture.css'
        ? css
        : '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
  )
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const product = {
  id: 'p1',
  name: '智慧业务平台',
  code: 'platform',
  sortOrder: 0,
  enabled: true,
  createdAt: '2026-09-11T00:00:00Z',
  updatedAt: '2026-09-11T00:00:00Z',
}
const projects = [
  { id: 'henan', productId: 'p1', name: '河南省项目' },
  { id: 'xiaogan', productId: 'p1', name: '孝感项目' },
].map((p) => ({
  ...p,
  sortOrder: 0,
  enabled: true,
  isDefault: false,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
}))
const makeApp = (i) => ({
  id: `app-${i}`,
  name: i < 5 ? '河南看护屏' : `孝感应用 ${i}`,
  applicationCode: `app${i}`,
  description: '测试安装包',
  packageName: `com.test.app${i}`,
  platform: 'android',
  region: product,
  projectId: i < 5 ? 'henan' : 'xiaogan',
  projectName: i < 5 ? '河南省项目' : '孝感项目',
  latestVersion: '1.0.0',
  latestArtifactUploadedAt: product.updatedAt,
  updatedAt: product.updatedAt,
  createdAt: product.createdAt,
  owner: 'Test',
  accessRole: 'admin',
  artifactCount: 4,
  status: 'active',
  repository: '',
  members: [],
})
const applications = Array.from({ length: 1000 }, (_, i) => makeApp(i))
const summary = {
  total: 1000,
  productCounts: { p1: 1000 },
  projectCounts: { henan: 5, xiaogan: 995 },
  maintainableCounts: { p1: 1000 },
}
const results = []
let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] })
  for (const viewport of [
    { width: 2560, height: 1430 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport, colorScheme: 'dark' })
    const errors = [],
      requests = []
    const createdCollections = []
    await page.addInitScript(() => {
      // Match internal HTTP: exercise the real selection-copy fallback.
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: undefined,
      })
      window.copiedTexts = []
      document.addEventListener('copy', () => {
        window.copiedTexts.push(
          document.activeElement?.value ?? document.getSelection()?.toString(),
        )
      })
    })
    let preferences = {
      platform: 'all',
      sort: 'updated',
      regionId: 'p1',
      projectId: 'henan',
      query: '',
      favoriteOnly: false,
      responsibleOnly: false,
      collapsed: false,
    }
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url()),
        params = url.searchParams
      let json
      if (url.pathname === '/api/settings/regions') json = { items: [product], total: 1 }
      else if (url.pathname === '/api/settings/projects') json = { items: projects }
      else if (url.pathname === '/api/applications/summary') json = summary
      else if (url.pathname === '/api/workspace/preferences') {
        preferences = { ...preferences, ...route.request().postDataJSON() }
        json = { preferences }
      } else if (url.pathname === '/api/workspace')
        json = { favoriteApplicationIds: [], recentApplications: [], preferences }
      else if (url.pathname === '/api/applications') {
        requests.push(Object.fromEntries(params))
        const items = applications.filter(
          (a) => !params.get('project') || a.projectId === params.get('project'),
        )
        const limit = Number(params.get('limit') ?? 1000),
          offset = Number(params.get('cursor') ?? 0)
        json = {
          items: items.slice(offset, offset + limit),
          total: items.length,
          nextCursor: offset + limit < items.length ? String(offset + limit) : null,
        }
        if (params.has('shareable'))
          await new Promise((resolve) => setTimeout(resolve, 120))
      } else if (url.pathname === '/api/shares') {
        createdCollections.push(route.request().postDataJSON())
        await new Promise((resolve) => setTimeout(resolve, 80))
        json = { share: { token: 'fixture-share-token' } }
      } else
        throw new Error(
          `Unexpected fixture API: ${route.request().method()} ${url.pathname}`,
        )
      await route.fulfill({ json })
    })
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await expect(
      page.getByRole('heading', { name: '河南省项目', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /河南看护屏/ }).first()).toBeVisible()
    await page.waitForTimeout(600)
    const requestCount = requests.length
    await page.evaluate(() => {
      window.shareProbe = { started: 0, painted: 0, eventDurations: [], longTasks: [] }
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (window.shareProbe.started && e.startTime >= window.shareProbe.started)
            window.shareProbe.longTasks.push(e.duration)
      }).observe({ type: 'longtask', buffered: false })
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (
            e.interactionId &&
            window.shareProbe.started &&
            e.startTime >= window.shareProbe.started - 5
          )
            window.shareProbe.eventDurations.push(e.duration)
      }).observe({ type: 'event', durationThreshold: 16 })
      document.addEventListener(
        'click',
        (event) => {
          if (event.target.closest('button')?.textContent.includes('分享项目应用')) {
            window.shareProbe.started = performance.now()
            const observer = new MutationObserver(() => {
              if (document.querySelector('[role="dialog"]')) {
                observer.disconnect()
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => {
                    window.shareProbe.painted =
                      performance.now() - window.shareProbe.started
                  }),
                )
              }
            })
            observer.observe(document.body, { childList: true, subtree: true })
          }
        },
        { capture: true },
      )
    })
    await page.getByRole('button', { name: '分享项目应用' }).click()
    const dialog = page.getByRole('dialog', { name: '创建项目分享清单' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox')).toHaveValue('河南省项目安装包')
    await expect(dialog.getByRole('checkbox')).toHaveCount(5)
    await expect(dialog.getByRole('checkbox').first()).toContainText('河南看护屏')
    await page.waitForTimeout(200)
    const probe = await page.evaluate(() => window.shareProbe)
    const openingRequests = requests.slice(requestCount)
    assert.equal(openingRequests.length, 1)
    assert.equal(openingRequests[0].project, 'henan')
    assert.equal(openingRequests[0].limit, '20')
    assert.equal(openingRequests[0].shareable, '1')
    assert.ok(requests.every((request) => request.limit))
    const overlayBox = await dialog.boundingBox()
    assert.equal(overlayBox.x, 0)
    assert.equal(overlayBox.y, 0)
    assert.equal(
      overlayBox.width,
      await page.evaluate(() => document.documentElement.clientWidth),
    )
    await dialog.getByRole('button', { name: '全选', exact: true }).click()
    await expect(dialog.getByText('已选 5 个')).toBeVisible()
    await page.evaluate(() => {
      const startedAt = performance.now()
      window.copyEvents = []
      window.copyLongTasks = []
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (e.interactionId && e.startTime >= startedAt)
            window.copyEvents.push({
              name: e.name,
              duration: e.duration,
              processing: e.processingEnd - e.processingStart,
            })
      }).observe({ type: 'event', durationThreshold: 16 })
      new PerformanceObserver((list) => {
        window.copyLongTasks.push(...list.getEntries().map((e) => e.duration))
      }).observe({ type: 'longtask' })
    })
    await dialog.getByRole('button', { name: '生成并复制清单链接' }).click()
    await expect(dialog.getByRole('button', { name: '再次复制' })).toBeVisible()
    await expect(page.locator('[data-sonner-toast]').last()).toContainText(
      '分享清单已生成并复制',
    )
    const expectedUrl = `http://127.0.0.1:${server.address().port}/d/fixture-share-token`
    assert.deepEqual(createdCollections, [
      {
        title: '河南省项目安装包',
        regionId: 'p1',
        items: applications
          .slice(0, 5)
          .map((a) => ({ applicationId: a.id, mode: 'artifact' })),
        expiresInDays: 7,
      },
    ])
    assert.deepEqual(await page.evaluate(() => window.copiedTexts), [expectedUrl])
    await page.waitForTimeout(400)
    const copyEvents = await page.evaluate(() => window.copyEvents)
    const copyLongTasks = await page.evaluate(() => window.copyLongTasks)
    await dialog.getByRole('button', { name: '再次复制' }).click()
    await expect(page.locator('[data-sonner-toast]').last()).toContainText('链接已复制')
    assert.equal(createdCollections.length, 1, 'Copy again must reuse the generated link')
    assert.deepEqual(await page.evaluate(() => window.copiedTexts), [
      expectedUrl,
      expectedUrl,
    ])
    await page.screenshot({ path: `${directory}/share-${viewport.width}.png` })
    await dialog.getByRole('button', { name: '关闭' }).click()
    await expect(dialog).not.toBeVisible()
    if (viewport.width > 1000) {
      await page.getByRole('button', { name: '智慧业务平台', exact: true }).click()
      await page.getByRole('button', { name: '分享产品应用' }).click()
      const productDialog = page.getByRole('dialog', { name: '创建产品分享清单' })
      await expect(productDialog.getByRole('checkbox')).toHaveCount(20)
      await productDialog.getByRole('button', { name: '下一页' }).click()
      await expect(productDialog.getByRole('checkbox').first()).toContainText(
        '孝感应用 20',
      )
      await expect(productDialog.getByRole('checkbox')).toHaveCount(20)
    }
    assert.deepEqual(errors, [])
    results.push({
      viewport,
      syntheticApplications: 1000,
      openingRequests,
      mountedCandidates: 5,
      copyEvents,
      copyLongTasks,
      twoAnimationFramesAfterDialogMs: Number(probe.painted.toFixed(1)),
      clickEventDurations: probe.eventDurations,
      longTasks: probe.longTasks,
    })
    await page.close()
  }
  await writeFile(`${directory}/result.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
