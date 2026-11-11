import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { RequirePermission, RequireRole } from './AuthRoutes'

const authValue: AuthContextValue = {
  status: 'authenticated',
  user: {
    id: 'user-1',
    full_name: 'Test User',
    email: 'test@example.com',
    department: null,
    roles: [],
    permissions: ['projects.read'],
  },
  initializationError: null,
  login: vi.fn(),
  logout: vi.fn(),
  retryInitialization: vi.fn(),
}

describe('RequirePermission', () => {
  afterEach(() => cleanup())

  it('redirects users without the requested permission', async () => {
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/admin/users']}>
          <Routes>
            <Route
              element={<RequirePermission permission="users.read"><h1>User administration</h1></RequirePermission>}
              path="/admin/users"
            />
            <Route element={<h1>Forbidden</h1>} path="/403" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(await screen.findByRole('heading', { name: 'Forbidden' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'User administration' })).not.toBeInTheDocument()
  })

  describe('RequireRole', () => {
    afterEach(() => cleanup())

    it('redirects users without the requested role', async () => {
      render(
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={['/admin/role-permissions']}>
            <Routes>
              <Route
                element={<RequireRole role="SUPER_ADMIN"><h1>Role permissions</h1></RequireRole>}
                path="/admin/role-permissions"
              />
              <Route element={<h1>Forbidden</h1>} path="/403" />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>,
      )

      expect(await screen.findByRole('heading', { name: 'Forbidden' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Role permissions' })).not.toBeInTheDocument()
    })

    it('renders the protected content when the role is present', () => {
      render(
        <AuthContext.Provider value={{
          ...authValue,
          user: { ...authValue.user!, roles: ['SUPER_ADMIN'] },
        }}>
          <MemoryRouter>
            <RequireRole role="SUPER_ADMIN"><h1>Role permissions</h1></RequireRole>
          </MemoryRouter>
        </AuthContext.Provider>,
      )

      expect(screen.getByRole('heading', { name: 'Role permissions' })).toBeInTheDocument()
    })
  })

  it('renders the protected content when the permission is present', () => {
    render(
      <AuthContext.Provider value={{
        ...authValue,
        user: { ...authValue.user!, permissions: ['users.read'] },
      }}>
        <MemoryRouter>
          <RequirePermission permission="users.read"><h1>User administration</h1></RequirePermission>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(screen.getByRole('heading', { name: 'User administration' })).toBeInTheDocument()
  })
})
