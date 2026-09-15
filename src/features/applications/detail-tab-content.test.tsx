import { useEffect, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Tabs } from '@/components/ui/tabs'
import { DetailTabContent } from './detail-tab-content'

it('loads each panel on first visit and preserves its draft without remounting', () => {
  const mounted = vi.fn()
  function Editor() {
    const [draft, setDraft] = useState('')
    useEffect(() => {
      mounted()
    }, [])
    return (
      <input
        aria-label="Draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    )
  }
  function Fixture({ active }: { active: string }) {
    return (
      <Tabs value={active}>
        <DetailTabContent active={active === 'overview'} value="overview">
          Overview
        </DetailTabContent>
        <DetailTabContent active={active === 'settings'} value="settings">
          <Editor />
        </DetailTabContent>
      </Tabs>
    )
  }
  const { rerender } = render(<Fixture active="overview" />)
  expect(mounted).not.toHaveBeenCalled()
  rerender(<Fixture active="settings" />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), {
    target: { value: 'Unsaved notes' },
  })
  rerender(<Fixture active="overview" />)
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  rerender(<Fixture active="settings" />)
  expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('Unsaved notes')
  expect(mounted).toHaveBeenCalledTimes(1)
})
