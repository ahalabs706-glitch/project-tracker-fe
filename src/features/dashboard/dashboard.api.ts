import { apiClient } from '../../api/client'
import type { ApiEnvelope } from '../../api/types'

export type DashboardFilters = {
  date_from: string
  date_to: string
  department_id: string
  status: string
}

export type DashboardOverview = {
  projects: {
    total: number
    active: number
    completed: number
    delayed: number
    on_hold: number
  }
  contracts: {
    active: number
    expiring_soon: number
    expired: number
  }
  budget: BudgetSummary[]
}

export type BudgetSummary = {
  currency: string
  approved_budget: string
  committed_cost: string
  actual_cost: string
  forecast_cost: string
  utilization_percentage: number
}

export type ProjectStatusSummary = {
  total: number
  statuses: Record<string, number>
  delayed: number
}

export type DashboardAlerts = {
  delayed_projects: number
  delayed_milestones: number
  overdue_tasks: number
  expiring_contracts: number
  over_budget_projects: number
}

export type DashboardMilestone = {
  id: string
  project_id: string
  project_name: string
  project_code: string | null
  name: string
  planned_date: string
  status: string
}

export type DashboardOverdueTask = {
  id: string
  project_id: string
  project_name: string
  project_code: string | null
  title: string
  status: string
  planned_due_date: string
  assignees: string[]
  progress: number
}

export type DashboardPage<T> = {
  items: T[]
  total: number
}

export type DashboardData = {
  overview: DashboardOverview
  projectStatus: ProjectStatusSummary
  alerts: DashboardAlerts
  milestones: DashboardPage<DashboardMilestone>
  overdueTasks: DashboardPage<DashboardOverdueTask>
}

function dashboardParams(filters: DashboardFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== ''),
  )
}

async function getData<T>(path: string, params: Record<string, string>) {
  const response = await apiClient.get<ApiEnvelope<T>>(path, { params })
  return response.data.data
}

async function getPage<T>(path: string, params: Record<string, string>) {
  const response = await apiClient.get<ApiEnvelope<T[]>>(path, {
    params: { ...params, page: '1', per_page: '5' },
  })
  return {
    items: response.data.data,
    total: response.data.meta?.total ?? response.data.data.length,
  }
}

export async function getDashboard(filters: DashboardFilters): Promise<DashboardData> {
  const params = dashboardParams(filters)
  const [overview, projectStatus, alerts, milestones, overdueTasks] =
    await Promise.all([
      getData<DashboardOverview>('/dashboard/overview', params),
      getData<ProjectStatusSummary>('/dashboard/project-status', params),
      getData<DashboardAlerts>('/dashboard/critical-alerts', params),
      getPage<DashboardMilestone>('/dashboard/upcoming-milestones', {
        ...params,
        within_days: '30',
      }),
      getPage<DashboardOverdueTask>('/dashboard/overdue-tasks', params),
    ])

  return { overview, projectStatus, alerts, milestones, overdueTasks }
}
