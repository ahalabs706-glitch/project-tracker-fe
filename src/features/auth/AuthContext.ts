import { createContext, useContext } from 'react'
import type { AuthUser } from './auth.api'

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error'

export type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  initializationError: Error | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  retryInitialization: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
