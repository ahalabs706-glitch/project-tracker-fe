import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  FilePenLine,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
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
  cancelBudgetTransaction,
  correctBudgetTransaction,
  createBudgetAllocation,
  createBudgetTransaction,
  getBudgetSummary,
  listBudgetAllocations,
  listBudgetCategories,
  listBudgetProjects,
  listBudgetTransactions,
  postBudgetTransaction,
  updateBudgetAllocation,
  type BudgetAllocation,
  type BudgetAllocationInput,
  type BudgetCategory,
  type BudgetCorrectionInput,
  type BudgetTransaction,
  type BudgetTransactionFilters,
  type BudgetTransactionInput,
  type BudgetTransactionStatus,
  type BudgetTransactionType,
} from './budgets.api'
import './budgets.css'

const pageSize = 10
const transactionTypes: BudgetTransactionType[] = ['COMMITMENT', 'EXPENSE']
const transactionStatuses: BudgetTransactionStatus[] = ['DRAFT', 'POSTED', 'CANCELLED']

function formatAmount(value: string, currency: string) {
  const [whole = '0', fraction = ''] = value.split('.')
  const grouped = new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(BigInt(whole || '0'))
  return `${currency} ${grouped}${fraction ? `.${fraction.padEnd(2, '0')}` : ''}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

function budgetTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'NORMAL') return 'success'
  if (status === 'WARNING') return 'warning'
  if (status === 'CRITICAL' || status === 'OVER_BUDGET') return 'danger'
  return 'neutral'
}

function transactionTone(status: BudgetTransactionStatus): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'POSTED') return 'success'
  if (status === 'CANCELLED') return 'danger'
  return 'warning'
}

function canManageProjectBudget(
  project: { department_id: string } | undefined,
  user: ReturnType<typeof useAuth>['user'],
) {
  if (!project || !user) return false
  if (user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')) return true
  return user.roles.includes('FINANCE') && user.department?.id === project.department_id
}

function BudgetAllocationForm({
  projectCurrency,
  categories,
  existing,
  onSubmit,
  onCancel,
  submitting,
}: {
  projectCurrency: string
  categories: BudgetCategory[]
  existing?: BudgetAllocation
  onSubmit: (input: BudgetAllocationInput) => Promise<unknown>
  onCancel: () => void
  submitting: boolean
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const schema = z.object({
    category_id: z.string().min(1, 'Select a budget category.'),
    planned_amount: z.string().regex(/^\d{1,18}(\.\d{1,2})?$/, 'Enter a non-negative amount with up to 2 decimal places.'),
    approved_amount: z.string().regex(/^\d{1,18}(\.\d{1,2})?$/, 'Enter a non-negative amount with up to 2 decimal places.'),
  })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      category_id: existing?.category_id ?? '',
      planned_amount: existing?.planned_amount ?? '',
      approved_amount: existing?.approved_amount ?? '',
    },
  })
  const submit = async (values: Values) => {
    setServerError(null)
    try {
      await onSubmit({ ...values, currency: projectCurrency })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }
  return (
    <form className="budget-form" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <Feedback tone="error" title="Allocation could not be saved">{serverError}</Feedback>}
      <label className="budget-form__field">
        <span>Category</span>
        <select disabled={Boolean(existing)} {...register('category_id')}>
          <option value="">Select category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.code})</option>)}
          {existing && !categories.some((category) => category.id === existing.category_id) &&
            <option value={existing.category_id}>{existing.category_name} ({existing.category_code})</option>}
        </select>
        {errors.category_id?.message && <small className="budget-form__error">{errors.category_id.message}</small>}
      </label>
      <div className="budget-form__row">
        <TextField error={errors.planned_amount?.message} inputMode="decimal" label={`Planned amount (${projectCurrency})`} {...register('planned_amount')} />
        <TextField error={errors.approved_amount?.message} inputMode="decimal" label={`Approved amount (${projectCurrency})`} {...register('approved_amount')} />
      </div>
      <p className="budget-form__hint">Amounts are decimal strings in the project currency. The backend enforces the project allocation limit.</p>
      <div className="budget-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={submitting} type="submit">{submitting ? 'Saving…' : existing ? 'Save allocation' : 'Add allocation'}</Button>
      </div>
    </form>
  )
}

function TransactionForm({
  allocations,
  postedCommitments,
  canPost,
  onSubmit,
  onCancel,
  submitting,
}: {
  allocations: BudgetAllocation[]
  postedCommitments: BudgetTransaction[]
  canPost: boolean
  onSubmit: (input: BudgetTransactionInput) => Promise<unknown>
  onCancel: () => void
  submitting: boolean
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const schema = z.object({
    budget_id: z.string().min(1, 'Select a category allocation.'),
    transaction_number: z.string().trim().min(1, 'Enter a transaction number.').max(100),
    transaction_type: z.enum(transactionTypes),
    amount: z.string().regex(/^\d{1,18}(\.\d{1,2})?$/, 'Enter a positive amount with up to 2 decimal places.')
      .refine((value) => /[1-9]/.test(value), 'Amount must be greater than zero.'),
    transaction_date: z.string().min(1, 'Select a transaction date.'),
    description: z.string().max(5000, 'Use 5,000 characters or fewer.'),
    reference_number: z.string().max(100, 'Use 100 characters or fewer.'),
    original_commitment_id: z.string(),
  })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, control, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      budget_id: allocations[0]?.id ?? '',
      transaction_number: '',
      transaction_type: 'EXPENSE',
      amount: '',
      transaction_date: '',
      description: '',
      reference_number: '',
      original_commitment_id: '',
    },
  })
  const type = useWatch({ control, name: 'transaction_type' })
  const selectedBudgetID = useWatch({ control, name: 'budget_id' })
  const linkedCommitments = postedCommitments.filter((commitment) => commitment.budget_id === selectedBudgetID)
  const submit = async (values: Values) => {
    setServerError(null)
    try {
      await onSubmit({
        ...values,
        description: values.description.trim() || null,
        reference_number: values.reference_number.trim() || null,
        original_commitment_id: type === 'EXPENSE' ? values.original_commitment_id || null : null,
        status: 'DRAFT',
      })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }
  return (
    <form className="budget-form" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <Feedback tone="error" title="Transaction could not be created">{serverError}</Feedback>}
      <label className="budget-form__field">
        <span>Budget category</span>
        <select {...register('budget_id')}>
          <option value="">Select allocation</option>
          {allocations.map((allocation) => <option key={allocation.id} value={allocation.id}>{allocation.category_name} · {allocation.currency}</option>)}
        </select>
        {errors.budget_id?.message && <small className="budget-form__error">{errors.budget_id.message}</small>}
      </label>
      <div className="budget-form__row">
        <TextField error={errors.transaction_number?.message} label="Transaction number" {...register('transaction_number')} />
        <label className="budget-form__field">
          <span>Type</span>
          <select {...register('transaction_type')}>{transactionTypes.map((transactionType) => <option key={transactionType} value={transactionType}>{transactionType}</option>)}</select>
        </label>
      </div>
      <div className="budget-form__row">
        <TextField error={errors.amount?.message} inputMode="decimal" label="Amount" {...register('amount')} />
        <TextField error={errors.transaction_date?.message} label="Transaction date" type="date" {...register('transaction_date')} />
      </div>
      {type === 'EXPENSE' && (
        <label className="budget-form__field">
          <span>Linked posted commitment (optional)</span>
          <select {...register('original_commitment_id')}>
            <option value="">Not linked</option>
            {linkedCommitments.map((commitment) => (
              <option key={commitment.id} value={commitment.id}>
                {commitment.transaction_number} · {formatAmount(commitment.amount, commitment.currency)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="budget-form__row">
        <TextField error={errors.reference_number?.message} label="Reference number (optional)" {...register('reference_number')} />
        <label className="budget-form__field"><span>Description (optional)</span><textarea maxLength={5000} rows={2} {...register('description')} /></label>
      </div>
      <p className="budget-form__hint">
        New transactions are created as DRAFT. {canPost ? 'You can post them after review.' : 'A user with posting permission must post them.'}
      </p>
      <div className="budget-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={submitting || allocations.length === 0} type="submit">{submitting ? 'Creating…' : 'Create draft transaction'}</Button>
      </div>
    </form>
  )
}

function CorrectionForm({
  transaction,
  onSubmit,
  onCancel,
  submitting,
}: {
  transaction: BudgetTransaction
  onSubmit: (input: BudgetCorrectionInput) => Promise<unknown>
  onCancel: () => void
  submitting: boolean
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const schema = z.object({
    transaction_number: z.string().trim().min(1, 'Enter a replacement transaction number.').max(100),
    amount: z.string().regex(/^\d{1,18}(\.\d{1,2})?$/, 'Enter a positive amount with up to 2 decimal places.')
      .refine((value) => /[1-9]/.test(value), 'Amount must be greater than zero.'),
    transaction_date: z.string().min(1, 'Select a transaction date.'),
    description: z.string().max(5000, 'Use 5,000 characters or fewer.'),
    reference_number: z.string().max(100, 'Use 100 characters or fewer.'),
    reason: z.string().trim().min(1, 'Explain why this transaction is being corrected.').max(1000),
  })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      transaction_number: `${transaction.transaction_number}-CORR`,
      amount: transaction.amount,
      transaction_date: transaction.transaction_date,
      description: transaction.description ?? '',
      reference_number: transaction.reference_number ?? '',
      reason: '',
    },
  })
  const submit = async (values: Values) => {
    setServerError(null)
    try {
      await onSubmit({
        ...values,
        description: values.description.trim() || null,
        reference_number: values.reference_number.trim() || null,
        reason: values.reason.trim(),
      })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }
  return (
    <form className="budget-form" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <Feedback tone="error" title="Transaction correction failed">{serverError}</Feedback>}
      <Feedback tone="warning" title="This action replaces the posted transaction">
        The original will be retained as CANCELLED and a new POSTED transaction will be created. This transaction can only be corrected once.
      </Feedback>
      <TextField autoFocus error={errors.transaction_number?.message} label="Replacement transaction number" {...register('transaction_number')} />
      <div className="budget-form__row">
        <TextField error={errors.amount?.message} inputMode="decimal" label={`Replacement amount (${transaction.currency})`} {...register('amount')} />
        <TextField error={errors.transaction_date?.message} label="Transaction date" type="date" {...register('transaction_date')} />
      </div>
      <div className="budget-form__row">
        <TextField error={errors.reference_number?.message} label="Reference number (optional)" {...register('reference_number')} />
        <label className="budget-form__field"><span>Description (optional)</span><textarea maxLength={5000} rows={2} {...register('description')} /></label>
      </div>
      <label className="budget-form__field"><span>Correction reason</span><textarea maxLength={1000} rows={3} {...register('reason')} />{errors.reason?.message && <small className="budget-form__error">{errors.reason.message}</small>}</label>
      <div className="budget-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={submitting} type="submit" variant="danger">{submitting ? 'Correcting…' : 'Correct transaction'}</Button>
      </div>
    </form>
  )
}

function SummaryCard({ label, value, currency }: { label: string; value: string; currency: string }) {
  return <div className="budget-summary__card"><span>{label}</span><strong>{formatAmount(value, currency)}</strong></div>
}

export function BudgetsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const projectID = searchParams.get('project_id') ?? ''
  const [filters, setFilters] = useState<BudgetTransactionFilters>({
    page: 1,
    per_page: pageSize,
    category_id: '',
    transaction_type: '',
    status: '',
    date_from: '',
    date_to: '',
  })
  const [allocationOpen, setAllocationOpen] = useState(false)
  const [editingAllocation, setEditingAllocation] = useState<BudgetAllocation | null>(null)
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [correctingTransaction, setCorrectingTransaction] = useState<BudgetTransaction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const projectsQuery = useQuery({
    queryKey: ['budget-projects'],
    queryFn: listBudgetProjects,
    staleTime: 30_000,
  })
  const selectedProject = projectsQuery.data?.find((project) => project.id === projectID)
  const isTransactionsPath = location.pathname.endsWith('/transactions')
  const canReadBudgets = Boolean(user?.permissions.includes('budgets.read'))
  const summaryQuery = useQuery({
    queryKey: ['project-budget', projectID],
    queryFn: () => getBudgetSummary(projectID),
    enabled: Boolean(projectID) && canReadBudgets,
  })
  const allocationsQuery = useQuery({
    queryKey: ['budget-allocations', projectID],
    queryFn: () => listBudgetAllocations(projectID),
    enabled: Boolean(projectID) && canReadBudgets,
  })
  const categoriesQuery = useQuery({
    queryKey: ['budget-categories'],
    queryFn: listBudgetCategories,
    enabled: Boolean(projectID) && canReadBudgets,
    staleTime: 60_000,
  })
  const transactionsQuery = useQuery({
    queryKey: ['budget-transactions', projectID, filters],
    queryFn: () => listBudgetTransactions(projectID, filters),
    enabled: Boolean(projectID) && Boolean(user?.permissions.includes('budget_transactions.read')),
  })
  const transactions = transactionsQuery.data?.items ?? []
  const canManage = Boolean(
    user?.permissions.includes('budgets.manage') && canManageProjectBudget(selectedProject, user),
  )
  const canCreateTransaction = Boolean(
    user?.permissions.includes('budget_transactions.create') &&
    canManageProjectBudget(selectedProject, user),
  )
  const commitmentsQuery = useQuery({
    queryKey: ['budget-transactions', projectID, 'posted-commitments'],
    queryFn: () => listBudgetTransactions(projectID, {
      page: 1,
      per_page: 100,
      category_id: '',
      transaction_type: 'COMMITMENT',
      status: 'POSTED',
      date_from: '',
      date_to: '',
    }),
    enabled: Boolean(projectID) && transactionOpen && canCreateTransaction,
  })
  const postedCommitments = commitmentsQuery.data?.items ?? []
  const canPost = Boolean(
    user?.permissions.includes('budget_transactions.post') &&
    canManageProjectBudget(selectedProject, user),
  )
  const canCancel = Boolean(
    user?.permissions.includes('budget_transactions.cancel') &&
    canManageProjectBudget(selectedProject, user),
  )
  const canReadTransactions = Boolean(user?.permissions.includes('budget_transactions.read'))

  useEffect(() => {
    if (
      projectsQuery.data?.[0] &&
      (!projectID || !projectsQuery.data.some((project) => project.id === projectID))
    ) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.set('project_id', projectsQuery.data![0].id)
        return next
      }, { replace: true })
    }
  }, [projectID, projectsQuery.data, setSearchParams])

  const invalidateBudget = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['project-budget', projectID] }),
    queryClient.invalidateQueries({ queryKey: ['budget-allocations', projectID] }),
    queryClient.invalidateQueries({ queryKey: ['budget-transactions', projectID] }),
  ])
  const allocationMutation = useMutation({
    mutationFn: (input: BudgetAllocationInput) => editingAllocation
      ? updateBudgetAllocation(projectID, editingAllocation.id, input)
      : createBudgetAllocation(projectID, input),
    onSuccess: async () => {
      await invalidateBudget()
      setAllocationOpen(false)
      setEditingAllocation(null)
      setActionError(null)
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const transactionMutation = useMutation({
    mutationFn: (input: BudgetTransactionInput) => createBudgetTransaction(projectID, input),
    onSuccess: async () => {
      await invalidateBudget()
      setTransactionOpen(false)
      setActionError(null)
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const postMutation = useMutation({
    mutationFn: postBudgetTransaction,
    onSuccess: async () => { await invalidateBudget(); setActionError(null) },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const cancelMutation = useMutation({
    mutationFn: cancelBudgetTransaction,
    onSuccess: async () => { await invalidateBudget(); setActionError(null) },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const correctionMutation = useMutation({
    mutationFn: ({ transactionID, input }: { transactionID: string; input: BudgetCorrectionInput }) =>
      correctBudgetTransaction(transactionID, input),
    onSuccess: async () => {
      await invalidateBudget()
      setCorrectingTransaction(null)
      setActionError(null)
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })

  const updateFilter = (key: keyof BudgetTransactionFilters, value: string | number) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }
  const summary = summaryQuery.data
  const allocations = allocationsQuery.data ?? []
  const categories = (categoriesQuery.data ?? []).filter((category) => category.is_active)
  const availableCategories = categories.filter(
    (category) => !allocations.some((allocation) => allocation.category_id === category.id),
  )
  const summaryError = summaryQuery.error ?? allocationsQuery.error ?? categoriesQuery.error

  const columns = useMemo<DataTableColumn<BudgetTransaction>[]>(() => [
    {
      key: 'transaction',
      header: 'Transaction',
      render: (transaction) => (
        <div className="budget-table__identity">
          <strong>{transaction.transaction_number}</strong>
          <span>{transaction.category_name}{transaction.description ? ` · ${transaction.description}` : ''}</span>
          {transaction.corrects_transaction_id && <small>Correction: {transaction.correction_reason}</small>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (transaction) => formatDate(transaction.transaction_date),
    },
    {
      key: 'type',
      header: 'Type',
      render: (transaction) => <span className={`budget-type budget-type--${transaction.transaction_type.toLowerCase()}`}>{transaction.transaction_type}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (transaction) => <strong className="budget-table__amount">{formatAmount(transaction.amount, transaction.currency)}</strong>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (transaction) => <StatusBadge tone={transactionTone(transaction.status)}>{transaction.status}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (transaction) => (
        <div className="budget-table__actions">
          {transaction.status === 'DRAFT' && canPost && (
            <Button disabled={postMutation.isPending} onClick={() => {
              setActionError(null)
              postMutation.mutate(transaction.id)
            }} size="small" variant="secondary">Post</Button>
          )}
          {transaction.status === 'DRAFT' && canCancel && (
            <Button disabled={cancelMutation.isPending} onClick={() => {
              if (!window.confirm(`Cancel draft transaction ${transaction.transaction_number}?`)) return
              setActionError(null)
              cancelMutation.mutate(transaction.id)
            }} size="small" variant="danger">Cancel</Button>
          )}
          {transaction.status === 'POSTED' && canPost && (
            <Button onClick={() => { correctionMutation.reset(); setCorrectingTransaction(transaction) }} size="small" variant="secondary">
              <FilePenLine size={13} /> Correct
            </Button>
          )}
        </div>
      ),
    },
  ], [canCancel, canPost, cancelMutation, correctionMutation, postMutation])

  if (projectsQuery.isError) {
    return <div className="budgets-page"><Feedback tone="error" title="Budget projects couldn’t be loaded">{getErrorMessage(projectsQuery.error)}</Feedback><Button onClick={() => void projectsQuery.refetch()} variant="secondary"><RefreshCw size={15} /> Try again</Button></div>
  }

  if (projectsQuery.isPending) {
    return <div className="budgets-page"><div className="budgets-loading" aria-label="Loading budget projects" aria-live="polite"><span /><span /></div></div>
  }

  if (projectsQuery.data?.length === 0) {
    return <div className="budgets-page"><EmptyState icon={<Wallet size={20} />} title="No accessible projects" description="Projects you are authorized to view will appear here." /></div>
  }

  if (!selectedProject) {
    return <div className="budgets-page"><div className="budgets-loading" aria-label="Loading project budget" aria-live="polite"><span /><span /></div></div>
  }

  return (
    <div className="budgets-page">
      <header className="budgets-heading">
        <div><p className="budgets-eyebrow">FINANCIAL MANAGEMENT</p><h2>{isTransactionsPath ? 'Budget transactions' : 'Budget overview'}</h2><p>Totals and utilization are calculated by the backend from approved budget and posted transactions.</p></div>
        <label className="budgets-project-picker">
          <span>Project</span>
          <select
            onChange={(event) => {
              const next = new URLSearchParams(searchParams)
              next.set('project_id', event.target.value)
              setSearchParams(next)
              setFilters((current) => ({ ...current, page: 1 }))
            }}
            value={projectID}
          >
            {projectsQuery.data?.map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.name}</option>)}
          </select>
        </label>
      </header>
      <div className="budgets-subnav">
        <Link className={!isTransactionsPath ? 'budgets-subnav__active' : ''} to={`/budgets?project_id=${projectID}`}><Wallet size={15} /> Overview</Link>
        {canReadTransactions && <Link className={isTransactionsPath ? 'budgets-subnav__active' : ''} to={`/budgets/transactions?project_id=${projectID}`}><FilePenLine size={15} /> Transactions</Link>}
      </div>
      {actionError && <Feedback tone="error" title="Budget action failed">{actionError}</Feedback>}
      {!isTransactionsPath && (summaryQuery.isError || allocationsQuery.isError || categoriesQuery.isError) ? (
        <>
          <Feedback tone="error" title="Project budget couldn’t be loaded">{getErrorMessage(summaryError)}</Feedback>
          <Button onClick={() => {
            void summaryQuery.refetch()
            void allocationsQuery.refetch()
            void categoriesQuery.refetch()
          }} variant="secondary"><RefreshCw size={15} /> Try again</Button>
        </>
      ) : !isTransactionsPath && (summaryQuery.isPending || allocationsQuery.isPending || categoriesQuery.isPending) ? (
        <div className="budgets-loading" aria-label="Loading project budget" aria-live="polite"><span /><span /><span /></div>
      ) : !isTransactionsPath && summary && (
        <>
          <section className="budget-project-heading">
            <div><span>{selectedProject.project_code}</span><h3>{selectedProject.name}</h3></div>
            <StatusBadge tone={budgetTone(summary.status)}>{summary.status.replace('_', ' ')}</StatusBadge>
          </section>
          <section aria-label="Backend budget summary" className="budget-summary">
            <SummaryCard currency={summary.currency} label="Approved budget" value={summary.approved_budget} />
            <SummaryCard currency={summary.currency} label="Planned allocation" value={summary.planned_budget} />
            <SummaryCard currency={summary.currency} label="Committed cost" value={summary.committed_cost} />
            <SummaryCard currency={summary.currency} label="Actual cost" value={summary.actual_cost} />
            <SummaryCard currency={summary.currency} label="Forecast cost" value={summary.forecast_cost} />
            <SummaryCard currency={summary.currency} label="Remaining budget" value={summary.remaining_budget} />
            <SummaryCard currency={summary.currency} label="Budget variance" value={summary.budget_variance} />
            <div className="budget-summary__card">
              <span>Utilization</span>
              <strong>{summary.utilization_percentage.toLocaleString(undefined, { maximumFractionDigits: 2 })}%</strong>
              <span className="budget-summary__note">Actual cost ÷ approved budget</span>
            </div>
          </section>
          <section className="budget-panel">
            <header className="budget-panel__heading">
              <div><h3>Category allocations</h3><p>Allocation limits and totals are enforced by the backend.</p></div>
              {canManage && availableCategories.length > 0 && (
                <Button onClick={() => {
                  allocationMutation.reset()
                  setEditingAllocation(null)
                  setAllocationOpen(true)
                }} size="small"><CirclePlus size={14} /> Add category</Button>
              )}
            </header>
            {allocationMutation.isError && <Feedback tone="error" title="Allocation could not be saved">{getErrorMessage(allocationMutation.error)}</Feedback>}
            {allocations.length === 0 ? (
              <EmptyState icon={<Wallet size={18} />} title="No category allocations" description={canManage ? 'Add budget categories to plan and approve project spending.' : 'This project has no budget categories allocated yet.'} />
            ) : (
              <div className="budget-allocation-list">
                {allocations.map((allocation) => (
                  <article className="budget-allocation" key={allocation.id}>
                    <div className="budget-allocation__category"><strong>{allocation.category_name}</strong><span>{allocation.category_code}</span></div>
                    <div><span>Planned</span><strong>{formatAmount(allocation.planned_amount, allocation.currency)}</strong></div>
                    <div><span>Approved</span><strong>{formatAmount(allocation.approved_amount, allocation.currency)}</strong></div>
                    {canManage && <Button aria-label={`Edit ${allocation.category_name} allocation`} onClick={() => {
                      allocationMutation.reset()
                      setEditingAllocation(allocation)
                      setAllocationOpen(true)
                    }} size="small" variant="secondary"><FilePenLine size={14} /> Edit</Button>}
                  </article>
                ))}
              </div>
            )}
          </section>
          {canReadTransactions && <section className="budget-panel">
            <header className="budget-panel__heading">
              <div><h3>Transactions</h3><p>Draft and cancelled records are shown but excluded from financial totals.</p></div>
              <div className="budget-panel__actions">
                <Link className="button button--secondary button--small" to={`/budgets/transactions?project_id=${projectID}`}>View transactions <ArrowLeft className="budget-link-arrow" size={14} /></Link>
                {canCreateTransaction && allocations.length > 0 && <Button onClick={() => {
                  transactionMutation.reset()
                  setTransactionOpen(true)
                }} size="small"><CirclePlus size={14} /> New transaction</Button>}
              </div>
            </header>
            {transactionsQuery.isError ? (
              <><Feedback tone="error" title="Transactions couldn’t be loaded">{getErrorMessage(transactionsQuery.error)}</Feedback><Button onClick={() => void transactionsQuery.refetch()} size="small" variant="secondary"><RefreshCw size={14} /> Try again</Button></>
            ) : transactionsQuery.isPending ? (
              <div className="budgets-loading" aria-label="Loading transactions" />
            ) : transactions.length === 0 ? (
              <EmptyState icon={<FilePenLine size={18} />} title="No transactions yet" description={canCreateTransaction ? 'Create a draft commitment or expense for this project.' : 'Transactions for this project will appear here.'} />
            ) : (
              <DataTable columns={columns} getRowKey={(transaction) => transaction.id} rows={transactions.slice(0, 5)} />
            )}
          </section>}
          <Dialog description="Project currency is applied to this allocation; approved amounts cannot exceed the project budget." onClose={() => {
            setAllocationOpen(false)
            setEditingAllocation(null)
          }} open={allocationOpen} title={editingAllocation ? 'Edit budget allocation' : 'Add budget allocation'}>
            <BudgetAllocationForm
              categories={editingAllocation ? categories : availableCategories}
              existing={editingAllocation ?? undefined}
              onCancel={() => { setAllocationOpen(false); setEditingAllocation(null) }}
              onSubmit={(input) => allocationMutation.mutateAsync(input)}
              projectCurrency={selectedProject.currency}
              submitting={allocationMutation.isPending}
            />
          </Dialog>
        </>
      )}
      {isTransactionsPath && (
        <section className="budget-panel budget-panel--full">
          <header className="budget-panel__heading">
            <div><h3>Transaction register</h3><p>Filter and manage transaction records. Posted records require a correction, not an edit.</p></div>
            {canCreateTransaction && allocations.length > 0 && <Button onClick={() => {
              transactionMutation.reset()
              setTransactionOpen(true)
            }} size="small"><CirclePlus size={14} /> New transaction</Button>}
          </header>
          <section aria-label="Transaction filters" className="budget-filters">
            <label><span>Category</span>
              <select onChange={(event) => updateFilter('category_id', event.target.value)} value={filters.category_id}>
                <option value="">All categories</option>
                {allocations.map((allocation) => <option key={allocation.id} value={allocation.category_id}>{allocation.category_name}</option>)}
              </select>
            </label>
            <label><span>Type</span>
              <select onChange={(event) => updateFilter('transaction_type', event.target.value)} value={filters.transaction_type}>
                <option value="">All types</option><option value="COMMITMENT">Commitment</option><option value="EXPENSE">Expense</option>
              </select>
            </label>
            <label><span>Status</span>
              <select onChange={(event) => updateFilter('status', event.target.value)} value={filters.status}>
                <option value="">All statuses</option>{transactionStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <TextField label="From date" type="date" value={filters.date_from} onChange={(event) => updateFilter('date_from', event.target.value)} />
            <TextField label="To date" type="date" value={filters.date_to} onChange={(event) => updateFilter('date_to', event.target.value)} />
          </section>
          {transactionsQuery.isError ? (
            <><Feedback tone="error" title="Transactions couldn’t be loaded">{getErrorMessage(transactionsQuery.error)}</Feedback><Button onClick={() => void transactionsQuery.refetch()} variant="secondary"><RefreshCw size={15} /> Try again</Button></>
          ) : transactionsQuery.isPending ? (
            <div className="budgets-loading" aria-label="Loading transactions" aria-live="polite"><span /><span /><span /></div>
          ) : (
            <>
              <div className="budget-list-meta">{(transactionsQuery.data?.total ?? 0).toLocaleString()} transactions</div>
              <DataTable columns={columns} emptyTitle="No matching transactions" emptyDescription="Adjust filters or create a transaction if you have permission." getRowKey={(transaction) => transaction.id} rows={transactions} />
              {transactions.length > 0 && (
                <nav aria-label="Transaction pages" className="budget-pagination">
                  <span>Page {filters.page} of {Math.max(transactionsQuery.data?.total_pages ?? 1, 1)}</span>
                  <div>
                    <Button disabled={filters.page <= 1 || transactionsQuery.isFetching} onClick={() => updateFilter('page', filters.page - 1)} size="small" variant="secondary"><ChevronLeft size={15} /> Previous</Button>
                    <Button disabled={!transactionsQuery.data?.total_pages || filters.page >= transactionsQuery.data.total_pages || transactionsQuery.isFetching} onClick={() => updateFilter('page', filters.page + 1)} size="small" variant="secondary">Next <ChevronRight size={15} /></Button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section>
      )}
      <Dialog description="New budget transactions are created as drafts. Posted transaction values cannot be edited or deleted." onClose={() => setTransactionOpen(false)} open={transactionOpen} title="Create transaction">
        <TransactionForm
          allocations={allocations}
          canPost={canPost}
          onCancel={() => setTransactionOpen(false)}
          onSubmit={(input) => transactionMutation.mutateAsync(input)}
          postedCommitments={postedCommitments}
          submitting={transactionMutation.isPending}
        />
      </Dialog>
      <Dialog description="Create a transaction to replace the posted record. The original and correction reason are retained." onClose={() => setCorrectingTransaction(null)} open={Boolean(correctingTransaction)} title="Correct posted transaction">
        {correctingTransaction && (
          <CorrectionForm
            onCancel={() => setCorrectingTransaction(null)}
            onSubmit={(input) => correctionMutation.mutateAsync({ transactionID: correctingTransaction.id, input })}
            submitting={correctionMutation.isPending}
            transaction={correctingTransaction}
          />
        )}
      </Dialog>
    </div>
  )
}
