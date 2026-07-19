import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/common/status-badge'

describe('StatusBadge', () => {
  it('renders with default status variant', () => {
    render(<StatusBadge data-testid="badge">Default</StatusBadge>)
    const el = screen.getByTestId('badge')
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('Default')
  })

  it('renders with explicit status variant', () => {
    render(
      <StatusBadge status="success" data-testid="badge">
        Active
      </StatusBadge>,
    )
    const el = screen.getByTestId('badge')
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('Active')
  })

  it('renders with new status variant (uppercase tracking)', () => {
    render(
      <StatusBadge status="new" data-testid="badge">
        NEW
      </StatusBadge>,
    )
    const el = screen.getByTestId('badge')
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('NEW')
  })

  it('renders with deprecated status variant', () => {
    render(
      <StatusBadge status="deprecated" data-testid="badge">
        Deprecated
      </StatusBadge>,
    )
    expect(screen.getByTestId('badge')).toBeInTheDocument()
  })

  it('renders with archived status variant (ring style)', () => {
    render(
      <StatusBadge status="archived" data-testid="badge">
        Archived
      </StatusBadge>,
    )
    expect(screen.getByTestId('badge')).toBeInTheDocument()
  })

  it('passes additional className', () => {
    render(
      <StatusBadge className="my-custom" data-testid="badge">
        Custom
      </StatusBadge>,
    )
    const el = screen.getByTestId('badge')
    expect(el.className).toContain('my-custom')
  })

  it('forwards extra HTML attributes', () => {
    render(
      <StatusBadge id="my-id" data-testid="badge">
        Extra
      </StatusBadge>,
    )
    expect(screen.getByTestId('badge').id).toBe('my-id')
  })
})
