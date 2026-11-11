import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { setAccessToken, getAccessToken } from '../auth/tokenStore'
import type { ApiEnvelope, ApiFailure } from './types'
import { ApiError, toApiError } from './errors'
import { resolveApiBaseURL } from './config'

export const apiBaseURL = resolveApiBaseURL(
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.DEV,
)

export const apiClient = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _authRetry?: boolean
}

let refreshInFlight: Promise<string> | null = null

export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<ApiEnvelope<{ access_token: string }>>(
        `${apiBaseURL}/auth/refresh`,
        null,
        {
          withCredentials: true,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      .then(({ data }) => {
        const token = data.data?.access_token
        if (!data.success || !token) {
          throw new ApiError('The refresh response did not contain an access token.')
        }
        setAccessToken(token)
        return token
      })
      .catch((error: unknown) => {
        setAccessToken(null)
        throw toApiError(error)
      })
      .finally(() => {
        refreshInFlight = null
      })
  }

  return refreshInFlight
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiFailure>) => {
    const config = error.config as RetriableRequestConfig | undefined
    const requestURL = config?.url ?? ''
    const isAuthenticationRequest =
      /\/auth\/(login|refresh)$/.test(requestURL)

    if (
      error.response?.status !== 401 ||
      !config ||
      config._authRetry ||
      isAuthenticationRequest
    ) {
      return Promise.reject(toApiError(error))
    }

    config._authRetry = true
    try {
      const token = await refreshAccessToken()
      config.headers.set('Authorization', `Bearer ${token}`)
      return await apiClient.request(config)
    } catch (refreshError) {
      setAccessToken(null)
      window.dispatchEvent(new Event('projectflow:session-expired'))
      return Promise.reject(toApiError(refreshError))
    }
  },
)
