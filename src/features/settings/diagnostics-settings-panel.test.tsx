import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DiagnosticsSettingsPanel } from './diagnostics-settings-panel'

const generateReport = vi.fn()

vi.mock('@/services/api', () => ({
  apiGenerateDiagnosticReport: (...args: unknown[]) => generateReport(...args),
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }
})

describe('系统诊断设置面板', () => {
  beforeEach(() => {
    generateReport.mockReset()
    generateReport.mockResolvedValue({
      generatedAt: '2026-07-20T08:30:00.000Z',
      eventCount: 1,
      markdown: '# 可交给 AI 的诊断包',
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('生成报告并允许复制 Markdown', async () => {
    render(<DiagnosticsSettingsPanel />)

    fireEvent.change(
      screen.getByPlaceholderText('settings.diagnosticsRequestIdPlaceholder'),
      {
        target: { value: 'request-123' },
      },
    )
    fireEvent.change(
      screen.getByPlaceholderText('settings.diagnosticsOperationPlaceholder'),
      {
        target: { value: '打开应用列表' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'settings.diagnosticsGenerate' }))

    await waitFor(() => {
      expect(generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          sinceMinutes: 30,
          requestId: 'request-123',
          operation: '打开应用列表',
        }),
      )
    })
    expect(screen.getByText('# 可交给 AI 的诊断包')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'settings.diagnosticsCopy' }))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('# 可交给 AI 的诊断包')
    })
  })

  it('滚动容器内的诊断模块使用不会被裁剪的实体边框', () => {
    render(<DiagnosticsSettingsPanel />)

    const privacySurface = screen.getByText('settings.diagnosticsPrivacyTitle')
      .parentElement?.parentElement
    const previewSurface = screen.getByRole('heading', {
      name: 'settings.diagnosticsPreview',
    }).parentElement?.parentElement?.parentElement
    const previewBody = screen
      .getByText('settings.diagnosticsPreviewPlaceholder')
      .closest('pre')

    expect(privacySurface).toHaveClass('border')
    expect(previewSurface).toHaveClass('border')
    expect(previewBody).toHaveClass('border')
    expect(
      screen.getByPlaceholderText('settings.diagnosticsExpectedPlaceholder'),
    ).toHaveClass('border')
  })
})
