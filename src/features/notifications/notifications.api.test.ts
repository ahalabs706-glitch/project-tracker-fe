import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../api/client'
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.api'

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

describe('notification API client', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes pagination and maps response metadata', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: [{ id: 'notice-1' }],
        meta: { page: 2, per_page: 20, total: 25, total_pages: 2 },
      },
    })

    await expect(listNotifications(2, 20)).resolves.toEqual({
      items: [{ id: 'notice-1' }],
      page: 2,
      total: 25,
      total_pages: 2,
    })
    expect(apiClient.get).toHaveBeenCalledWith('/notifications', {
      params: { page: 2, per_page: 20 },
    })
  })

  it('reads the unread count from the server', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { count: 4 } } })

    await expect(getUnreadNotificationCount()).resolves.toBe(4)
    expect(apiClient.get).toHaveBeenCalledWith('/notifications/unread-count')
  })

  it('uses the supported per-notification and bulk read endpoints', async () => {
    vi.mocked(apiClient.patch)
      .mockResolvedValueOnce({ data: { data: { id: 'notice-1', is_read: true } } })
      .mockResolvedValueOnce({ data: { data: { updated: 3 } } })

    await expect(markNotificationRead('notice-1')).resolves.toEqual({
      id: 'notice-1',
      is_read: true,
    })
    await expect(markAllNotificationsRead()).resolves.toEqual({ updated: 3 })
    expect(apiClient.patch).toHaveBeenNthCalledWith(1, '/notifications/notice-1/read')
    expect(apiClient.patch).toHaveBeenNthCalledWith(2, '/notifications/read-all')
  })
})
