import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarkdownPreview } from './markdown-preview'

describe('MarkdownPreview', () => {
  it('renders common release-note Markdown as safe elements', () => {
    render(
      <MarkdownPreview
        content={
          '# 本次更新\n\n- 修复登录问题\n- **提升** 下载稳定性\n\n[查看详情](https://example.com/release)'
        }
      />,
    )

    expect(screen.getByRole('heading', { name: '本次更新' })).toBeInTheDocument()
    expect(screen.getByRole('list')).toHaveTextContent('修复登录问题')
    expect(screen.getByRole('strong')).toHaveTextContent('提升')
    expect(screen.getByRole('link', { name: '查看详情' })).toHaveAttribute(
      'href',
      'https://example.com/release',
    )
  })

  it('does not turn unsafe links into anchors', () => {
    render(<MarkdownPreview content={'[不安全链接](javascript:alert(1))'} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('[不安全链接](javascript:alert(1))')).toBeInTheDocument()
  })
})
