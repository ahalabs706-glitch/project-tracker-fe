export function resolveApiBaseURL(configuredURL: string | undefined, isDevelopment: boolean) {
  const configured = configuredURL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  return isDevelopment ? 'http://localhost:4000/api/v1' : '/api/v1'
}
