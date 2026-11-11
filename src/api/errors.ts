import axios from 'axios'
import type { ApiErrorDetail, ApiFailure } from './types'

export class ApiError extends Error {
  readonly status?: number
  readonly code?: string
  readonly details?: ApiErrorDetail['details']

  constructor(
    message: string,
    options: {
      status?: number
      code?: string
      details?: ApiErrorDetail['details']
      cause?: unknown
    } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.details = options.details
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError<ApiFailure>(error)) {
    const body = error.response?.data
    return new ApiError(
      body?.message ?? error.message ?? 'The request could not be completed.',
      {
        status: error.response?.status,
        code: body?.error?.code,
        details: body?.error?.details,
        cause: error,
      },
    )
  }

  if (error instanceof Error) {
    return new ApiError(error.message, { cause: error })
  }

  return new ApiError('An unexpected error occurred.', { cause: error })
}

export function getErrorMessage(error: unknown): string {
  const apiError = toApiError(error)

  if (apiError.status === undefined) {
    return 'Unable to reach ProjectFlow. Check your connection and try again.'
  }

  if (apiError.status >= 500) {
    return 'ProjectFlow is temporarily unavailable. Please try again shortly.'
  }

  return apiError.message
}
