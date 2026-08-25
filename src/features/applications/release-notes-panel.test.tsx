import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Release } from '@/types/release'
import { ReleaseNotesPanel } from './release-notes-panel'

const updateReleaseNotes = vi.fn()

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('@/services/api', () => ({
  apiUpdateReleaseNotes: (...args: unknown[]) => updateReleaseNotes(...args),
}))

const release: Release = {
  id: 'release-1',
  applicationId: 'app-1',
  version: '0.0.2',
  releaseNotes: '初始说明',
  status: 'published',
  createdBy: '维护者',
  publishedAt: '2026-08-25T00:00:00.000Z',
  artifactCount: 1,
  artifactTypes: ['apk'],
}

function renderPanel(canManage: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ReleaseNotesPanel
        releases={[release]}
        applicationId={release.applicationId}
        canManage={canManage}
      />
    </QueryClientProvider>,
  )
}

describe('ReleaseNotesPanel', () => {
  it('only shows the edit action to application maintainers', () => {
    renderPanel(false)

    expect(
      screen.queryByRole('button', { name: 'detail.editReleaseNotes' }),
    ).not.toBeInTheDocument()
  })

  it('updates only the selected release notes', async () => {
    const user = userEvent.setup()
    updateReleaseNotes.mockResolvedValue(undefined)
    renderPanel(true)

    await user.click(screen.getByRole('button', { name: 'detail.editReleaseNotes' }))
    const editor = screen.getByRole('textbox', { name: 'detail.releaseNotesField' })
    await user.clear(editor)
    await user.type(editor, '补充了安装步骤')
    await user.click(screen.getByRole('button', { name: 'detail.saveReleaseNotes' }))

    expect(updateReleaseNotes).toHaveBeenCalledWith(
      release.applicationId,
      release.id,
      '补充了安装步骤',
    )
  })

  it('collapses long release notes until the user expands them', async () => {
    const user = userEvent.setup()
    const longRelease = {
      ...release,
      releaseNotes: '更新说明。'.repeat(200),
    }
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ReleaseNotesPanel
          releases={[longRelease]}
          applicationId={longRelease.applicationId}
          canManage={false}
        />
      </QueryClientProvider>,
    )

    const toggle = screen.getByRole('button', { name: 'detail.releaseNotesExpandFull' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(
      screen.getByRole('button', { name: 'detail.releaseNotesCollapse' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
