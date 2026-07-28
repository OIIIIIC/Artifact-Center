import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { LoginPage } from './login-page'

const login = vi.fn()
let authUser: unknown = null

vi.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: authUser,
      login,
    }),
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

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

describe('登录页跳转', () => {
  beforeEach(() => {
    authUser = null
    login.mockReset()
    login.mockResolvedValue({ ok: true })
  })

  it('登录成功后进入首页，不继承上一个账号退出前的页面', async () => {
    render(
      <TooltipProvider>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/login',
              state: { from: '/applications/old-account-app' },
            },
          ]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>,
    )

    await userEvent.type(screen.getByLabelText('auth.identifier'), 'admin')
    await userEvent.type(screen.getByLabelText('auth.password'), 'Password123')
    await userEvent.click(screen.getByRole('button', { name: 'auth.signIn' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/')
  })
})
