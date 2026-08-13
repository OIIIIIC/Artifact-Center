import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ApplicationSearch } from './application-search'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('ApplicationSearch', () => {
  it('等待中文输入法结束组词后再提交筛选词', () => {
    const onChange = vi.fn()
    render(<ApplicationSearch value="" onChange={onChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'shiyan' } })

    expect(onChange).not.toHaveBeenCalled()

    fireEvent.compositionEnd(input, { data: '十堰', target: { value: '十堰' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('十堰')
  })
})
