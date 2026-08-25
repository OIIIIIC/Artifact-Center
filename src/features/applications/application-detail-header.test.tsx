import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'
import { ApplicationDetailHeader } from './application-detail-header'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'zh-CN' },
    }),
  }
})

vi.mock('@/features/applications/use-download-artifact', () => ({
  useDownloadArtifact: () => ({
    download: vi.fn(),
    isBusy: () => false,
    downloadConfirmation: null,
  }),
}))

const application: Application = {
  id: 'app-1',
  name: '看护外屏',
  applicationCode: 'care-display',
  description: '权限显示测试',
  packageName: 'com.example.care',
  platform: 'android',
  region: {
    id: 'region-1',
    code: 'cs',
    name: '三沙',
    sortOrder: 0,
    enabled: true,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  },
  latestVersion: '1.0.0',
  updatedAt: '2026-08-19T00:00:00.000Z',
  createdAt: '2026-08-19T00:00:00.000Z',
  owner: '维护者',
  artifactCount: 1,
  status: 'active',
  repository: '',
}

const latest: Artifact = {
  id: 'artifact-1',
  applicationId: application.id,
  version: '1.0.0',
  buildNumber: '100',
  platform: 'android',
  type: 'apk',
  sizeBytes: 1024,
  uploadedAt: '2026-08-19T00:00:00.000Z',
  uploader: '维护者',
  status: 'latest',
  channel: 'stable',
  releaseNotes: '',
  filename: 'care-display-1.0.0.apk',
}

function renderHeader(canManage: boolean) {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <ApplicationDetailHeader
          application={application}
          latest={latest}
          canManage={canManage}
        />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('ApplicationDetailHeader permissions', () => {
  it('hides share and upload actions from application viewers', () => {
    renderHeader(false)

    expect(screen.queryByRole('button', { name: 'share.action' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'detail.uploadArtifact' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /detail.downloadLatestVersion/ }),
    ).toBeInTheDocument()
  })

  it('shows application actions to application maintainers', () => {
    renderHeader(true)

    expect(screen.getByRole('button', { name: 'share.action' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'detail.uploadArtifact' }),
    ).toBeInTheDocument()
  })
})
