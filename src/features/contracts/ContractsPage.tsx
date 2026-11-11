import { zodResolver } from '@hookform/resolvers/zod'
import { useDeferredValue, useMemo, useState, useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock3,
  ExternalLink,
  FileText,
  RefreshCw,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { getErrorMessage } from '../../api/errors'
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Feedback,
  StatusBadge,
  TextField,
  type DataTableColumn,
} from '../../components/ui'
import { useAuth } from '../auth/AuthContext'
import {
  createContract,
  getContract,
  listContractDepartments,
  listContractRenewals,
  listContractUsers,
  listContractProjects,
  listContracts,
  listExpiringContracts,
  renewContract,
  updateContract,
  type Contract,
  type ContractFilters,
  type ContractInput,
  type ContractRenewalInput,
  type ContractStatus,
  type ExpirationLevel,
  type RenewalType,
} from './contracts.api'
import './contracts.css'

const contractStatuses: ContractStatus[] = [
  'DRAFT',
  'UNDER_REVIEW',
  'ACTIVE',
  'EXPIRING_SOON',
  'RENEWAL_IN_PROGRESS',
  'EXPIRED',
  'TERMINATED',
  'COMPLETED',
]
const renewalTypes: RenewalType[] = ['NONE', 'MANUAL', 'AUTOMATIC']
const pageSize = 10

const statusLabels: Record<ContractStatus, string> = {
  DRAFT: 'Draft',
  UNDER_REVIEW: 'Under review',
  ACTIVE: 'Active',
  EXPIRING_SOON: 'Expiring soon',
  RENEWAL_IN_PROGRESS: 'Renewal in progress',
  EXPIRED: 'Expired',
  TERMINATED: 'Terminated',
  COMPLETED: 'Completed',
}

const expirationLabels: Record<ExpirationLevel, string> = {
  NORMAL: 'Normal',
  EARLY_WARNING: 'Early warning',
  WARNING: 'Warning',
  HIGH_PRIORITY: 'High priority',
  CRITICAL: 'Critical',
  EXPIRED: 'Expired',
}

function statusTone(status: ContractStatus): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'ACTIVE') return 'success'
  if (status === 'EXPIRING_SOON' || status === 'RENEWAL_IN_PROGRESS' || status === 'UNDER_REVIEW') return 'warning'
  if (status === 'EXPIRED' || status === 'TERMINATED') return 'danger'
  if (status === 'COMPLETED') return 'info'
  return 'neutral'
}

function expirationTone(level: ExpirationLevel): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (level === 'EXPIRED' || level === 'CRITICAL') return 'danger'
  if (level === 'HIGH_PRIORITY' || level === 'WARNING' || level === 'EARLY_WARNING') return 'warning'
  return 'success'
}

function formatContractDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

function formatContractMoney(value: string, currency: string) {
  const [whole = '0', fraction = ''] = value.split('.')
  const grouped = new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(BigInt(whole || '0'))
  return `${currency} ${grouped}${fraction ? `.${fraction.padEnd(2, '0')}` : ''}`
}

function canManageContract(contract: Contract, user: ReturnType<typeof useAuth>['user']) {
  if (!user) return false
  if (user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')) return true
  return user.department?.id === contract.department.id &&
    (user.id === contract.owner.id || user.roles.includes('CONTRACT_MANAGER'))
}

const contractSchema = z.object({
  contract_number: z.string().trim().min(1, 'Enter a contract number.').max(100),
  name: z.string().trim().min(1, 'Enter a contract name.').max(255),
  contract_type: z.string().max(100, 'Use 100 characters or fewer.'),
  vendor_name: z.string().trim().min(1, 'Enter a vendor name.').max(255),
  owner_id: z.string().min(1, 'Select an owner.'),
  department_id: z.string().min(1, 'Select a department.'),
  project_id: z.string(),
  start_date: z.string().min(1, 'Select a start date.'),
  effective_date: z.string().min(1, 'Select an effective date.'),
  end_date: z.string().min(1, 'Select an end date.'),
  contract_value: z.string().regex(/^\d{1,18}(\.\d{1,2})?$/, 'Enter a non-negative amount with up to 2 decimal places.'),
  currency: z.string().regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code.'),
  renewal_type: z.enum(renewalTypes),
  renewal_notice_days: z.coerce.number().int().min(0).max(3650),
  status: z.enum(contractStatuses),
  description: z.string().max(5000, 'Use 5,000 characters or fewer.'),
}).superRefine((values, context) => {
  if (values.start_date && values.effective_date && values.start_date > values.effective_date) {
    context.addIssue({ code: 'custom', message: 'Effective date must be on or after the start date.', path: ['effective_date'] })
  }
  if (values.effective_date && values.end_date && values.effective_date > values.end_date) {
    context.addIssue({ code: 'custom', message: 'End date must be on or after the effective date.', path: ['end_date'] })
  }
})

type ContractFormValues = z.output<typeof contractSchema>

function ContractForm({
  contract,
  onSubmit,
  onCancel,
  submitting,
}: {
  contract?: Contract
  onSubmit: (input: ContractInput) => Promise<unknown>
  onCancel: () => void
  submitting: boolean
}) {
  const { user } = useAuth()
  const permissions = user?.permissions ?? []
  const canReadDepartments = permissions.includes('departments.read')
  const canReadUsers = permissions.includes('users.read')
  const canReadProjects = permissions.includes('projects.read')
  const [serverError, setServerError] = useState<string | null>(null)
  const departmentsQuery = useQuery({
    queryKey: ['contract-departments'],
    queryFn: listContractDepartments,
    enabled: canReadDepartments,
    staleTime: 60_000,
  })
  const usersQuery = useQuery({
    queryKey: ['contract-users'],
    queryFn: () => listContractUsers(),
    enabled: canReadUsers,
    staleTime: 60_000,
  })
  const departments = (() => {
    const options = new Map((departmentsQuery.data ?? []).map((department) => [department.id, department]))
    if (user?.department && !options.has(user.department.id)) {
      options.set(user.department.id, {
        id: user.department.id,
        code: '',
        name: user.department.name,
        is_active: true,
      })
    }
    if (contract?.department && !options.has(contract.department.id)) {
      options.set(contract.department.id, {
        id: contract.department.id,
        code: '',
        name: contract.department.name,
        is_active: true,
      })
    }
    const optionsList = [...options.values()]
    if (!user?.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN') && user?.department) {
      return optionsList.filter((item) => item.id === user.department?.id)
    }
    return optionsList
  })()
  const { register, handleSubmit, setValue, reset, control, formState: { errors } } = useForm<
    z.input<typeof contractSchema>,
    unknown,
    ContractFormValues
  >({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      contract_number: contract?.contract_number ?? '',
      name: contract?.name ?? '',
      contract_type: contract?.contract_type ?? '',
      vendor_name: contract?.vendor_name ?? '',
      owner_id: contract?.owner.id ?? user?.id ?? '',
      department_id: contract?.department.id ?? user?.department?.id ?? '',
      project_id: contract?.project?.id ?? '',
      start_date: contract?.start_date ?? '',
      effective_date: contract?.effective_date ?? '',
      end_date: contract?.end_date ?? '',
      contract_value: contract?.contract_value ?? '',
      currency: contract?.currency ?? 'IDR',
      renewal_type: contract?.renewal_type ?? 'MANUAL',
      renewal_notice_days: contract?.renewal_notice_days ?? 90,
      status: contract?.status ?? 'ACTIVE',
      description: contract?.description ?? '',
    },
  })
  const departmentID = useWatch({ control, name: 'department_id' })
  const projectsQuery = useQuery({
    queryKey: ['contract-project-options', departmentID],
    queryFn: () => listContractProjects(departmentID),
    enabled: canReadProjects && Boolean(departmentID),
    staleTime: 60_000,
  })
  useEffect(() => {
    reset({
      contract_number: contract?.contract_number ?? '',
      name: contract?.name ?? '',
      contract_type: contract?.contract_type ?? '',
      vendor_name: contract?.vendor_name ?? '',
      owner_id: contract?.owner.id ?? user?.id ?? '',
      department_id: contract?.department.id ?? user?.department?.id ?? '',
      project_id: contract?.project?.id ?? '',
      start_date: contract?.start_date ?? '',
      effective_date: contract?.effective_date ?? '',
      end_date: contract?.end_date ?? '',
      contract_value: contract?.contract_value ?? '',
      currency: contract?.currency ?? 'IDR',
      renewal_type: contract?.renewal_type ?? 'MANUAL',
      renewal_notice_days: contract?.renewal_notice_days ?? 90,
      status: contract?.status ?? 'ACTIVE',
      description: contract?.description ?? '',
    })
  }, [contract, reset, user])
  const ownerOptions = (() => {
    const options = new Map(
      (usersQuery.data ?? [])
        .filter((option) => option.is_active && option.department?.id === departmentID)
        .map((option) => [option.id, option]),
    )
    if (user?.department?.id === departmentID && user && !options.has(user.id)) {
      options.set(user.id, {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        department: user.department,
        is_active: true,
      })
    }
    if (contract?.department.id === departmentID && contract.owner && !options.has(contract.owner.id)) {
      options.set(contract.owner.id, {
        id: contract.owner.id,
        full_name: contract.owner.full_name,
        email: '',
        department: contract.department,
        is_active: true,
      })
    }
    return [...options.values()]
  })()
  const projectOptions = (() => {
    const options = new Map<string, { id: string; project_code: string; name: string }>(
      (projectsQuery.data ?? []).map((project) => [project.id, project]),
    )
    if (contract?.department.id === departmentID && contract.project && !options.has(contract.project.id)) {
      options.set(contract.project.id, {
        id: contract.project.id,
        project_code: contract.project.project_code,
        name: contract.project.name,
      })
    }
    return [...options.values()]
  })()

  const submit = async (values: ContractFormValues) => {
    setServerError(null)
    try {
      await onSubmit({
        ...values,
        contract_type: values.contract_type.trim() || null,
        project_id: values.project_id || null,
        contract_value: values.contract_value.trim(),
        currency: values.currency.trim().toUpperCase(),
        description: values.description.trim() || null,
      })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  return (
    <form className="contract-form" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <Feedback tone="error" title="Contract could not be saved">{serverError}</Feedback>}
      <div className="contract-form__row">
        <TextField autoFocus error={errors.contract_number?.message} label="Contract number" {...register('contract_number')} />
        <TextField error={errors.name?.message} label="Contract name" {...register('name')} />
      </div>
      <div className="contract-form__row">
        <TextField error={errors.contract_type?.message} label="Contract type (optional)" {...register('contract_type')} />
        <TextField error={errors.vendor_name?.message} label="Vendor" {...register('vendor_name')} />
      </div>
      <div className="contract-form__row">
        <label className="contract-form__field">
          <span>Department</span>
          <select
            aria-invalid={Boolean(errors.department_id)}
            {...register('department_id', { onChange: (event) => {
              const nextDepartment = event.target.value as string
              setValue('owner_id', user?.department?.id === nextDepartment ? user.id : '')
              setValue('project_id', '')
            } })}
          >
            <option value="">Select department</option>
            {departments.map((department) => <option disabled={!department.is_active} key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          {errors.department_id?.message && <small className="contract-form__error">{errors.department_id.message}</small>}
          {departmentsQuery.isError && <small className="contract-form__error">{getErrorMessage(departmentsQuery.error)}</small>}
        </label>
        <label className="contract-form__field">
          <span>Owner</span>
          <select aria-invalid={Boolean(errors.owner_id)} {...register('owner_id')}>
            <option value="">Select owner</option>
            {ownerOptions.map((option) => <option key={option.id} value={option.id}>{option.full_name}</option>)}
          </select>
          {errors.owner_id?.message && <small className="contract-form__error">{errors.owner_id.message}</small>}
          {usersQuery.isError && <small className="contract-form__error">{getErrorMessage(usersQuery.error)}</small>}
        </label>
      </div>
      <label className="contract-form__field">
        <span>Related project (optional)</span>
        <select {...register('project_id')}>
          <option value="">No related project</option>
          {projectOptions.map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.name}</option>)}
        </select>
        {projectsQuery.isError && <small className="contract-form__error">{getErrorMessage(projectsQuery.error)}</small>}
      </label>
      <div className="contract-form__row">
        <TextField error={errors.start_date?.message} label="Start date" type="date" {...register('start_date')} />
        <TextField error={errors.effective_date?.message} label="Effective date" type="date" {...register('effective_date')} />
        <TextField error={errors.end_date?.message} label="End date" type="date" {...register('end_date')} />
      </div>
      <div className="contract-form__row">
        <TextField error={errors.contract_value?.message} inputMode="decimal" label="Contract value" {...register('contract_value')} />
        <TextField error={errors.currency?.message} label="Currency" maxLength={3} {...register('currency')} />
      </div>
      <div className="contract-form__row">
        <label className="contract-form__field">
          <span>Renewal type</span>
          <select {...register('renewal_type')}>{renewalTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
        </label>
        <TextField error={errors.renewal_notice_days?.message} label="Renewal notice (days)" max="3650" min="0" type="number" {...register('renewal_notice_days')} />
        <label className="contract-form__field">
          <span>Status</span>
          <select {...register('status')}>{contractStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>
        </label>
      </div>
      <label className="contract-form__field">
        <span>Description</span>
        <textarea maxLength={5000} rows={3} {...register('description')} />
        {errors.description?.message && <small className="contract-form__error">{errors.description.message}</small>}
      </label>
      {(!canReadUsers || !canReadDepartments) &&
        <p className="contract-form__hint">Some assignment options are limited by your account permissions; the server validates every owner and department.</p>}
      <div className="contract-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={submitting} type="submit">{submitting ? 'Saving…' : contract ? 'Save changes' : 'Create contract'}</Button>
      </div>
    </form>
  )
}

function RenewalForm({
  contract,
  onSubmit,
  onCancel,
  submitting,
}: {
  contract: Contract
  onSubmit: (input: ContractRenewalInput) => Promise<unknown>
  onCancel: () => void
  submitting: boolean
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const schema = z.object({
    new_contract_number: z.string().trim().min(1, 'Enter the new contract number.').max(100),
    new_start_date: z.string().min(1, 'Select the new start date.'),
    new_end_date: z.string().min(1, 'Select the new end date.'),
    new_contract_value: z.string().regex(/^\d{1,18}(\.\d{1,2})?$/, 'Enter a non-negative amount with up to 2 decimal places.'),
    currency: z.string().regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code.'),
    notes: z.string().max(5000, 'Use 5,000 characters or fewer.'),
  }).refine((value) => value.new_end_date >= value.new_start_date, {
    message: 'End date must be on or after the start date.',
    path: ['new_end_date'],
  })
  type Values = z.output<typeof schema>
  const { register, handleSubmit, formState: { errors } } = useForm<z.input<typeof schema>, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      new_contract_number: '',
      new_start_date: contract.end_date,
      new_end_date: '',
      new_contract_value: contract.contract_value,
      currency: contract.currency,
      notes: '',
    },
  })
  const submit = async (values: Values) => {
    setServerError(null)
    try {
      await onSubmit({ ...values, currency: values.currency.toUpperCase(), notes: values.notes.trim() })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }
  return (
    <form className="contract-form" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <Feedback tone="error" title="Contract renewal could not be created">{serverError}</Feedback>}
      <p className="contract-form__hint">The backend creates a new contract from this one and marks the original as completed. Vendor, owner, department, project, and renewal settings carry over.</p>
      <TextField autoFocus error={errors.new_contract_number?.message} label="New contract number" {...register('new_contract_number')} />
      <div className="contract-form__row">
        <TextField error={errors.new_start_date?.message} label="New start date" type="date" {...register('new_start_date')} />
        <TextField error={errors.new_end_date?.message} label="New end date" type="date" {...register('new_end_date')} />
      </div>
      <div className="contract-form__row">
        <TextField error={errors.new_contract_value?.message} inputMode="decimal" label="New contract value" {...register('new_contract_value')} />
        <TextField error={errors.currency?.message} label="Currency" maxLength={3} {...register('currency')} />
      </div>
      <label className="contract-form__field">
        <span>Renewal notes</span>
        <textarea maxLength={5000} rows={3} {...register('notes')} />
      </label>
      <div className="contract-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={submitting} type="submit">{submitting ? 'Renewing…' : 'Create renewal'}</Button>
      </div>
    </form>
  )
}

function ContractTable({
  items,
  emptyTitle,
}: {
  items: Contract[]
  emptyTitle: string
}) {
  const columns = useMemo<DataTableColumn<Contract>[]>(() => [
    {
      key: 'contract',
      header: 'Contract',
      render: (contract) => (
        <div className="contract-table__identity">
          <Link to={`/contracts/${contract.id}`}>{contract.name}</Link>
          <span>{contract.contract_number} · {contract.vendor_name}</span>
        </div>
      ),
    },
    {
      key: 'end-date',
      header: 'End date',
      render: (contract) => (
        <span className={contract.days_remaining <= 0 ? 'contract-table__expired' : ''}>
          {contract.days_remaining <= 30 && <Clock3 size={13} aria-label="Expiring soon" />}
          {formatContractDate(contract.end_date)}
        </span>
      ),
    },
    {
      key: 'expiration',
      header: 'Expiration',
      render: (contract) => <div className="contract-table__classification">
        <StatusBadge tone={expirationTone(contract.expiration_level)}>{expirationLabels[contract.expiration_level]}</StatusBadge>
        <span>{contract.days_remaining <= 0 ? `${Math.abs(contract.days_remaining)} days past end date` : `${contract.days_remaining} days remaining`}</span>
      </div>,
    },
    {
      key: 'value',
      header: 'Value',
      render: (contract) => <span className="contract-table__value">{formatContractMoney(contract.contract_value, contract.currency)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (contract) => <StatusBadge tone={statusTone(contract.status)}>{statusLabels[contract.status]}</StatusBadge>,
    },
  ], [])
  return (
    <DataTable
      columns={columns}
      emptyDescription="Try changing the filters, or create a contract if you have permission."
      emptyTitle={emptyTitle}
      getRowKey={(contract) => contract.id}
      rows={items}
    />
  )
}

export function ContractsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const expiringOnly = location.pathname.endsWith('/expiring')
  const [filters, setFilters] = useState<ContractFilters>({
    page: 1,
    per_page: pageSize,
    search: '',
    status: '',
    department_id: '',
    owner_id: '',
    project_id: '',
    expiration_from: '',
    expiration_to: '',
    sort_by: 'end_date',
    sort_order: 'ASC',
  })
  const [search, setSearch] = useState('')
  const [withinDays, setWithinDays] = useState(90)
  const [createOpen, setCreateOpen] = useState(false)
  const deferredSearch = useDeferredValue(search.trim())
  const queryFilters = { ...filters, search: deferredSearch }
  const canReadDepartments = user?.permissions.includes('departments.read') ?? false
  const canReadUsers = user?.permissions.includes('users.read') ?? false
  const canReadProjects = user?.permissions.includes('projects.read') ?? false
  const departmentsQuery = useQuery({
    queryKey: ['contract-departments'],
    queryFn: listContractDepartments,
    enabled: canReadDepartments,
    staleTime: 60_000,
  })
  const usersQuery = useQuery({
    queryKey: ['contract-users'],
    queryFn: () => listContractUsers(),
    enabled: canReadUsers,
    staleTime: 60_000,
  })
  const projectsQuery = useQuery({
    queryKey: ['contract-filter-projects', filters.department_id],
    queryFn: () => listContractProjects(filters.department_id, true),
    enabled: canReadProjects,
    staleTime: 60_000,
  })
  const query = useQuery({
    queryKey: ['contracts', expiringOnly, withinDays, queryFilters],
    queryFn: () => expiringOnly
      ? listExpiringContracts(withinDays, queryFilters)
      : listContracts(queryFilters),
    staleTime: 30_000,
  })
  const createMutation = useMutation({
    mutationFn: createContract,
    onSuccess: async (contract) => {
      await queryClient.invalidateQueries({ queryKey: ['contracts'] })
      setCreateOpen(false)
      navigate(`/contracts/${contract.id}`)
    },
  })
  const updateFilter = (key: keyof ContractFilters, value: string | number) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }
  const canCreate = user?.permissions.includes('contracts.create') ?? false

  if (query.isError) {
    return <div className="contracts-page"><Feedback tone="error" title="Contracts couldn’t be loaded">{getErrorMessage(query.error)}</Feedback><Button onClick={() => void query.refetch()} variant="secondary"><RefreshCw size={15} /> Try again</Button></div>
  }

  return (
    <div className="contracts-page">
      <header className="contracts-heading">
        <div>
          <p className="contracts-eyebrow">CONTRACT MANAGEMENT</p>
          <h2>{expiringOnly ? 'Expiring contracts' : 'Contracts'}</h2>
          <p>Contract status and expiration levels are calculated by the backend business calendar.</p>
        </div>
        <div className="contracts-heading__actions">
          <Link className={`button button--secondary ${expiringOnly ? '' : 'contracts-heading__selected'}`} to="/contracts"><FileText size={15} /> All contracts</Link>
          <Link className={`button button--secondary ${expiringOnly ? 'contracts-heading__selected' : ''}`} to="/contracts/expiring"><BriefcaseBusiness size={15} /> Expiring</Link>
          {canCreate && <Button onClick={() => { createMutation.reset(); setCreateOpen(true) }}><CirclePlus size={16} /> New contract</Button>}
        </div>
      </header>
      {departmentsQuery.isError && <Feedback tone="error" title="Department filters unavailable">{getErrorMessage(departmentsQuery.error)}</Feedback>}
      {usersQuery.isError && <Feedback tone="error" title="Owner filters unavailable">{getErrorMessage(usersQuery.error)}</Feedback>}
      {projectsQuery.isError && <Feedback tone="error" title="Project filters unavailable">{getErrorMessage(projectsQuery.error)}</Feedback>}
      <section aria-label="Contract filters" className="contracts-filters">
        <label className="contracts-search">
          <span>Search</span>
          <input maxLength={100} onChange={(event) => { setSearch(event.target.value); setFilters((current) => ({ ...current, page: 1 })) }} placeholder="Contract, vendor, or number" value={search} />
        </label>
        <label><span>Status</span>
          <select onChange={(event) => updateFilter('status', event.target.value)} value={filters.status}>
            <option value="">All statuses</option>
            {contractStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </label>
        {canReadDepartments && (
          <label><span>Department</span>
            <select onChange={(event) => {
              const departmentID = event.target.value
              setFilters((current) => ({
                ...current,
                department_id: departmentID,
                owner_id: '',
                project_id: '',
                page: 1,
              }))
            }} value={filters.department_id}>
              <option value="">All departments</option>
              {(departmentsQuery.data ?? []).filter((item) => item.is_active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
        )}
        {canReadUsers && (
          <label><span>Owner</span>
            <select onChange={(event) => updateFilter('owner_id', event.target.value)} value={filters.owner_id}>
              <option value="">All owners</option>
              {(usersQuery.data ?? [])
                .filter((item) => item.is_active && (!filters.department_id || item.department?.id === filters.department_id))
                .map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
            </select>
          </label>
        )}
        {canReadProjects && (
          <label><span>Project</span>
            <select onChange={(event) => updateFilter('project_id', event.target.value)} value={filters.project_id}>
              <option value="">All projects</option>
              {(projectsQuery.data ?? [])
                .filter((project) => !filters.department_id || project.department_id === filters.department_id)
                .map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.name}</option>)}
            </select>
          </label>
        )}
        {expiringOnly ? (
          <label><span>Window</span>
            <select onChange={(event) => { setWithinDays(Number(event.target.value)); setFilters((current) => ({ ...current, page: 1 })) }} value={withinDays}>
              <option value={30}>Next 30 days</option><option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option><option value={180}>Next 180 days</option>
              <option value={365}>Next 365 days</option>
            </select>
          </label>
        ) : (
          <>
            <TextField label="Ending from" type="date" value={filters.expiration_from} onChange={(event) => updateFilter('expiration_from', event.target.value)} />
            <TextField label="Ending to" type="date" value={filters.expiration_to} onChange={(event) => updateFilter('expiration_to', event.target.value)} />
          </>
        )}
        <label><span>Sort by</span>
          <select onChange={(event) => updateFilter('sort_by', event.target.value)} value={filters.sort_by}>
            <option value="end_date">End date</option><option value="name">Name</option>
            <option value="contract_number">Contract number</option><option value="status">Status</option>
            <option value="contract_value">Contract value</option><option value="created_at">Recently created</option>
          </select>
        </label>
        <button aria-label={`Sort ${filters.sort_order === 'ASC' ? 'ascending' : 'descending'}`} className="contracts-sort" onClick={() => updateFilter('sort_order', filters.sort_order === 'ASC' ? 'DESC' : 'ASC')} type="button">
          {filters.sort_order === 'ASC' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
        </button>
      </section>
      {query.isPending ? (
        <div className="contracts-loading" aria-label="Loading contracts" aria-live="polite">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
      ) : (
        <>
          <div className="contracts-list-meta">
            <span>{(query.data?.total ?? 0).toLocaleString()} {query.data?.total === 1 ? 'contract' : 'contracts'}</span>
            {query.isFetching && <span><RefreshCw size={13} /> Updating…</span>}
          </div>
          <ContractTable items={query.data?.items ?? []} emptyTitle={deferredSearch || filters.status ? 'No matching contracts' : expiringOnly ? 'No contracts in this window' : 'No contracts yet'} />
          {(query.data?.items.length ?? 0) > 0 && (
            <nav aria-label="Contract pages" className="contracts-pagination">
              <span>Page {query.data?.page ?? filters.page} of {Math.max(query.data?.total_pages ?? 1, 1)}</span>
              <div>
                <Button disabled={filters.page <= 1 || query.isFetching} onClick={() => updateFilter('page', filters.page - 1)} size="small" variant="secondary"><ChevronLeft size={15} /> Previous</Button>
                <Button disabled={!query.data?.total_pages || filters.page >= query.data.total_pages || query.isFetching} onClick={() => updateFilter('page', filters.page + 1)} size="small" variant="secondary">Next <ChevronRight size={15} /></Button>
              </div>
            </nav>
          )}
        </>
      )}
      <Dialog description="Contract values are submitted as decimal strings; dates and ownership are validated by the server." onClose={() => setCreateOpen(false)} open={createOpen} title="Create contract">
        <ContractForm onCancel={() => setCreateOpen(false)} onSubmit={(input) => createMutation.mutateAsync(input)} submitting={createMutation.isPending} />
      </Dialog>
    </div>
  )
}

export function ContractDetailPage() {
  const { contractId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const contractQuery = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => getContract(contractId),
    enabled: Boolean(contractId),
  })
  const contract = contractQuery.data
  const renewalsQuery = useQuery({
    queryKey: ['contract-renewals', contractId],
    queryFn: () => listContractRenewals(contractId),
    enabled: Boolean(contractId),
  })
  const canManage = Boolean(contract && user?.permissions.includes('contracts.update') && canManageContract(contract, user))
  const canRenew = Boolean(
    contract &&
    user?.permissions.includes('contracts.renew') &&
    canManageContract(contract, user) &&
    contract.renewal_type !== 'NONE' &&
    ['ACTIVE', 'EXPIRING_SOON', 'RENEWAL_IN_PROGRESS', 'EXPIRED'].includes(contract.status),
  )
  const updateMutation = useMutation({
    mutationFn: (input: ContractInput) => updateContract(contractId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contract', contractId] }),
        queryClient.invalidateQueries({ queryKey: ['contracts'] }),
      ])
      setEditOpen(false)
    },
  })
  const renewalMutation = useMutation({
    mutationFn: (input: ContractRenewalInput) => renewContract(contractId, input),
    onSuccess: async (renewedContract) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contract', contractId] }),
        queryClient.invalidateQueries({ queryKey: ['contract-renewals', contractId] }),
        queryClient.invalidateQueries({ queryKey: ['contracts'] }),
      ])
      setRenewOpen(false)
      navigate(`/contracts/${renewedContract.id}`)
    },
  })

  if (contractQuery.isPending) return <div className="contracts-loading contracts-loading--detail" aria-label="Loading contract" aria-live="polite"><span /><span /></div>
  if (contractQuery.isError || !contract) {
    return <div className="contracts-page"><Feedback tone="error" title="Contract couldn’t be loaded">{contractQuery.isError ? getErrorMessage(contractQuery.error) : 'Contract not found.'}</Feedback>{contractQuery.isError && <Button onClick={() => void contractQuery.refetch()} variant="secondary"><RefreshCw size={15} /> Try again</Button>}<Link className="button button--secondary" to="/contracts"><ArrowLeft size={15} /> Back to contracts</Link></div>
  }

  return (
    <div className="contracts-page contract-detail">
      <Link className="contracts-back" to="/contracts"><ArrowLeft size={15} /> All contracts</Link>
      <header className="contract-detail__heading">
        <div>
          <p className="contracts-eyebrow">{contract.contract_number} · {contract.vendor_name}</p>
          <div className="contract-detail__title">
            <h2>{contract.name}</h2>
            <StatusBadge tone={statusTone(contract.status)}>{statusLabels[contract.status]}</StatusBadge>
            <StatusBadge tone={expirationTone(contract.expiration_level)}>{expirationLabels[contract.expiration_level]}</StatusBadge>
          </div>
          <p>{contract.description || 'No contract description has been added.'}</p>
        </div>
        <div className="contract-detail__actions">
          {canManage && <Button onClick={() => { updateMutation.reset(); setEditOpen(true) }} variant="secondary">Edit contract</Button>}
          {canRenew && <Button onClick={() => { renewalMutation.reset(); setRenewOpen(true) }}><RefreshCw size={15} /> Renew contract</Button>}
        </div>
      </header>
      <section className="contract-facts" aria-label="Contract details">
        <div><span>Vendor</span><strong>{contract.vendor_name}</strong></div>
        <div><span>Owner</span><strong>{contract.owner.full_name}</strong></div>
        <div><span>Department</span><strong>{contract.department.name}</strong></div>
        <div><span>Project</span><strong>{contract.project
          ? user?.permissions.includes('projects.read')
            ? <Link to={`/projects/${contract.project.id}`}>{contract.project.project_code} · {contract.project.name}</Link>
            : `${contract.project.project_code} · ${contract.project.name}`
          : 'Not linked'}</strong></div>
        <div><span>Start date</span><strong>{formatContractDate(contract.start_date)}</strong></div>
        <div><span>Effective date</span><strong>{formatContractDate(contract.effective_date)}</strong></div>
        <div><span>End date</span><strong>{formatContractDate(contract.end_date)}</strong></div>
        <div><span>Contract value</span><strong>{formatContractMoney(contract.contract_value, contract.currency)}</strong></div>
        <div><span>Renewal settings</span><strong>{contract.renewal_type} · {contract.renewal_notice_days} days notice</strong></div>
        <div><span>Expiration</span><strong>{contract.days_remaining <= 0 ? `${Math.abs(contract.days_remaining)} days past end date` : `${contract.days_remaining} days remaining`}</strong></div>
      </section>
      <section className="contract-panel">
        <header className="contract-panel__heading"><div><h3>Renewal history</h3><p>Renewals preserve the original contract and link each successor.</p></div><RefreshCw size={17} /></header>
        {renewalsQuery.isPending ? (
          <div className="contracts-loading" aria-label="Loading renewal history" />
        ) : renewalsQuery.isError ? (
          <>
            <Feedback tone="error" title="Renewal history couldn’t be loaded">{getErrorMessage(renewalsQuery.error)}</Feedback>
            <Button onClick={() => void renewalsQuery.refetch()} variant="secondary"><RefreshCw size={15} /> Try again</Button>
          </>
        ) : (renewalsQuery.data?.length ?? 0) === 0 ? (
          <EmptyState icon={<RefreshCw size={18} />} title="No renewal history" description="This contract has not been renewed." />
        ) : (
          <div className="contract-history">
            {renewalsQuery.data?.map((renewal) => (
              <article className="contract-history__item" key={renewal.id}>
                <div><strong>{renewal.contract_number} · {renewal.contract_name}</strong><span>Renewed {formatContractDate(renewal.renewal_date)}</span></div>
                <StatusBadge tone="info">{renewal.status}</StatusBadge>
                <Link aria-label={`Open renewed contract ${renewal.contract_number}`} to={`/contracts/${renewal.renewed_contract_id}`}><ExternalLink size={15} /></Link>
                {renewal.notes && <p>{renewal.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="contract-panel">
        <header className="contract-panel__heading"><div><h3>Documents</h3><p>Document upload is not available until the backend upload workflow is implemented.</p></div><FileText size={17} /></header>
        {(contract.documents?.length ?? 0) === 0 ? (
          <EmptyState icon={<FileText size={18} />} title="No contract documents" description="There are no document records attached to this contract." />
        ) : (
          <ul className="contract-documents">
            {contract.documents.map((document) => (
              <li key={document.id}>
                <FileText size={16} />
                <span><strong>{document.original_filename}</strong><small>{document.document_type} · Version {document.version} · {(document.size_bytes / 1024).toFixed(1)} KB</small></span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Dialog description="Contract changes are validated and authorized by the backend." onClose={() => setEditOpen(false)} open={editOpen} title="Edit contract">
        <ContractForm contract={contract} onCancel={() => setEditOpen(false)} onSubmit={(input) => updateMutation.mutateAsync(input)} submitting={updateMutation.isPending} />
      </Dialog>
      <Dialog description="Renewal creates a new contract and preserves this record in history." onClose={() => setRenewOpen(false)} open={renewOpen} title="Renew contract">
        <RenewalForm contract={contract} onCancel={() => setRenewOpen(false)} onSubmit={(input) => renewalMutation.mutateAsync(input)} submitting={renewalMutation.isPending} />
      </Dialog>
    </div>
  )
}
