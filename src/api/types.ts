export type ApiEnvelope<T> = {
  success: true
  message: string
  data: T
  meta?: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

export type ApiFailure = {
  success: false
  message: string
  error: {
    code: string
    details: unknown[]
  }
}

export type ApiErrorDetail = ApiFailure['error']
