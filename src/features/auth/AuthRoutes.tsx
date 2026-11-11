import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Button, Feedback } from '../../components/ui'
import { getErrorMessage } from '../../api/errors'
import { useAuth } from './AuthContext'
import './auth.css'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, initializationError, retryInitialization } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <main className="auth-loading" aria-live="polite">
        <div className="auth-loading__content">
          <span className="auth-loading__spinner" aria-hidden="true" />
          <span>Checking your session…</span>
        </div>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="auth-loading">
        <section className="auth-error-page">
          <h1>We couldn’t verify your session</h1>
          <Feedback tone="error">{getErrorMessage(initializationError)}</Feedback>
          <Button onClick={() => void retryInitialization()}>Try again</Button>
        </section>
      </main>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const { user } = useAuth()

  if (!user?.permissions.includes(permission)) {
    return <Navigate to="/403" replace />
  }

  return children
}

export function RequireRole({
  role,
  children,
}: {
  role: string
  children: ReactNode
}) {
  const { user } = useAuth()

  if (!user?.roles.includes(role)) {
    return <Navigate to="/403" replace />
  }

  return children
}
