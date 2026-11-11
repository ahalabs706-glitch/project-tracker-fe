import { apiClient } from '../../api/client'
import type { ApiEnvelope } from '../../api/types'

export type AdminDepartment = {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
}

export type AdminRole = {
  id: string
  code: string
  name: string
}

export type AdminPermission = {
  code: string
  description: string
  granted: boolean
}

export type AdminRolePermissionSet = {
  role: AdminRole
  permissions: AdminPermission[]
  locked: boolean
}

export type AdminUser = {
  id: string
  full_name: string
  email: string
  department: { id: string; name: string } | null
  is_active: boolean
  roles: string[]
}

export type AdminUserInput = {
  full_name: string
  email: string
  password: string
  department_id: string | null
  role_ids: string[]
}

export type AdminUserFilters = {
  page: number
  per_page: number
  search: string
  department_id: string
  is_active: string
  sort_by: 'created_at' | 'full_name' | 'email'
  sort_order: 'asc' | 'desc'
}

export type AdminUserPage = {
  items: AdminUser[]
  page: number
  total: number
  total_pages: number
}

function dataFrom<T>(response: { data: ApiEnvelope<T> }) {
  return response.data.data
}

export async function listAdminUsers(filters: AdminUserFilters): Promise<AdminUserPage> {
  const response = await apiClient.get<ApiEnvelope<AdminUser[]>>('/users', {
    params: {
      ...filters,
      search: filters.search || undefined,
      department_id: filters.department_id || undefined,
      is_active: filters.is_active || undefined,
    },
  })
  return {
    items: response.data.data,
    page: response.data.meta?.page ?? filters.page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  }
}

export async function getAdminUser(userID: string) {
  return dataFrom(await apiClient.get<ApiEnvelope<AdminUser>>(`/users/${userID}`))
}

export async function createAdminUser(input: AdminUserInput) {
  return dataFrom(await apiClient.post<ApiEnvelope<AdminUser>>('/users', input))
}

export async function updateAdminUser(userID: string, input: AdminUserInput) {
  return dataFrom(await apiClient.put<ApiEnvelope<AdminUser>>(`/users/${userID}`, input))
}

export async function setAdminUserActive(userID: string, isActive: boolean) {
  return dataFrom(
    await apiClient.patch<ApiEnvelope<AdminUser>>(`/users/${userID}/status`, { is_active: isActive }),
  )
}

export async function listAdminRoles() {
  return dataFrom(await apiClient.get<ApiEnvelope<AdminRole[]>>('/roles'))
}

export async function listRolePermissions() {
  return dataFrom(await apiClient.get<ApiEnvelope<AdminRolePermissionSet[]>>('/role-permissions'))
}

export async function updateRolePermissions(roleID: string, permissionCodes: string[]) {
  return dataFrom(await apiClient.put<ApiEnvelope<null>>(`/roles/${roleID}/permissions`, {
    permission_codes: permissionCodes,
  }))
}

export async function listAdminDepartments() {
  return dataFrom(await apiClient.get<ApiEnvelope<AdminDepartment[]>>('/departments'))
}

export async function createAdminDepartment(input: Omit<AdminDepartment, 'id' | 'is_active'>) {
  return dataFrom(await apiClient.post<ApiEnvelope<AdminDepartment>>('/departments', input))
}

export async function updateAdminDepartment(
  departmentID: string,
  input: Omit<AdminDepartment, 'id' | 'is_active'>,
) {
  return dataFrom(
    await apiClient.put<ApiEnvelope<AdminDepartment>>(`/departments/${departmentID}`, input),
  )
}

export async function setAdminDepartmentActive(departmentID: string, isActive: boolean) {
  return dataFrom(
    await apiClient.patch<ApiEnvelope<AdminDepartment>>(
      `/departments/${departmentID}/status`,
      { is_active: isActive },
    ),
  )
}
