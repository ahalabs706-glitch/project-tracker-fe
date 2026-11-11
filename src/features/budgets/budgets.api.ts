import { apiClient } from '../../api/client'
import type { ApiEnvelope } from '../../api/types'
import type { Project, ProjectBudgetSummary } from '../projects/projects.api'

export type BudgetCategory = {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
}

export type BudgetAllocation = {
  id: string
  project_id: string
  category_id: string
  category_code: string
  category_name: string
  planned_amount: string
  approved_amount: string
  currency: string
  created_at: string
  updated_at: string
}

export type BudgetAllocationInput = {
  category_id: string
  planned_amount: string
  approved_amount: string
  currency: string
}

export type BudgetTransactionType = 'COMMITMENT' | 'EXPENSE'
export type BudgetTransactionStatus = 'DRAFT' | 'POSTED' | 'CANCELLED'

export type BudgetTransaction = {
  id: string
  budget_id: string
  category_id: string
  category_code: string
  category_name: string
  transaction_number: string
  transaction_type: BudgetTransactionType
  amount: string
  currency: string
  transaction_date: string
  description: string | null
  reference_number: string | null
  status: BudgetTransactionStatus
  original_commitment_id: string | null
  corrects_transaction_id: string | null
  correction_reason: string | null
  created_by: string
  posted_at: string | null
  created_at: string
  updated_at: string
}

export type BudgetTransactionInput = {
  budget_id: string
  transaction_number: string
  transaction_type: BudgetTransactionType
  amount: string
  transaction_date: string
  description: string | null
  reference_number: string | null
  original_commitment_id: string | null
  status: 'DRAFT'
}

export type BudgetCorrectionInput = {
  transaction_number: string
  amount: string
  transaction_date: string
  description: string | null
  reference_number: string | null
  reason: string
}

export type BudgetTransactionFilters = {
  page: number
  per_page: number
  category_id: string
  transaction_type: string
  status: string
  date_from: string
  date_to: string
}

export type BudgetTransactionPage = {
  items: BudgetTransaction[]
  page: number
  total: number
  total_pages: number
}

function dataFrom<T>(response: { data: ApiEnvelope<T> }) {
  return response.data.data
}

export async function listBudgetProjects(): Promise<Project[]> {
  const response = await apiClient.get<ApiEnvelope<Project[]>>('/projects', {
    params: {
      page: 1,
      per_page: 100,
      sort_by: 'name',
      sort_order: 'ASC',
      include_archived: false,
    },
  })
  return response.data.data.filter((project) => !project.archived_at)
}

export async function getBudgetSummary(projectID: string) {
  return dataFrom(
    await apiClient.get<ApiEnvelope<ProjectBudgetSummary>>(`/projects/${projectID}/budget`),
  )
}

export async function listBudgetCategories() {
  return dataFrom(await apiClient.get<ApiEnvelope<BudgetCategory[]>>('/budget-categories'))
}

export async function listBudgetAllocations(projectID: string) {
  return dataFrom(
    await apiClient.get<ApiEnvelope<BudgetAllocation[]>>(`/projects/${projectID}/budget/allocations`),
  )
}

export async function createBudgetAllocation(projectID: string, input: BudgetAllocationInput) {
  return dataFrom(
    await apiClient.post<ApiEnvelope<BudgetAllocation>>(`/projects/${projectID}/budget/allocations`, input),
  )
}

export async function updateBudgetAllocation(
  projectID: string,
  allocationID: string,
  input: BudgetAllocationInput,
) {
  return dataFrom(
    await apiClient.put<ApiEnvelope<BudgetAllocation>>(
      `/projects/${projectID}/budget/allocations/${allocationID}`,
      input,
    ),
  )
}

export async function listBudgetTransactions(projectID: string, filters: BudgetTransactionFilters) {
  const response = await apiClient.get<ApiEnvelope<BudgetTransaction[]>>(
    `/projects/${projectID}/budget/transactions`,
    {
      params: Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [key, value === '' ? undefined : value]),
      ),
    },
  )
  return {
    items: response.data.data,
    page: response.data.meta?.page ?? filters.page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  } satisfies BudgetTransactionPage
}

export async function createBudgetTransaction(projectID: string, input: BudgetTransactionInput) {
  return dataFrom(
    await apiClient.post<ApiEnvelope<BudgetTransaction>>(`/projects/${projectID}/budget/transactions`, input),
  )
}

export async function postBudgetTransaction(transactionID: string) {
  return dataFrom(
    await apiClient.post<ApiEnvelope<BudgetTransaction>>(`/budget/transactions/${transactionID}/post`),
  )
}

export async function cancelBudgetTransaction(transactionID: string) {
  return dataFrom(
    await apiClient.post<ApiEnvelope<BudgetTransaction>>(`/budget/transactions/${transactionID}/cancel`),
  )
}

export async function correctBudgetTransaction(
  transactionID: string,
  input: BudgetCorrectionInput,
) {
  return dataFrom(
    await apiClient.post<ApiEnvelope<BudgetTransaction>>(
      `/budget/transactions/${transactionID}/correct`,
      input,
    ),
  )
}
