import { describe, expect, it } from 'vitest'
import { resolveApiBaseURL } from './config'

describe('resolveApiBaseURL', () => {
  it('uses the explicit API URL without trailing slashes', () => {
    expect(resolveApiBaseURL(' https://api.example.test/api/v1/// ', false))
      .toBe('https://api.example.test/api/v1')
  })

  it('defaults development to the local API', () => {
    expect(resolveApiBaseURL(undefined, true)).toBe('http://localhost:4000/api/v1')
  })

  it('uses a same-origin API path in production when not configured', () => {
    expect(resolveApiBaseURL(undefined, false)).toBe('/api/v1')
  })
})
