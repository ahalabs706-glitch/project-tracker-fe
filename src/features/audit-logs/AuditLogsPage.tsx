import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react'
import { getErrorMessage } from '../../api/errors'
import { Button, DataTable, Feedback, type DataTableColumn } from '../../components/ui'
import { listAuditLogs, type AuditLog, type AuditLogFilters } from './audit-logs.api'
import './audit-logs.css'

const pageSize = 20

const emptyFilters: AuditLogFilters = {
  action: '',
  entity_type: '',
  entity_id: '',
  date_from: '',
  date_to: '',
}

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value))
}

function formatJson(value: unknown) {
  if (value === undefined || value === null) return null
  return JSON.stringify(value, null, 2)
}

function AuditChanges({ entry }: { entry: AuditLog }) {
  const oldValue = formatJson(entry.old_value)
  const newValue = formatJson(entry.new_value)
  if (!oldValue && !newValue) return <span className="audit-table__muted">No change details</span>

  return (
    <details className="audit-table__details">
      <summary>View changes</summary>
      <div className="audit-table__values">
        {oldValue && <section><strong>Before</strong><pre>{oldValue}</pre></section>}
        {newValue && <section><strong>After</strong><pre>{newValue}</pre></section>}
      </div>
    </details>
  )
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState<AuditLogFilters>(emptyFilters)
  const [page, setPage] = useState(1)
  const logsQuery = useQuery({
    queryKey: ['audit-logs', page, appliedFilters],
    queryFn: () => listAuditLogs(page, pageSize, appliedFilters),
  })
  const entries = logsQuery.data?.items ?? []
  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: 'created_at',
      header: 'Date and time',
      render: (entry) => <time dateTime={entry.created_at}>{formatAuditDate(entry.created_at)}</time>,
    },
    {
      key: 'actor',
      header: 'User',
      render: (entry) => (
        <div className="audit-table__identity">
          <strong>{entry.actor_name ?? 'Unknown user'}</strong>
          {entry.actor_email && <span>{entry.actor_email}</span>}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (entry) => <code className="audit-table__action">{entry.action}</code>,
    },
    {
      key: 'entity',
      header: 'Record',
      render: (entry) => (
        <div className="audit-table__identity">
          <strong>{entry.entity_type}</strong>
          {entry.entity_id && <span className="audit-table__id">{entry.entity_id}</span>}
        </div>
      ),
    },
    {
      key: 'ip_address',
      header: 'IP address',
      render: (entry) => entry.ip_address ?? <span className="audit-table__muted">—</span>,
    },
    {
      key: 'changes',
      header: 'Changes',
      render: (entry) => <AuditChanges entry={entry} />,
    },
  ]

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setAppliedFilters({ ...filters })
  }
  const clearFilters = () => {
    setFilters(emptyFilters)
    setAppliedFilters(emptyFilters)
    setPage(1)
  }
  const hasFilters = Object.values(appliedFilters).some(Boolean)

  return (
    <main className="audit-page">
      <header className="audit-heading">
        <div>
          <p className="audit-eyebrow">SYSTEM ACTIVITY</p>
          <h2>Audit logs</h2>
          <p>Review recorded changes to users, projects, work items, contracts, and budgets.</p>
        </div>
        <Button disabled={logsQuery.isFetching} onClick={() => void logsQuery.refetch()} variant="secondary">
          <RefreshCw size={15} /> Refresh
        </Button>
      </header>

      <section aria-label="Audit log summary" className="audit-summary">
        <span><strong>{(logsQuery.data?.total ?? 0).toLocaleString()}</strong> recorded events</span>
        {hasFilters && <span>Filtered results</span>}
      </section>

      <form aria-label="Audit log filters" className="audit-filters" onSubmit={applyFilters}>
        <label>
          <span>Action (exact)</span>
          <input maxLength={100} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))} placeholder="e.g. PROJECT_UPDATED" value={filters.action} />
        </label>
        <label>
          <span>Record type</span>
          <select onChange={(event) => setFilters((current) => ({ ...current, entity_type: event.target.value }))} value={filters.entity_type}>
            <option value="">All record types</option>
            {['BUDGET', 'BUDGET_TRANSACTION', 'CONTRACT', 'DEPARTMENT', 'MILESTONE', 'PROJECT', 'ROLE', 'TASK', 'USER'].map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className="audit-filters__id">
          <span>Record ID</span>
          <input maxLength={36} onChange={(event) => setFilters((current) => ({ ...current, entity_id: event.target.value }))} placeholder="UUID" value={filters.entity_id} />
        </label>
        <label>
          <span>From</span>
          <input max={filters.date_to || undefined} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} type="date" value={filters.date_from} />
        </label>
        <label>
          <span>To</span>
          <input min={filters.date_from || undefined} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} type="date" value={filters.date_to} />
        </label>
        <div className="audit-filters__actions">
          <Button type="submit"><Search size={14} /> Apply filters</Button>
          <Button onClick={clearFilters} type="button" variant="secondary"><X size={14} /> Clear</Button>
        </div>
      </form>

      {logsQuery.isError ? (
        <section className="audit-panel">
          <Feedback tone="error" title="Audit logs couldn’t be loaded">{getErrorMessage(logsQuery.error)}</Feedback>
          <Button onClick={() => void logsQuery.refetch()} variant="secondary"><RefreshCw size={15} /> Try again</Button>
        </section>
      ) : logsQuery.isPending ? (
        <div aria-label="Loading audit logs" aria-live="polite" className="audit-loading"><span /><span /><span /></div>
      ) : (
        <section aria-label="Audit log entries" className="audit-panel">
          <DataTable
            columns={columns}
            emptyDescription={hasFilters
              ? 'Try adjusting or clearing the filters.'
              : 'Changes are recorded as users create or update users, projects, tasks, milestones, contracts, budgets, and role permissions.'}
            emptyTitle={hasFilters ? 'No matching audit events' : 'No audit events recorded yet'}
            getRowKey={(entry) => entry.id}
            rows={entries}
          />
          <nav aria-label="Audit log pages" className="audit-pagination">
            <span>{logsQuery.data?.total ?? 0} events · Page {page} of {Math.max(logsQuery.data?.total_pages ?? 1, 1)}</span>
            <div>
              <Button disabled={page <= 1 || logsQuery.isFetching} onClick={() => setPage((current) => current - 1)} size="small" variant="secondary">
                <ChevronLeft size={15} /> Previous
              </Button>
              <Button disabled={!logsQuery.data?.total_pages || page >= logsQuery.data.total_pages || logsQuery.isFetching} onClick={() => setPage((current) => current + 1)} size="small" variant="secondary">
                Next <ChevronRight size={15} />
              </Button>
            </div>
          </nav>
        </section>
      )}
    </main>
  )
}
