import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toApiError } from '../../api/errors'
import { authAPI, type AuthUser } from './auth.api'
import { setAccessToken } from '../../auth/tokenStore'
import { AuthContext, type AuthStatus } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [initializationError, setInitializationError] = useState<Error | null>(null)

  const initialize = useCallback(async () => {
    try {
      await authAPI.refresh()
      const currentUser = await authAPI.currentUser()
      setUser(currentUser)
      setStatus('authenticated')
    } catch (error) {
      setAccessToken(null)
      setUser(null)
      const apiError = toApiError(error)
      if (apiError.status === 401) {
        setInitializationError(null)
        setStatus('unauthenticated')
        return
      }
      setInitializationError(apiError)
      setStatus('error')
    }
  }, [])

  const retryInitialization = useCallback(async () => {
    setStatus('loading')
    setInitializationError(null)
    await initialize()
  }, [initialize])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void initialize()
    })
    return () => {
      active = false
    }
  }, [initialize])

  useEffect(() => {
    const expireSession = () => {
      setAccessToken(null)
      setUser(null)
      setInitializationError(null)
      setStatus('unauthenticated')
    }
    window.addEventListener('projectflow:session-expired', expireSession)
    return () => {
      window.removeEventListener('projectflow:session-expired', expireSession)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const currentUser = await authAPI.login(email, password)
    setUser(currentUser)
    setInitializationError(null)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await authAPI.logout()
    } finally {
      setAccessToken(null)
      setUser(null)
      setInitializationError(null)
      setStatus('unauthenticated')
    }
  }, [])

  const value = useMemo(
    () => ({
      status,
      user,
      initializationError,
      login,
      logout,
      retryInitialization,
    }),
    [status, user, initializationError, login, logout, retryInitialization],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
