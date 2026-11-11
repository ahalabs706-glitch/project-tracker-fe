import { apiClient } from '../../api/client'
import type { ApiEnvelope } from '../../api/types'
import type {
  ProjectDepartmentOption,
  ProjectUserOption,
} from '../projects/projects.api'
import { listProjects } from '../projects/projects.api'

export type ContractStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'RENEWAL_IN_PROGRESS'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'COMPLETED'

export type RenewalType = 'NONE' | 'MANUAL' | 'AUTOMATIC'
export type ExpirationLevel =
  | 'NORMAL'
  | 'EARLY_WARNING'
  | 'WARNING'
  | 'HIGH_PRIORITY'
  | 'CRITICAL'
  | 'EXPIRED'

export type ContractOwner = {
  id: string
  full_name: string
}

export type ContractDepartment = {
  id: string
  name: string
}

export type ContractProject = {
  id: string
  name: string
  project_code: string
}

export type ContractDocument = {
  id: string
  attachment_id: string
  original_filename: string
  content_type: string
  size_bytes: number
  document_type: string
  version: number
  uploaded_by: string
  created_at: string
}

export type ContractRenewal = {
  id: string
  original_contract_id: string
  renewed_contract_id: string
  contract_number: string
  contract_name: string
  renewal_date: string
  status: string
  notes: string | null
  created_by: string
  created_at: string
}

export type Contract = {
  id: string
  contract_number: string
  name: string
  contract_type: string | null
  vendor_name: string
  owner: ContractOwner
  department: ContractDepartment
  project: ContractProject | null
  start_date: string
  effective_date: string
  end_date: string
  contract_value: string
  currency: string
  renewal_type: RenewalType
  renewal_notice_days: number
  status: ContractStatus
  description: string | null
  days_remaining: number
  expiration_level: ExpirationLevel
  created_at: string
  updated_at: string
  renewal_history: ContractRenewal[]
  documents: ContractDocument[]
}

export type ContractInput = {
  contract_number: string
  name: string
  contract_type: string | null
  vendor_name: string
  owner_id: string
  department_id: string
  project_id: string | null
  start_date: string
  effective_date: string
  end_date: string
  contract_value: string
  currency: string
  renewal_type: RenewalType
  renewal_notice_days: number
  status: ContractStatus
  description: string | null
}

export type ContractRenewalInput = {
  new_contract_number: string
  new_start_date: string
  new_end_date: string
  new_contract_value: string
  currency: string
  notes: string
}

export type ContractFilters = {
  page: number
  per_page: number
  search: string
  status: string
  department_id: string
  owner_id: string
  project_id: string
  expiration_from: string
  expiration_to: string
  sort_by: string
  sort_order: string
}

export type ContractPage = {
  items: Contract[]
  page: number
  total: number
  total_pages: number
}

function dataFrom<T>(response: { data: ApiEnvelope<T> }) {
  return response.data.data
}

function pageFrom(response: { data: ApiEnvelope<Contract[]> }, page: number): ContractPage {
  return {
    items: response.data.data,
    page: response.data.meta?.page ?? page,
    total: response.data.meta?.total ?? 0,
    total_pages: response.data.meta?.total_pages ?? 0,
  }
}

function cleanFilters(filters: ContractFilters) {
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, value === '' ? undefined : value]),
  )
}

export async function listContracts(filters: ContractFilters) {
  return pageFrom(
    await apiClient.get<ApiEnvelope<Contract[]>>('/contracts', { params: cleanFilters(filters) }),
    filters.page,
  )
}

export async function listExpiringContracts(withinDays: number, filters: ContractFilters) {
  return pageFrom(
    await apiClient.get<ApiEnvelope<Contract[]>>('/contracts/expiring', {
      params: { ...cleanFilters(filters), within_days: withinDays },
    }),
    filters.page,
  )
}

export async function getContract(contractID: string) {
  return dataFrom(await apiClient.get<ApiEnvelope<Contract>>(`/contracts/${contractID}`))
}

export async function createContract(input: ContractInput) {
  return dataFrom(await apiClient.post<ApiEnvelope<Contract>>('/contracts', input))
}

export async function updateContract(contractID: string, input: ContractInput) {
  return dataFrom(await apiClient.put<ApiEnvelope<Contract>>(`/contracts/${contractID}`, input))
}

export async function listContractRenewals(contractID: string) {
  return dataFrom(await apiClient.get<ApiEnvelope<ContractRenewal[]>>(`/contracts/${contractID}/renewals`))
}

export async function renewContract(contractID: string, input: ContractRenewalInput) {
  return dataFrom(await apiClient.post<ApiEnvelope<Contract>>(`/contracts/${contractID}/renewals`, input))
}

export async function listContractUsers(departmentID?: string) {
  const response = await apiClient.get<ApiEnvelope<ProjectUserOption[]>>('/users', {
    params: { page: 1, per_page: 100, is_active: true, department_id: departmentID || undefined },
  })
  return response.data.data
}

export async function listContractDepartments() {
  return dataFrom(await apiClient.get<ApiEnvelope<ProjectDepartmentOption[]>>('/departments'))
}

export async function listContractProjects(departmentID: string, includeArchived = false) {
  const response = await listProjects({
    page: 1,
    per_page: 100,
    search: '',
    status: '',
    department_id: departmentID,
    priority: '',
    sort_by: 'name',
    sort_order: 'ASC',
    include_archived: includeArchived,
  })
  return response.projects.filter((project) => !project.archived_at)
}
