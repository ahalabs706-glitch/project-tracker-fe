import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpRight, CalendarDays, CircleDollarSign, FolderKanban, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Button, EmptyState, StatusBadge } from '../../components/ui'
import {
  getDashboard,
  type DashboardAlerts,
  type DashboardFilters,
  type DashboardMilestone,
  type DashboardOverdueTask,
} from './dashboard.api'
import './DashboardPage.css'

const initialFilters: DashboardFilters = {
  date_from: '',
  date_to: '',
  department_id: '',
  status: '',
}

const statusNames: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const statusColors: Record<string, string> = {
  DRAFT: '#9aa5b7',
  PENDING_APPROVAL: '#c49a38',
  APPROVED: '#5276ba',
  IN_PROGRESS: '#3156a4',
  ON_HOLD: '#9a6c2d',
  COMPLETED: '#398466',
  CANCELLED: '#b33d48',
}

function formatCurrency(value: string, currency: string) {
  const [integer = '0', fraction = '00'] = value.split('.')
  const formatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return formatter
    .formatToParts(BigInt(integer))
    .map((part) => (part.type === 'fraction' ? fraction.padEnd(2, '0').slice(0, 2) : part.value))
    .join('')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function toneForStatus(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'COMPLETED') return 'success'
  if (status === 'IN_PROGRESS' || status === 'APPROVED') return 'info'
  if (status === 'ON_HOLD' || status === 'PENDING_APPROVAL') return 'warning'
  if (status === 'CANCELLED') return 'danger'
  return 'neutral'
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'default',
}: {
  label: string
  value: number
  detail: string
  icon: React.ReactNode
  tone?: 'default' | 'warning' | 'danger'
}) {
  return (
    <article className={`dashboard-metric dashboard-metric--${tone}`}>
      <div className="dashboard-metric__top">
        <span className="dashboard-metric__label">{label}</span>
        <span className="dashboard-metric__icon" aria-hidden="true">{icon}</span>
      </div>
      <strong className="dashboard-metric__value">{value.toLocaleString()}</strong>
      <span className="dashboard-metric__detail">{detail}</span>
    </article>
  )
}

function DashboardSection({
  title,
  description,
  children,
  className = '',
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`dashboard-panel ${className}`}>
      <div className="dashboard-panel__heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function AlertList({ alerts }: { alerts: DashboardAlerts }) {
  const items = [
    { label: 'Delayed projects', value: alerts.delayed_projects, href: '/projects' },
    { label: 'Delayed milestones', value: alerts.delayed_milestones, href: '/milestones' },
    { label: 'Overdue tasks', value: alerts.overdue_tasks, href: '/my-tasks' },
    { label: 'Expiring contracts', value: alerts.expiring_contracts, href: '/contracts/expiring' },
    { label: 'Over-budget projects', value: alerts.over_budget_projects, href: '/budgets' },
  ]
  const total = items.reduce((sum, item) => sum + item.value, 0)

  if (total === 0) {
    return (
      <div className="dashboard-clear">
        <span aria-hidden="true">✓</span>
        <div><strong>No critical alerts</strong><p>There are no critical items in this view.</p></div>
      </div>
    )
  }

  return (
    <ul className="dashboard-alert-list">
      {items.filter((item) => item.value > 0).map((item) => (
        <li key={item.label}>
          <span className="dashboard-alert-list__mark" aria-hidden="true"><AlertTriangle size={15} /></span>
          <Link to={item.href}>{item.label}</Link>
          <strong>{item.value.toLocaleString()}</strong>
        </li>
      ))}
    </ul>
  )
}

function TimelineList<T extends DashboardMilestone | DashboardOverdueTask>({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: T[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (items.length === 0) {
    return <EmptyState icon={<CalendarDays size={20} />} title={emptyTitle} description={emptyDescription} />
  }

  return (
    <ul className="dashboard-timeline">
      {items.map((item) => {
        const isMilestone = 'planned_date' in item
        const date = isMilestone ? item.planned_date : item.planned_due_date
        const title = isMilestone ? item.name : item.title
        return (
          <li className={isMilestone ? undefined : 'dashboard-timeline__item--overdue'} key={item.id}>
            <span className={`dashboard-timeline__date${isMilestone ? '' : ' dashboard-timeline__date--warning'}`}>{formatDate(date)}</span>
            <div className="dashboard-timeline__content">
              <strong>{title}</strong>
              <span>{item.project_code ? `${item.project_code} · ` : ''}{item.project_name}</span>
              {!isMilestone && (
                <>
                  <span className="dashboard-timeline__assignees">
                    Assignee{item.assignees.length === 1 ? '' : 's'}: {item.assignees.length > 0 ? item.assignees.join(', ') : 'Unassigned'}
                  </span>
                  <div className="dashboard-timeline__progress">
                    <div
                      aria-label={`${item.title} progress`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={item.progress}
                      className="dashboard-timeline__progress-track"
                      role="progressbar"
                    >
                      <span style={{ width: `${item.progress}%` }} />
                    </div>
                    <strong>{item.progress.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</strong>
                  </div>
                </>
              )}
            </div>
            <StatusBadge tone={isMilestone ? toneForStatus(item.status) : 'warning'}>
              {statusNames[item.status] ?? item.status.replaceAll('_', ' ')}
            </StatusBadge>
          </li>
        )
      })}
    </ul>
  )
}

function LoadingDashboard() {
  return (
    <div className="dashboard-loading" aria-label="Loading dashboard" aria-live="polite">
      {Array.from({ length: 10 }, (_, index) => <span key={index} />)}
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState(initialFilters)
  const { data, error, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', user?.id, filters],
    queryFn: () => getDashboard(filters),
    staleTime: 60_000,
  })

  const setFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  if (isPending) return <LoadingDashboard />

  if (isError) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-error" role="alert">
          <div>
            <strong>Dashboard data couldn’t be loaded</strong>
            <p>{error instanceof Error ? error.message : 'Please try again.'}</p>
          </div>
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw size={15} /> Try again
          </Button>
        </div>
      </div>
    )
  }

  const { overview, projectStatus, alerts, milestones, overdueTasks } = data
  const statusEntries = Object.entries(projectStatus.statuses)
  const hasProjects = overview.projects.total > 0

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">OVERVIEW</p>
          <h1>Good to see you, {user?.full_name.split(' ')[0]}</h1>
          <p>Here’s what’s happening across your projects.</p>
        </div>
        <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw size={15} className={isFetching ? 'dashboard-spin' : ''} />
          {isFetching ? 'Refreshing' : 'Refresh'}
        </Button>
      </header>

      <form className="dashboard-filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>From</span>
          <input type="date" value={filters.date_from} max={filters.date_to || undefined} onChange={(event) => setFilter('date_from', event.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={filters.date_to} min={filters.date_from || undefined} onChange={(event) => setFilter('date_to', event.target.value)} />
        </label>
        <label>
          <span>Department</span>
          <select value={filters.department_id} onChange={(event) => setFilter('department_id', event.target.value)}>
            <option value="">All departments</option>
            {user?.department && <option value={user.department.id}>{user.department.name}</option>}
          </select>
        </label>
        <label>
          <span>Project status</span>
          <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(statusNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </label>
        <button className="dashboard-filter-reset" type="button" onClick={() => setFilters(initialFilters)}>Clear filters</button>
      </form>

      <section className="dashboard-metrics" aria-label="Project and contract metrics">
        <MetricCard label="Total projects" value={overview.projects.total} detail={`${overview.projects.completed} completed`} icon={<FolderKanban size={18} />} />
        <MetricCard label="Active projects" value={overview.projects.active} detail={`${overview.projects.on_hold} on hold`} icon={<ArrowUpRight size={18} />} />
        <MetricCard label="Delayed projects" value={overview.projects.delayed} detail="Past their target end date" tone={overview.projects.delayed > 0 ? 'warning' : 'default'} icon={<AlertTriangle size={18} />} />
        <MetricCard label="Expiring contracts" value={overview.contracts.expiring_soon} detail={`${overview.contracts.active} active contracts`} tone={overview.contracts.expiring_soon > 0 ? 'warning' : 'default'} icon={<CalendarDays size={18} />} />
      </section>

      <div className="dashboard-grid dashboard-grid--top">
        <DashboardSection title="Project status" description={`${projectStatus.total.toLocaleString()} projects in this view`}>
          {!hasProjects ? (
            <EmptyState icon={<FolderKanban size={20} />} title="No projects found" description="Try changing the filters or create a project to see it here." />
          ) : statusEntries.length === 0 ? (
            <EmptyState icon={<FolderKanban size={20} />} title="No status breakdown" description="The API returned no project status counts for this view." />
          ) : (
            <div className="dashboard-status">
              <div className="dashboard-status__bar" role="img" aria-label={statusEntries.map(([status, count]) => `${statusNames[status] ?? status}: ${count}`).join(', ')}>
                {statusEntries.map(([status, count]) => (
                  <span key={status} style={{ width: `${projectStatus.total ? (count / projectStatus.total) * 100 : 0}%`, backgroundColor: statusColors[status] ?? '#9aa5b7' }} />
                ))}
              </div>
              <ul>
                {statusEntries.map(([status, count]) => (
                  <li key={status}>
                    <span className="dashboard-status__dot" style={{ backgroundColor: statusColors[status] ?? '#9aa5b7' }} />
                    <span>{statusNames[status] ?? status.replaceAll('_', ' ')}</span>
                    <strong>{count.toLocaleString()}</strong>
                    <small>{projectStatus.total ? Math.round((count / projectStatus.total) * 100) : 0}%</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DashboardSection>

        <DashboardSection title="Critical alerts" description="Items that may need your attention">
          <AlertList alerts={alerts} />
        </DashboardSection>
      </div>

      <DashboardSection title="Budget overview" description="Backend totals grouped by currency">
        {overview.budget.length === 0 ? (
          <EmptyState icon={<CircleDollarSign size={20} />} title="No budget data" description="Budget summaries will appear when projects have budget records." />
        ) : (
          <div className="dashboard-budget-grid">
            {overview.budget.map((budget) => (
              <article className="dashboard-budget-card" key={budget.currency}>
                <div className="dashboard-budget-card__heading">
                  <span className="dashboard-budget-card__currency">{budget.currency}</span>
                  <span>{budget.utilization_percentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}% utilized</span>
                </div>
                <strong>{formatCurrency(budget.approved_budget, budget.currency)}</strong>
                <div
                  className="dashboard-budget-card__track"
                  role="progressbar"
                  aria-label={`${budget.currency} budget utilization`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(Math.max(budget.utilization_percentage, 0), 100)}
                >
                  <span style={{ width: `${Math.min(Math.max(budget.utilization_percentage, 0), 100)}%` }} />
                </div>
                <div className="dashboard-budget-card__details">
                  <span>Actual <strong>{formatCurrency(budget.actual_cost, budget.currency)}</strong></span>
                  <span>Forecast <strong>{formatCurrency(budget.forecast_cost, budget.currency)}</strong></span>
                </div>
              </article>
            ))}
          </div>
        )}
      </DashboardSection>

      <div className="dashboard-grid dashboard-grid--bottom">
        <DashboardSection title="Upcoming milestones" description="Due in the next 30 days">
          <TimelineList items={milestones.items} emptyTitle="No upcoming milestones" emptyDescription="There are no milestones due in the next 30 days." />
          {milestones.total > milestones.items.length && <Link className="dashboard-panel__link" to="/milestones">View all milestones <ArrowUpRight size={14} /></Link>}
        </DashboardSection>
        <DashboardSection className="dashboard-panel--overdue" title="Overdue tasks" description={`${overdueTasks.total.toLocaleString()} overdue in this view`}>
          <TimelineList items={overdueTasks.items} emptyTitle="No overdue tasks" emptyDescription="There are no overdue tasks in this view." />
          {overdueTasks.total > overdueTasks.items.length && <Link className="dashboard-panel__link" to="/my-tasks">View all tasks <ArrowUpRight size={14} /></Link>}
        </DashboardSection>
      </div>
    </main>
  )
}
