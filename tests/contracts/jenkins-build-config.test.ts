import { beforeEach, expect, it, vi } from 'vitest'
import { applicationBuildInput } from '../../apps/api/src/lib/jenkins'
import { request } from '@/services/http'
import {
  apiGetApplicationBuildConfig,
  apiSaveApplicationBuildConfig,
  apiTestApplicationBuildConfig,
} from '../../src/services/api/jenkins'

vi.mock('@/services/http', () => ({ request: vi.fn() }))

const applicationId = 'be3e79a5-8787-4d85-9eca-3cb61d5de457'
const editable = {
  enabled: true,
  jobPath: 'henan',
  artifactPattern: 'artifacts/*.tar.gz',
  parameters: [
    { name: 'project', value: 'henan' },
    { name: 'buildMode', value: 'test' },
    { name: 'buildApps', value: 'frieren' },
  ],
  outputTargets: [],
  revision: 2,
}
const savedRow = {
  ...editable,
  applicationId,
  createdAt: '2026-10-13T01:00:00.000Z',
  updatedAt: '2026-10-13T01:00:00.000Z',
}

beforeEach(() => {
  vi.mocked(request).mockReset()
  vi.mocked(request).mockImplementation(async (_path, options) => {
    if (!options?.method) return { config: savedRow, connectionReady: true }
    // Exercise the actual strict API contract, rather than accepting every mocked payload.
    const parsed = applicationBuildInput.safeParse(options.body)
    if (!parsed.success) throw new Error(`请求参数不正确: ${parsed.error.message}`)
    return options.method === 'PUT'
      ? { config: { ...savedRow, ...parsed.data, revision: parsed.data.revision + 1 } }
      : { ok: true, fullName: parsed.data.jobPath, parameters: [] }
  })
})

it('已保存的配置不作修改，直接校验通过真实 API 请求契约', async () => {
  const { config } = await apiGetApplicationBuildConfig(applicationId)
  await expect(
    apiTestApplicationBuildConfig(applicationId, config!),
  ).resolves.toMatchObject({ ok: true })
  expect(request).toHaveBeenLastCalledWith(expect.stringContaining('/test'), {
    method: 'POST',
    body: editable,
  })
})

it('保存、返回数据库记录、再次校验和保存时保留双产物目标与版本', async () => {
  const { config } = await apiGetApplicationBuildConfig(applicationId)
  const outputTargets = [
    { name: '内屏', pattern: '**/caregiver-inner-*.apk', applicationId },
    {
      name: '外屏',
      pattern: '**/caregiver-outer-*.apk',
      applicationId: '4a2a5beb-372b-4457-b414-dbd2fa284933',
    },
  ]
  const saved = await apiSaveApplicationBuildConfig(applicationId, {
    ...config!,
    outputTargets,
  })
  await expect(
    apiTestApplicationBuildConfig(applicationId, saved.config),
  ).resolves.toMatchObject({ ok: true })
  await apiSaveApplicationBuildConfig(applicationId, saved.config)
  expect(request).toHaveBeenLastCalledWith(expect.any(String), {
    method: 'PUT',
    body: { ...editable, outputTargets, revision: 3 },
  })
  expect(savedRow.revision).toBe(2)
})
