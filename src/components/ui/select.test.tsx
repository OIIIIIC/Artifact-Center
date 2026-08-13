import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

describe('Select', () => {
  it('以受控菜单显示并选择选项，而非浏览器原生下拉框', () => {
    const onValueChange = vi.fn()
    render(
      <Select value="henan" onValueChange={onValueChange}>
        <SelectTrigger aria-label="所属地域">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="henan">河南</SelectItem>
          <SelectItem value="hubei">湖北</SelectItem>
        </SelectContent>
      </Select>,
    )

    expect(document.querySelector('select')).toBeNull()
    fireEvent.click(screen.getByRole('combobox', { name: '所属地域' }))
    fireEvent.click(screen.getByRole('option', { name: '湖北' }))
    expect(onValueChange).toHaveBeenCalledWith('hubei')
  })
})
