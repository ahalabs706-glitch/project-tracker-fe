import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, FolderKanban, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { getErrorMessage, toApiError } from '../../api/errors'
import { Button, Feedback, TextField } from '../../components/ui'
import { useAuth } from './AuthContext'
import './auth.css'

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

type LoginValues = z.infer<typeof loginSchema>

type LoginLocationState = {
  from?: {
    pathname?: string
  }
  notice?: string
}

export function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const locationState = location.state as LoginLocationState | null
  const redirectTo = locationState?.from?.pathname ?? '/'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  if (status === 'authenticated') {
    return <Navigate to={redirectTo} replace />
  }

  const onSubmit = async ({ email, password }: LoginValues) => {
    setServerError(null)
    try {
      await login(email, password)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.code === 'INVALID_CREDENTIALS') {
        setServerError('The email or password you entered is incorrect.')
      } else if (apiError.code === 'ACCOUNT_INACTIVE') {
        setServerError('This account is inactive. Contact your administrator for help.')
      } else {
        setServerError(getErrorMessage(apiError))
      }
    }
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="login-title" className="auth-card">
        <Link className="auth-brand" to="/" aria-label="ProjectFlow">
          <span className="auth-brand__mark" aria-hidden="true">
            <FolderKanban size={20} />
          </span>
          <span>ProjectFlow</span>
        </Link>

        <div className="auth-card__heading">
          <span className="auth-card__icon" aria-hidden="true">
            <LockKeyhole size={18} />
          </span>
          <p className="auth-card__eyebrow">Your workspace awaits</p>
          <h1 id="login-title">Welcome back</h1>
          <p className="auth-card__description">
            Sign in to manage your projects, contracts, and budgets.
          </p>
        </div>

        {locationState?.notice && (
          <div className="auth-card__feedback">
            <Feedback tone="warning">{locationState.notice}</Feedback>
          </div>
        )}
        {serverError && (
          <div className="auth-card__feedback">
            <Feedback tone="error" title="Unable to sign in">
              {serverError}
            </Feedback>
          </div>
        )}

        <form className="login-form" noValidate onSubmit={handleSubmit(onSubmit)}>
          <TextField
            autoComplete="email"
            autoFocus
            error={errors.email?.message}
            label="Work email"
            placeholder="you@company.com"
            type="email"
            {...register('email')}
          />

          <div className="password-field">
            <TextField
              autoComplete="current-password"
              error={errors.password?.message}
              label="Password"
              placeholder="Enter your password"
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
            />
            <button
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="password-field__toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              {showPassword ? (
                <EyeOff size={17} aria-hidden="true" />
              ) : (
                <Eye size={17} aria-hidden="true" />
              )}
            </button>
          </div>

          <Button
            className="login-form__submit"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="auth-card__help">
          Having trouble signing in? Contact your ProjectFlow administrator.
        </p>
      </section>

      <footer className="auth-page__footer">
        ProjectFlow <span aria-hidden="true">·</span> Project &amp; contract management
      </footer>
    </main>
  )
}
