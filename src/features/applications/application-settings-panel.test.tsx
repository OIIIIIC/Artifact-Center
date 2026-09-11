import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Application } from '@/types/application'
import { ApplicationSettingsPanel } from './application-settings-panel'

const updateApplication = vi.fn()
const deleteApplication = vi.fn()
const auth = { user: { role: 'admin' as 'admin' | 'maintainer' } }
const application: Application = {
  id: 'app-1',
  name: '护理终端',
  applicationCode: 'caregiver',
  description: '护理工作应用',
  packageName: 'com.example.care',
  platform: 'android',
  status: 'active',
  projectId: 'project-1',
  repository: '',
  owner: '负责人',
  artifactCount: 0,
  latestVersion: '1.0.0',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  region: {
    id: 'product-1',
    name: '护理',
    code: 'care',
    enabled: true,
    sortOrder: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
}
vi.mock('@/services/api', () => ({
  apiUpdateApplication: (...args: unknown[]) => updateApplication(...args),
  apiDeleteApplication: (...args: unknown[]) => deleteApplication(...args),
}))
vi.mock('@/store/auth-store', () => ({
  useAuthStore: (select: (state: typeof auth) => unknown) => select(auth),
}))
vi.mock('@/features/regions/use-regions', () => ({
  useRegions: () => ({ regions: [application.region] }),
}))
vi.mock('@/features/products/use-projects', () => ({
  useProjects: () => ({
    projects: [
      { id: 'project-1', productId: 'product-1', name: '默认项目', isDefault: true },
    ],
  }),
}))
vi.mock('@/features/products/project-select', () => ({ ProjectSelect: () => null }))
vi.mock('./application-members-panel', () => ({
  ApplicationMembersPanel: () => <div>成员列表</div>,
}))
vi.mock('./application-appearance-settings', () => ({
  ApplicationAppearanceSettings: () => <div>外观设置</div>,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route
            path="/settings"
            element={<ApplicationSettingsPanel application={application} />}
          />
          <Route path="/" element={<div>应用目录</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('应用设置模块', () => {
  beforeEach(() => {
    auth.user.role = 'admin'
    updateApplication
      .mockReset()
      .mockImplementation(async (_id, values) => ({ ...application, ...values }))
    deleteApplication.mockReset().mockResolvedValue(undefined)
  })

  it('切换页签保留编辑草稿，保存时提交原应用及项目归属', async () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'appSettings.edit' }))
    fireEvent.change(screen.getByRole('textbox', { name: /createApp.fieldName/ }), {
      target: { value: '新版护理终端' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'appSettings.navMembers' }))
    expect(
      screen.queryByRole('textbox', { name: /createApp.fieldName/ }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'appSettings.navBasic' }))
    expect(screen.getByRole('textbox', { name: /createApp.fieldName/ })).toHaveValue(
      '新版护理终端',
    )
    fireEvent.click(screen.getByRole('button', { name: 'appSettings.save' }))
    await waitFor(() =>
      expect(updateApplication).toHaveBeenCalledWith(
        'app-1',
        expect.objectContaining({
          name: '新版护理终端',
          projectId: 'project-1',
          regionId: 'product-1',
        }),
      ),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'appSettings.edit' }),
      ).toBeInTheDocument(),
    )
  })

  it('取消编辑恢复原值且不提交请求', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'appSettings.edit' }))
    fireEvent.change(screen.getByRole('textbox', { name: /createApp.fieldName/ }), {
      target: { value: '未保存' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'appSettings.cancelEdit' }))
    fireEvent.click(screen.getByRole('button', { name: 'appSettings.edit' }))
    expect(screen.getByRole('textbox', { name: /createApp.fieldName/ })).toHaveValue(
      application.name,
    )
    expect(updateApplication).not.toHaveBeenCalled()
  })

  it('删除仍须输入应用名称，成功后回到目录', async () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'appSettings.navDanger' }))
    fireEvent.click(screen.getByRole('button', { name: 'appSettings.deleteAction' }))
    expect(
      screen.getByRole('button', { name: 'appSettings.confirmDelete' }),
    ).toBeDisabled()
    fireEvent.change(
      screen.getByRole('textbox', { name: 'appSettings.deleteConfirmLabel' }),
      { target: { value: '错误名称' } },
    )
    expect(
      screen.getByRole('button', { name: 'appSettings.confirmDelete' }),
    ).toBeDisabled()
    expect(deleteApplication).not.toHaveBeenCalled()
    fireEvent.change(
      screen.getByRole('textbox', { name: 'appSettings.deleteConfirmLabel' }),
      { target: { value: application.name } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'appSettings.confirmDelete' }))
    await waitFor(() => expect(deleteApplication).toHaveBeenCalledWith(application.id))
    expect(await screen.findByText('应用目录')).toBeInTheDocument()
  })

  it('维护者没有删除应用入口', () => {
    auth.user.role = 'maintainer'
    renderSettings()
    expect(
      screen.queryByRole('button', { name: 'appSettings.navDanger' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('appSettings.deleteAction')).not.toBeInTheDocument()
  })
})
