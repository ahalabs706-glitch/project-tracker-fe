import { apiClient, refreshAccessToken } from '../../api/client'
import type { ApiEnvelope } from '../../api/types'
import { setAccessToken } from '../../auth/tokenStore'

export type AuthUser = {
  id: string
  full_name: string
  email: string
  department: {
    id: string
    name: string
  } | null
  roles: string[]
  permissions: string[]
}

type LoginResponse = {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user: AuthUser
}

type TokenResponse = {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
}

export const authAPI = {
  async login(email: string, password: string): Promise<AuthUser> {
    const { data } = await apiClient.post<ApiEnvelope<LoginResponse>>(
      '/auth/login',
      { email, password },
    )
    setAccessToken(data.data.access_token)
    return data.data.user
  },

  async refresh(): Promise<void> {
    await refreshAccessToken()
  },

  async currentUser(): Promise<AuthUser> {
    const { data } = await apiClient.get<ApiEnvelope<AuthUser>>('/auth/me')
    return data.data
  },

  async logout(): Promise<void> {
    await apiClient.post<ApiEnvelope<null>>('/auth/logout')
    setAccessToken(null)
  },
}

export type { TokenResponse }
