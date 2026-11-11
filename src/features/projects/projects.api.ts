import { apiClient } from '../../api/client'
import type { ApiEnvelope } from '../../api/types'

export type ProjectStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'PLANNING'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED'

export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type Project = {
  id: string
  project_code: string
  name: string
  description: string | null
  category: string | null
  department_id: string
  owner_id: string
  manager_id: string
  start_date: string
  target_end_date: string
  actual_start_date: string | null
  actual_end_date: string | null
  approved_budget: string
  currency: string
  priority: ProjectPriority
  status: ProjectStatus
  reason: string | null
  progress: number
  created_at: string
  updated_at: string
  archived_at?: string
}

export type ProjectMember = {
  user_id: string
  full_name: string
  email: string
  project_role: 'MEMBER' | 'LEAD' | 'CONTRIBUTOR'
}

export type ProjectRolePermissionSet = {
  project_role: ProjectMember['project_role']
  permissions: string[]
  is_customized: boolean
}

export const projectScopedPermissions = [
  { code: 'tasks.read', label: 'View tasks' },
  { code: 'tasks.create', label: 'Create tasks' },
  { code: 'tasks.update', label: 'Update tasks and progress' },
  { code: 'tasks.assign', label: 'Assign tasks to members' },
  { code: 'milestones.read', label: 'View milestones' },
  { code: 'milestones.create', label: 'Create milestones' },
  { code: 'milestones.update', label: 'Update milestones' },
] as const

export type ProjectBudgetSummary = {
  project_id: string
  currency: string
  approved_budget: string
  planned_budget: string
  committed_cost: string
  actual_cost: string
  forecast_cost: string
  remaining_budget: string
  budget_variance: string
  utilization_percentage: number
  status: string
}

export type ProjectUserOption = {
  id: string
  full_name: string
  email: string
  department: { id: string; name: string } | null
  is_active: boolean
}

export type ProjectDepartmentOption = {
  id: string
  code: string
  name: string
  is_active: boolean
}

export type ProjectFilters = {
  page: number
  per_page: number
  search: string
  status: string
  department_id: string
  priority: string
  sort_by: string
  sort_order: string
  include_archived: boolean
}

export type ProjectPage = {
  projects: Project[]
  page: number
  total: number
  total_pages: number
}

export type ProjectInput = {
  name: string
  description: string
  category: string
  department_id: string
  owner_id: string
  manager_id: string
  start_date: string
  target_end_date: string
  approved_budget: string
  currency: string
  priority: ProjectPriority
  status: ProjectStatus
}

function dataFrom<T>(response: { data: ApiEnvelope<T> }) {
  return response.data.data
}

export async function listProjects(filters: ProjectFilters): Promise<ProjectPage> {
  const response = await apiClient.get<ApiEnvelope<Project[]>>('/projects', {
    params: {
      ...filters,
      search: filters.search || undefined,
      status: filters.status || undefined,
      department_id: filters.department_id || undefined,
      priority: filters.priority || undefined,
      include_archived: filters.include_archived || undefined,
    },
  })
  return {
    projects: response.data.data,
    page: response.data.meta?.page ?? filters.page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  }
}

export async function getProject(id: string) {
  return dataFrom(await apiClient.get<ApiEnvelope<Project>>(`/projects/${id}`))
}

export async function createProject(input: ProjectInput) {
  return dataFrom(await apiClient.post<ApiEnvelope<Project>>('/projects', input))
}

export async function updateProject(id: string, input: ProjectInput) {
  return dataFrom(await apiClient.put<ApiEnvelope<Project>>(`/projects/${id}`, input))
}

export async function listProjectMembers(id: string) {
  return dataFrom(await apiClient.get<ApiEnvelope<ProjectMember[]>>(`/projects/${id}/members`))
}

export async function getProjectPermissions(id: string) {
  return dataFrom(await apiClient.get<ApiEnvelope<string[]>>(`/projects/${id}/permissions`))
}

export async function listProjectRolePermissions(id: string) {
  return dataFrom(await apiClient.get<ApiEnvelope<ProjectRolePermissionSet[]>>(`/projects/${id}/role-permissions`))
}

export async function updateProjectRolePermissions(
  id: string,
  projectRole: ProjectMember['project_role'],
  permissionCodes: string[],
) {
  return dataFrom(await apiClient.put<ApiEnvelope<null>>(`/projects/${id}/role-permissions`, {
    project_role: projectRole,
    permission_codes: permissionCodes,
  }))
}

export async function addProjectMember(
  id: string,
  input: { user_id: string; project_role: ProjectMember['project_role'] },
) {
  return dataFrom(await apiClient.post<ApiEnvelope<null>>(`/projects/${id}/members`, input))
}

export async function removeProjectMember(id: string, userID: string) {
  return dataFrom(await apiClient.delete<ApiEnvelope<null>>(`/projects/${id}/members/${userID}`))
}

export async function updateProjectStatus(id: string, status: ProjectStatus, reason: string) {
  return dataFrom(await apiClient.patch<ApiEnvelope<Project>>(`/projects/${id}/status`, { status, reason }))
}

export async function updateProjectProgress(id: string, progress: number) {
  return dataFrom(await apiClient.patch<ApiEnvelope<Project>>(`/projects/${id}/progress`, { progress }))
}

export async function archiveProject(id: string) {
  return dataFrom(await apiClient.post<ApiEnvelope<null>>(`/projects/${id}/archive`))
}

export async function getProjectBudgetSummary(id: string) {
  return dataFrom(
    await apiClient.get<ApiEnvelope<ProjectBudgetSummary>>(`/projects/${id}/budget`),
  )
}

export async function listProjectUsers(departmentID?: string) {
  const response = await apiClient.get<ApiEnvelope<ProjectUserOption[]>>('/users', {
    params: {
      page: 1,
      per_page: 100,
      is_active: true,
      department_id: departmentID || undefined,
    },
  })
  return response.data.data
}

export async function listProjectDepartments() {
  return dataFrom(await apiClient.get<ApiEnvelope<ProjectDepartmentOption[]>>('/departments'))
}
