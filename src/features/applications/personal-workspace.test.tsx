import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { PersonalWorkspace } from './personal-workspace'
import type { PersonalWorkspace as PersonalWorkspaceData } from '@/services/api'
import type { Application } from '@/types/application'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, values?: Record<string, unknown>) =>
        values?.name
          ? `${key}:${values.name}`
          : values?.filters
            ? `${key}:${values.filters}`
            : values?.query
              ? `${key}:${values.query}`
              : key,
      i18n: { language: 'zh-CN' },
    }),
  }
})

const application: Application = {
  id: '00000000-0000-4000-8000-000000000001',
  name: '移动护理',
  applicationCode: 'caregiver',
  description: '移动护理应用',
  packageName: 'com.example.caregiver',
  platform: 'android',
  region: {
    id: '00000000-0000-4000-8000-000000000002',
    code: 'east',
    name: '华东',
    sortOrder: 0,
    enabled: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  latestVersion: '3.2.1',
  updatedAt: '2026-08-28T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  owner: '负责人',
  artifactCount: 8,
  status: 'active',
  repository: '',
}

const workspace: PersonalWorkspaceData = {
  favoriteApplicationIds: [application.id],
  recentApplications: [
    { applicationId: application.id, viewedAt: '2026-08-28T00:00:00.000Z' },
  ],
  preferences: {
    platform: 'android',
    sort: 'name',
    regionId: application.region.id,
    query: '护理',
    favoriteOnly: true,
    responsibleOnly: true,
    collapsed: false,
  },
}

describe('PersonalWorkspace', () => {
  it('展示最近访问与收藏，并触发恢复和收藏操作', () => {
    const toggleFavorite = vi.fn()
    const restoreFilters = vi.fn()

    render(
      <MemoryRouter>
        <PersonalWorkspace
          applications={[application]}
          workspace={workspace}
          onToggleFavorite={toggleFavorite}
          onRestoreFilters={restoreFilters}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('applications.workspace.favorites')).toBeInTheDocument()
    expect(screen.getByText('applications.workspace.recent')).toBeInTheDocument()
    expect(screen.getAllByText(application.name)).toHaveLength(2)
    expect(
      screen.getByText(
        /applications\.workspace\.savedFilters:platform\.android · 华东 · sort\.name · applications\.workspace\.myApplications · applications\.favoritesOnly · applications\.workspace\.savedFilterQuery:护理/,
      ),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'applications.workspace.restoreFilters' }),
    )
    expect(restoreFilters).toHaveBeenCalledWith(workspace.preferences)

    fireEvent.click(
      screen.getByRole('button', {
        name: `applications.workspace.removeFavorite:${application.name}`,
      }),
    )
    expect(toggleFavorite).toHaveBeenCalledWith(application.id)
  })

  it('没有个人数据时不占用首页空间', () => {
    const { container } = render(
      <MemoryRouter>
        <PersonalWorkspace
          applications={[application]}
          workspace={{
            favoriteApplicationIds: [],
            recentApplications: [],
            preferences: {
              platform: 'all',
              sort: 'updated',
              regionId: null,
              query: '',
              favoriteOnly: false,
              responsibleOnly: false,
              collapsed: false,
            },
          }}
          onToggleFavorite={vi.fn()}
          onRestoreFilters={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('收藏不设上限，工作台展示前八个并提供全部收藏入口', () => {
    const applications = Array.from({ length: 9 }, (_, index) => ({
      ...application,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: `应用${index + 1}`,
    }))

    render(
      <MemoryRouter>
        <PersonalWorkspace
          applications={applications}
          workspace={{
            ...workspace,
            favoriteApplicationIds: applications.map((item) => item.id),
            recentApplications: [],
          }}
          onToggleFavorite={vi.fn()}
          onRestoreFilters={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('article')).toHaveLength(8)
    expect(screen.queryByText('应用9')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'applications.workspace.viewAllFavorites',
      }),
    ).toHaveAttribute('href', '/?favorites=1')
  })
})
