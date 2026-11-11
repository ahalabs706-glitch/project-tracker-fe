import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  RefreshCw,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'
import { getErrorMessage } from '../../api/errors'
import {
  Button,
  DataTable,
  Dialog,
  Feedback,
  StatusBadge,
  TextField,
  type DataTableColumn,
} from '../../components/ui'
import { useAuth } from '../auth/AuthContext'
import { getProject, getProjectPermissions, listProjectMembers } from '../projects/projects.api'
import {
  createMilestone,
  getMilestone,
  listDelayedMilestones,
  listCompletedMilestones,
  listProjectMilestones,
  listTaskUsers,
  listUpcomingMilestones,
  updateMilestone,
  updateMilestoneStatus,
  type Milestone,
  type MilestoneInput,
  type MilestoneStatus,
} from './tasks.api'
import './tasks.css'

const perPage = 10
const milestoneStatuses: MilestoneStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED']
const statusNames: Record<MilestoneStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  DELAYED: 'Delayed',
}

function milestoneTone(status: MilestoneStatus): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'COMPLETED') return 'success'
  if (status === 'IN_PROGRESS') return 'info'
  if (status === 'DELAYED') return 'danger'
  return 'warning'
}

function formatMilestoneDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

function MilestoneForm({
  projectID,
  milestone,
  onSubmit,
  onCancel,
  submitting,
}: {
  projectID: string
  milestone?: Milestone
  onSubmit: (input: MilestoneInput) => Promise<unknown>
  onCancel: () => void
  submitting: boolean
}) {
  const { user } = useAuth()
  const permissions = user?.permissions ?? []
  const canAssign = permissions.includes('users.read') && permissions.includes('projects.read')
  const usersQuery = useQuery({
    queryKey: ['milestone-owner-options', projectID],
    queryFn: () => listTaskUsers(),
    enabled: canAssign,
    staleTime: 60_000,
  })
  const membersQuery = useQuery({
    queryKey: ['project-members', projectID],
    queryFn: () => listProjectMembers(projectID),
    enabled: canAssign,
    staleTime: 60_000,
  })
  const projectQuery = useQuery({
    queryKey: ['project', projectID],
    queryFn: () => getProject(projectID),
    enabled: canAssign,
    staleTime: 60_000,
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const schema = z.object({
    name: z.string().trim().min(1, 'Enter a milestone name.').max(255, 'Use 255 characters or fewer.'),
    description: z.string().max(5000, 'Use 5,000 characters or fewer.'),
    owner_id: z.string(),
    planned_date: z.string().min(1, 'Select a planned date.'),
    status: z.enum(milestoneStatuses),
  })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: milestone?.name ?? '',
      description: milestone?.description ?? '',
      owner_id: milestone?.owner_id ?? '',
      planned_date: milestone?.planned_date ?? '',
      status: milestone?.status ?? 'PENDING',
    },
  })
  const ownerCandidates = (() => {
    const active = (usersQuery.data ?? []).filter((item) => item.is_active)
    if (!membersQuery.data || !projectQuery.data) return []
    const eligible = new Set([
      projectQuery.data.owner_id,
      projectQuery.data.manager_id,
      ...membersQuery.data.map((member) => member.user_id),
    ])
    if (milestone?.owner_id) eligible.add(milestone.owner_id)
    return active.filter((item) => eligible.has(item.id))
  })()

  const submit = async (values: Values) => {
    setServerError(null)
    try {
      await onSubmit({ ...values, description: values.description.trim() })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  return (
    <form className="work-form" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <Feedback tone="error" title="Milestone could not be saved">{serverError}</Feedback>}
      <TextField autoFocus error={errors.name?.message} label="Milestone name" {...register('name')} />
      <label className="work-form__field">
        <span>Description</span>
        <textarea maxLength={5000} rows={3} {...register('description')} />
      </label>
      <TextField error={errors.planned_date?.message} label="Planned date" type="date" {...register('planned_date')} />
      <label className="work-form__field">
        <span>Status</span>
        <select {...register('status')}>
          {milestoneStatuses.map((status) => <option key={status} value={status}>{statusNames[status]}</option>)}
        </select>
      </label>
      {canAssign ? (
        <label className="work-form__field">
              <span>Owner (optional)</span>
              <select {...register('owner_id')}>
            <option value="">Unassigned</option>
            {ownerCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>
            ))}
              </select>
              {(membersQuery.isPending || projectQuery.isPending || usersQuery.isPending) &&
                <small className="work-form__hint">Loading eligible owners…</small>}
              {usersQuery.isError && <small className="work-form__error">{getErrorMessage(usersQuery.error)}</small>}
              {membersQuery.isError && <small className="work-form__error">Project member list: {getErrorMessage(membersQuery.error)}</small>}
        </label>
      ) : (
        <p className="work-form__hint">User-list and project access are required to change milestone ownership.</p>
      )}
      <div className="work-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={submitting} type="submit">{submitting ? 'Saving…' : milestone ? 'Save changes' : 'Create milestone'}</Button>
      </div>
    </form>
  )
}

function MilestoneList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: Milestone[]
  emptyTitle: string
  emptyDescription: string
}) {
  const columns = useMemo<DataTableColumn<Milestone>[]>(() => [
    {
      key: 'project',
      header: 'Project',
      render: (milestone) => (
        <div className="work-list__title">
          <Link to={`/projects/${milestone.project_id}`}>{milestone.project_name}</Link>
          <span>{milestone.project_code}</span>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Milestone',
      render: (milestone) => (
        <div className="work-list__title">
          <Link to={`/milestones/${milestone.id}`}>{milestone.name}</Link>
          {milestone.description && <span>{milestone.description}</span>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Planned date',
      render: (milestone) => <span className={milestone.status === 'DELAYED' ? 'work-list__overdue' : ''}>{formatMilestoneDate(milestone.planned_date)}</span>,
    },
    {
      key: 'actual',
      header: 'Actual date',
      render: (milestone) => milestone.actual_date ? formatMilestoneDate(milestone.actual_date) : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (milestone) => <StatusBadge tone={milestoneTone(milestone.status)}>{statusNames[milestone.status] ?? milestone.status}</StatusBadge>,
    },
  ], [])
  return (
    <DataTable
      columns={columns}
      emptyDescription={emptyDescription}
      emptyTitle={emptyTitle}
      getRowKey={(milestone) => milestone.id}
      rows={items}
    />
  )
}

export function MilestonesPage() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [view, setView] = useState<'upcoming' | 'delayed' | 'completed'>('upcoming')
  const [withinDays, setWithinDays] = useState(30)
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const canReadProject = user?.permissions.includes('projects.read') ?? false
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId) && canReadProject,
  })
  const projectPermissionsQuery = useQuery({
    queryKey: ['project-permissions', projectId],
    queryFn: () => getProjectPermissions(projectId!),
    enabled: Boolean(projectId),
  })
  const query = useQuery({
    queryKey: ['milestones', projectId, view, withinDays, page],
    queryFn: () => projectId
      ? listProjectMilestones(projectId, page, perPage)
      : view === 'upcoming'
        ? listUpcomingMilestones(withinDays, page, perPage)
        : view === 'delayed'
          ? listDelayedMilestones(page, perPage)
          : listCompletedMilestones(page, perPage),
  })
  const createMutation = useMutation({
    mutationFn: (input: MilestoneInput) => createMilestone(projectId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['milestones'] })
      setCreateOpen(false)
    },
  })
  const canCreate = projectPermissionsQuery.data?.includes('milestones.create') ?? false
  const loadError = projectQuery.error ?? query.error
  const isError = projectQuery.isError || query.isError

  if (isError) {
    return <div className="work-page"><Feedback tone="error" title="Milestones couldn’t be loaded">{getErrorMessage(loadError)}</Feedback><Button onClick={() => { void query.refetch(); if (projectId && canReadProject) void projectQuery.refetch() }} variant="secondary"><RefreshCw size={15} /> Try again</Button></div>
  }

  return (
    <div className="work-page">
      {projectId && (
        <Link className="work-back" to={canReadProject ? `/projects/${projectId}` : '/milestones'}>
          <ArrowLeft size={15} /> {canReadProject ? projectQuery.data?.name ?? 'Back to project' : 'All milestones'}
        </Link>
      )}
      {projectPermissionsQuery.isError && <Feedback tone="error" title="Project permissions couldn’t be loaded">{getErrorMessage(projectPermissionsQuery.error)}</Feedback>}
      <header className="work-heading">
        <div><p className="work-eyebrow">{projectQuery.data?.project_code ?? 'PROJECT MANAGEMENT'}</p><h2>{projectId ? 'Project milestones' : 'Milestones'}</h2><p>{projectId ? 'Planned checkpoints and delivery dates for this project.' : 'Upcoming, delayed and completed milestones across your authorized projects.'}</p></div>
        {canCreate && <Button onClick={() => { createMutation.reset(); setCreateOpen(true) }}><CirclePlus size={16} /> New milestone</Button>}
      </header>

      {!projectId && (
        <div className="milestone-controls">
          <div className="milestone-tabs" role="tablist" aria-label="Milestone schedule">
            <button aria-selected={view === 'upcoming'} className={view === 'upcoming' ? 'milestone-tabs__active' : ''} onClick={() => { setView('upcoming'); setPage(1) }} role="tab" type="button">Upcoming</button>
            <button aria-selected={view === 'delayed'} className={view === 'delayed' ? 'milestone-tabs__active' : ''} onClick={() => { setView('delayed'); setPage(1) }} role="tab" type="button">Delayed</button>
            <button aria-selected={view === 'completed'} className={view === 'completed' ? 'milestone-tabs__active' : ''} onClick={() => { setView('completed'); setPage(1) }} role="tab" type="button">Completed</button>
          </div>
          {view === 'upcoming' && (
            <label className="milestone-window"><span>Window</span>
              <select onChange={(event) => { setWithinDays(Number(event.target.value)); setPage(1) }} value={withinDays}>
                <option value={7}>Next 7 days</option><option value={30}>Next 30 days</option>
                <option value={60}>Next 60 days</option><option value={90}>Next 90 days</option>
              </select>
            </label>
          )}
        </div>
      )}

      {createMutation.isError && <Feedback tone="error" title="Milestone could not be created">{getErrorMessage(createMutation.error)}</Feedback>}
      {(canReadProject && projectId && projectQuery.isPending) || query.isPending ? (
        <div className="work-loading" aria-label="Loading milestones" aria-live="polite">{Array.from({ length: 5 }, (_, i) => <span key={i} />)}</div>
      ) : (
        <>
          <div className="work-list-meta">{(query.data?.total ?? 0).toLocaleString()} {query.data?.total === 1 ? 'milestone' : 'milestones'}</div>
          <MilestoneList
            items={query.data?.items ?? []}
            emptyTitle={projectId ? 'No project milestones' : view === 'upcoming' ? 'No upcoming milestones' : view === 'delayed' ? 'No delayed milestones' : 'No completed milestones'}
            emptyDescription={projectId ? 'Create a milestone to track an important project date.' : 'There are no milestones in this schedule view.'}
          />
          {(query.data?.items.length ?? 0) > 0 && (
            <nav aria-label="Milestone pages" className="work-pagination">
              <span>Page {page} of {Math.max(query.data?.total_pages ?? 1, 1)}</span>
              <div>
                <Button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} size="small" variant="secondary"><ChevronLeft size={15} /> Previous</Button>
                <Button disabled={!query.data?.total_pages || page >= query.data.total_pages} onClick={() => setPage((value) => value + 1)} size="small" variant="secondary">Next <ChevronRight size={15} /></Button>
              </div>
            </nav>
          )}
        </>
      )}
      {projectId && (
        <Dialog description="Milestone dates are interpreted using the backend business calendar." onClose={() => setCreateOpen(false)} open={createOpen} title="Create milestone">
          <MilestoneForm projectID={projectId} onCancel={() => setCreateOpen(false)} onSubmit={(input) => createMutation.mutateAsync(input)} submitting={createMutation.isPending} />
        </Dialog>
      )}
    </div>
  )
}

export function MilestoneDetailPage() {
  const { milestoneId = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [status, setStatus] = useState<MilestoneStatus | null>(null)
  const [actualDate, setActualDate] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const milestoneQuery = useQuery({
    queryKey: ['milestone', milestoneId],
    queryFn: () => getMilestone(milestoneId),
    enabled: Boolean(milestoneId),
  })
  const milestone = milestoneQuery.data
  const canReadProject = user?.permissions.includes('projects.read') ?? false
  const projectQuery = useQuery({
    queryKey: ['project', milestone?.project_id],
    queryFn: () => getProject(milestone!.project_id),
    enabled: Boolean(milestone?.project_id) && canReadProject,
  })
  const projectPermissionsQuery = useQuery({
    queryKey: ['project-permissions', milestone?.project_id],
    queryFn: () => getProjectPermissions(milestone!.project_id),
    enabled: Boolean(milestone?.project_id),
  })
  const canManage = projectPermissionsQuery.data?.includes('milestones.update') ?? false
  const canUpdateStatus = canManage
  const updateQuery = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['milestone', milestoneId] }),
    queryClient.invalidateQueries({ queryKey: ['milestones'] }),
    queryClient.invalidateQueries({ queryKey: ['project-milestones'] }),
  ])
  const updateMutation = useMutation({
    mutationFn: (input: MilestoneInput) => updateMilestone(milestoneId, input),
    onSuccess: async () => { await updateQuery(); setEditOpen(false); setActionError(null) },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const statusMutation = useMutation({
    mutationFn: (nextStatus: MilestoneStatus) => updateMilestoneStatus(milestoneId, nextStatus, actualDate),
    onSuccess: async () => { await updateQuery(); setActionError(null) },
    onError: (error) => setActionError(getErrorMessage(error)),
  })

  if (milestoneQuery.isPending) return <div className="work-loading work-loading--detail" aria-label="Loading milestone" aria-live="polite"><span /><span /></div>
  if (milestoneQuery.isError || !milestone) {
    return <div className="work-page"><Feedback tone="error" title="Milestone couldn’t be loaded">{milestoneQuery.isError ? getErrorMessage(milestoneQuery.error) : 'Milestone not found.'}</Feedback><Link className="button button--secondary" to="/milestones"><ArrowLeft size={15} /> Back to milestones</Link></div>
  }
  const currentStatus = status ?? milestone.status

  return (
    <div className="work-page work-detail">
      <Link className="work-back" to={`/projects/${milestone.project_id}/milestones`}><ArrowLeft size={15} /> Project milestones</Link>
      {actionError && <Feedback tone="error" title="Milestone update failed">{actionError}</Feedback>}
      {updateMutation.isError && <Feedback tone="error" title="Milestone could not be saved">{getErrorMessage(updateMutation.error)}</Feedback>}
      {canReadProject && projectQuery.isError && <Feedback tone="error" title="Project details unavailable">{getErrorMessage(projectQuery.error)}</Feedback>}
      {projectPermissionsQuery.isError && <Feedback tone="error" title="Project permissions unavailable">{getErrorMessage(projectPermissionsQuery.error)}</Feedback>}
      <header className="work-detail__heading">
        <div><p className="work-eyebrow">MILESTONE</p><div className="work-detail__title"><h2>{milestone.name}</h2><StatusBadge tone={milestoneTone(milestone.status)}>{statusNames[milestone.status]}</StatusBadge></div><p>{milestone.description || 'No description has been added.'}</p></div>
        {canManage && <Button onClick={() => { updateMutation.reset(); setEditOpen(true) }} variant="secondary">Edit milestone</Button>}
      </header>
      <section className="work-facts">
        <div><span>Project</span><strong>{projectQuery.data?.name ?? milestone.project_id}</strong></div>
        <div><span>Planned date</span><strong>{formatMilestoneDate(milestone.planned_date)}</strong></div>
        <div><span>Actual date</span><strong>{milestone.actual_date ? formatMilestoneDate(milestone.actual_date) : 'Not completed'}</strong></div>
        <div><span>Owner</span><strong>{milestone.owner_id ?? 'Unassigned'}</strong></div>
      </section>
      {canUpdateStatus && (
        <section className="work-panel">
          <header className="work-panel__heading"><div><h3>Status</h3><p>Delayed classification follows the backend business date.</p></div><CalendarDays size={18} /></header>
          <form className="milestone-status-form" onSubmit={(event) => {
            event.preventDefault()
            setActionError(null)
            statusMutation.mutate(currentStatus)
          }}>
            <label className="work-form__field"><span>Milestone status</span><select onChange={(event) => setStatus(event.target.value as MilestoneStatus)} value={currentStatus}>{milestoneStatuses.map((item) => <option key={item} value={item}>{statusNames[item]}</option>)}</select></label>
            <TextField label="Actual date (optional)" type="date" value={actualDate} onChange={(event) => setActualDate(event.target.value)} />
            <Button disabled={statusMutation.isPending} type="submit">Save status</Button>
          </form>
        </section>
      )}
      <Dialog description="Milestone schedule changes are tracked by the server." onClose={() => setEditOpen(false)} open={editOpen} title="Edit milestone">
        <MilestoneForm
          milestone={milestone}
          projectID={milestone.project_id}
          onCancel={() => setEditOpen(false)}
          onSubmit={(input) => updateMutation.mutateAsync(input)}
          submitting={updateMutation.isPending}
        />
      </Dialog>
    </div>
  )
}
