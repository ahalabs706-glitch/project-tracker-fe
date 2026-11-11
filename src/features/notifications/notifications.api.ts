import { apiClient } from '../../api/client'
import type { ApiEnvelope } from '../../api/types'

export type Notification = {
  id: string
  event_type: string
  title: string
  message: string
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  created_at: string
  read_at?: string | null
}

export type NotificationPage = {
  items: Notification[]
  page: number
  total: number
  total_pages: number
}

export async function listNotifications(page: number, perPage = 20): Promise<NotificationPage> {
  const response = await apiClient.get<ApiEnvelope<Notification[]>>('/notifications', {
    params: { page, per_page: perPage },
  })
  return {
    items: response.data.data,
    page: response.data.meta?.page ?? page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  }
}

export async function getUnreadNotificationCount() {
  const response = await apiClient.get<ApiEnvelope<{ count: number }>>('/notifications/unread-count')
  return response.data.data.count
}

export async function markNotificationRead(notificationID: string) {
  const response = await apiClient.patch<ApiEnvelope<Notification>>(
    `/notifications/${notificationID}/read`,
  )
  return response.data.data
}

export async function markAllNotificationsRead() {
  const response = await apiClient.patch<ApiEnvelope<{ updated: number }>>('/notifications/read-all')
  return response.data.data
}
