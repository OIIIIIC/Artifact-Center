import { expect, it, vi } from 'vitest'
import {
  apiListApplications,
  apiGetApplication,
  apiApplicationPage,
} from './applications'
import { previewDistributionFilename } from '@/lib/artifact-filename'
const request = vi.hoisted(() => vi.fn())
vi.mock('@/services/http', () => ({ request }))
it.each(['shiyan', undefined])(
  'carries project prefix %s from API responses to upload preview',
  async (projectCode) => {
    const response = {
      id: 'app1',
      applicationCode: 'care',
      region: { code: 'product' },
      projectCode,
    }
    request.mockResolvedValue({
      items: [response],
      total: 1,
      nextCursor: null,
      application: response,
    })
    const [listed] = await apiListApplications()
    const detail = await apiGetApplication('app1')
    const paged = (await apiApplicationPage({})).items[0]
    for (const application of [listed, detail, paged]) {
      expect(application.projectCode).toBe(projectCode)
      expect(
        previewDistributionFilename({
          application,
          version: '1',
          buildNumber: '1',
          channel: 'stable',
          originalFilename: 'app.apk',
        }),
      ).toBe(`${projectCode ?? 'product'}_care_v1_b1_stable.apk`)
    }
  },
)
