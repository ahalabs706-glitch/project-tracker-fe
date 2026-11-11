import { apiClient } from '../../api/client'
import type { ApiEnvelope } from '../../api/types'
import type { ProjectUserOption } from '../projects/projects.api'

export type TaskStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'BLOCKED'
  | 'DONE'
  | 'CANCELLED'

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type TaskAssignee = {
  user_id: string
  full_name: string
}

export type TaskAssigneeOption = {
  id: string
  full_name: string
  department: string | null
}

export type Task = {
  id: string
  project_id: string
  parent_task_id: string | null
  title: string
  description: string | null
  assigned_to: string | null
  assignees: TaskAssignee[]
  priority: TaskPriority
  status: TaskStatus
  planned_start_date: string | null
  planned_due_date: string
  actual_start_date: string | null
  actual_completion_date: string | null
  progress: number
  is_overdue: boolean
  created_at: string
  updated_at: string
}

export type TaskListFilters = {
  status: string
  priority: string
  overdue: string
  page: number
  per_page: number
}

export type TaskPage = {
  items: Task[]
  page: number
  total: number
  total_pages: number
}

export type TaskInput = {
  parent_task_id: string
  title: string
  description: string
  assignee_ids: string[]
  priority: TaskPriority
  status: TaskStatus
  planned_start_date: string
  planned_due_date: string
  progress: number
}

export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED'

export type Milestone = {
  id: string
  project_id: string
  project_name: string
  project_code: string
  owner_id: string | null
  name: string
  description: string | null
  planned_date: string
  actual_date: string | null
  status: MilestoneStatus
  created_at: string
  updated_at: string
}

export type MilestonePage = {
  items: Milestone[]
  page: number
  total: number
  total_pages: number
}

export type MilestoneInput = {
  owner_id: string
  name: string
  description: string
  planned_date: string
  status: MilestoneStatus
}

function dataFrom<T>(response: { data: ApiEnvelope<T> }) {
  return response.data.data
}

function taskQuery(filters: TaskListFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined),
  )
}

function taskPage(response: { data: ApiEnvelope<Task[]> }, page: number): TaskPage {
  return {
    items: response.data.data,
    page: response.data.meta?.page ?? page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  }
}

export async function listMyTasks(filters: TaskListFilters) {
  return taskPage(await apiClient.get<ApiEnvelope<Task[]>>('/tasks/my', { params: taskQuery(filters) }), filters.page)
}

export async function listProjectTasks(projectID: string, filters: TaskListFilters) {
  return taskPage(
    await apiClient.get<ApiEnvelope<Task[]>>(`/projects/${projectID}/tasks`, {
      params: taskQuery(filters),
    }),
    filters.page,
  )
}

export async function getTask(taskID: string) {
  return dataFrom(await apiClient.get<ApiEnvelope<Task>>(`/tasks/${taskID}`))
}

export async function createTask(projectID: string, input: TaskInput) {
  return dataFrom(await apiClient.post<ApiEnvelope<Task>>(`/projects/${projectID}/tasks`, input))
}

export async function updateTask(taskID: string, input: Partial<TaskInput>) {
  return dataFrom(await apiClient.put<ApiEnvelope<Task>>(`/tasks/${taskID}`, input))
}

export async function setTaskAssignees(taskID: string, assigneeIDs: string[]) {
  return dataFrom(await apiClient.patch<ApiEnvelope<Task>>(`/tasks/${taskID}/assignees`, { assignee_ids: assigneeIDs }))
}

export async function updateTaskStatus(taskID: string, status: TaskStatus) {
  return dataFrom(await apiClient.patch<ApiEnvelope<Task>>(`/tasks/${taskID}/status`, { status }))
}

export async function updateTaskProgress(taskID: string, progress: number) {
  return dataFrom(await apiClient.patch<ApiEnvelope<Task>>(`/tasks/${taskID}/progress`, { progress }))
}

export async function listUpcomingMilestones(withinDays: number, page: number, perPage: number) {
  const response = await apiClient.get<ApiEnvelope<Milestone[]>>('/milestones/upcoming', {
    params: { within_days: withinDays, page, per_page: perPage },
  })
  return {
    items: response.data.data,
    page: response.data.meta?.page ?? page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  } satisfies MilestonePage
}

export async function listDelayedMilestones(page: number, perPage: number) {
  const response = await apiClient.get<ApiEnvelope<Milestone[]>>('/milestones/delayed', {
    params: { page, per_page: perPage },
  })
  return {
    items: response.data.data,
    page: response.data.meta?.page ?? page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  } satisfies MilestonePage
}

export async function listCompletedMilestones(page: number, perPage: number) {
  const response = await apiClient.get<ApiEnvelope<Milestone[]>>('/milestones/completed', {
    params: { page, per_page: perPage },
  })
  return {
    items: response.data.data,
    page: response.data.meta?.page ?? page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  } satisfies MilestonePage
}

export async function listProjectMilestones(projectID: string, page: number, perPage: number) {
  const response = await apiClient.get<ApiEnvelope<Milestone[]>>(`/projects/${projectID}/milestones`, {
    params: { page, per_page: perPage },
  })
  return {
    items: response.data.data,
    page: response.data.meta?.page ?? page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  } satisfies MilestonePage
}

export async function getMilestone(milestoneID: string) {
  return dataFrom(await apiClient.get<ApiEnvelope<Milestone>>(`/milestones/${milestoneID}`))
}

export async function createMilestone(projectID: string, input: MilestoneInput) {
  return dataFrom(await apiClient.post<ApiEnvelope<Milestone>>(`/projects/${projectID}/milestones`, input))
}

export async function updateMilestone(milestoneID: string, input: Partial<MilestoneInput>) {
  return dataFrom(await apiClient.put<ApiEnvelope<Milestone>>(`/milestones/${milestoneID}`, input))
}

export async function updateMilestoneStatus(
  milestoneID: string,
  status: MilestoneStatus,
  actualDate?: string,
) {
  return dataFrom(await apiClient.patch<ApiEnvelope<Milestone>>(
    `/milestones/${milestoneID}/status`,
    { status, actual_date: actualDate || undefined },
  ))
}

export async function listProjectTaskAssignees(projectID: string) {
  const response = await apiClient.get<ApiEnvelope<TaskAssigneeOption[]>>(`/projects/${projectID}/task-assignees`)
  return response.data.data
}

export async function listTaskUsers(departmentID?: string) {
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
