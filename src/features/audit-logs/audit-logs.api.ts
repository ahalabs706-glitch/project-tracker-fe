import { apiClient } from '../../api/client'
import type { ApiEnvelope } from '../../api/types'

export type AuditLog = {
  id: string
  actor_id: string | null
  actor_name: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value?: unknown
  new_value?: unknown
  ip_address?: string | null
  created_at: string
}

export type AuditLogFilters = {
  action: string
  entity_type: string
  entity_id: string
  date_from: string
  date_to: string
}

export type AuditLogPage = {
  items: AuditLog[]
  page: number
  total: number
  total_pages: number
}

export async function listAuditLogs(
  page: number,
  perPage: number,
  filters: AuditLogFilters,
): Promise<AuditLogPage> {
  const response = await apiClient.get<ApiEnvelope<AuditLog[]>>('/audit-logs', {
    params: {
      page,
      per_page: perPage,
      action: filters.action.trim() || undefined,
      entity_type: filters.entity_type || undefined,
      entity_id: filters.entity_id.trim() || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    },
  })

  return {
    items: response.data.data,
    page: response.data.meta?.page ?? page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  }
}
