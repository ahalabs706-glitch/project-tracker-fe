import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock3,
  ListTodo,
  RefreshCw,
  UserRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
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
import { getProject, getProjectPermissions } from '../projects/projects.api'
import {
  createTask,
  getTask,
  listProjectTaskAssignees,
  listMyTasks,
  listProjectTasks,
  setTaskAssignees,
  updateTask,
  updateTaskProgress,
  updateTaskStatus,
  type Task,
  type TaskInput,
  type TaskListFilters,
  type TaskPriority,
  type TaskStatus,
} from './tasks.api'
import './tasks.css'

const taskStatuses: TaskStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'DONE',
  'CANCELLED',
]
const priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const perPage = 10

const statusNames: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

function taskTone(status: TaskStatus): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'DONE') return 'success'
  if (status === 'IN_PROGRESS' || status === 'IN_REVIEW') return 'info'
  if (status === 'BLOCKED') return 'danger'
  if (status === 'TODO') return 'warning'
  return 'neutral'
}

function formatTaskDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <StatusBadge tone={taskTone(status)}>{statusNames[status] ?? status}</StatusBadge>
}

function TaskForm({
  initialTask,
  projectID,
  onSubmit,
  onCancel,
  submitting,
}: {
  initialTask?: Task
  projectID: string
  onSubmit: (input: TaskInput) => Promise<unknown>
  onCancel: () => void
  submitting: boolean
}) {
  const { user } = useAuth()
  const permissions = user?.permissions ?? []
  const canReadProjects = permissions.includes('projects.read')
  const projectPermissionsQuery = useQuery({
    queryKey: ['project-permissions', projectID],
    queryFn: () => getProjectPermissions(projectID),
    enabled: Boolean(projectID),
    staleTime: 30_000,
  })
  const canAssign = projectPermissionsQuery.data?.includes('tasks.assign') ?? false
  const taskSchema = z.object({
    title: z.string().trim().min(1, 'Enter a task title.').max(255, 'Use 255 characters or fewer.'),
    description: z.string().max(5000, 'Use 5,000 characters or fewer.'),
    assignee_ids: z.array(z.string()).max(50, 'Select no more than 50 assignees.'),
    priority: z.enum(priorities),
    status: z.enum(taskStatuses),
    planned_start_date: z.string(),
    planned_due_date: z.string().min(1, 'Select a due date.'),
    progress: z.coerce.number().min(0).max(100),
  }).refine(
    (value) => !value.planned_start_date || value.planned_due_date >= value.planned_start_date,
    { message: 'Due date must be on or after the start date.', path: ['planned_due_date'] },
  )
  type Values = z.output<typeof taskSchema>
  const usersQuery = useQuery({
    queryKey: ['task-user-options', projectID],
    queryFn: () => listProjectTaskAssignees(projectID),
    enabled: canAssign,
    staleTime: 60_000,
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof taskSchema>, unknown, Values>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: initialTask?.title ?? '',
      description: initialTask?.description ?? '',
      assignee_ids: initialTask?.assignees.map((assignee) => assignee.user_id) ?? [],
      priority: initialTask?.priority ?? 'MEDIUM',
      status: initialTask?.status ?? 'TODO',
      planned_start_date: initialTask?.planned_start_date ?? '',
      planned_due_date: initialTask?.planned_due_date ?? '',
      progress: initialTask?.progress ?? 0,
    },
  })
  const candidates = (() => {
    if (!canAssign) return []
    const available = usersQuery.data ?? []
    const availableIDs = new Set(available.map((item) => item.id))
    const existing = (initialTask?.assignees ?? [])
      .filter((assignee) => !availableIDs.has(assignee.user_id))
      .map((assignee) => ({
        id: assignee.user_id,
        full_name: `${assignee.full_name} (current assignee)`,
        department: null,
      }))
    return [...available, ...existing]
  })()

  const submit = async (values: Values) => {
    setServerError(null)
    try {
      await onSubmit({
        ...values,
        parent_task_id: initialTask?.parent_task_id ?? '',
        description: values.description.trim(),
        assignee_ids: canAssign
          ? values.assignee_ids
          : initialTask?.assignees.map((assignee) => assignee.user_id) ?? [],
      })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  return (
    <form className="work-form" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <Feedback tone="error" title="Task could not be saved">{serverError}</Feedback>}
      <TextField autoFocus error={errors.title?.message} label="Task title" {...register('title')} />
      <label className="work-form__field">
        <span>Description</span>
        <textarea maxLength={5000} rows={3} {...register('description')} />
      </label>
      <div className="work-form__row">
        <label className="work-form__field">
          <span>Priority</span>
          <select {...register('priority')}>
            {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
        <label className="work-form__field">
          <span>Status</span>
          <select {...register('status')}>
            {taskStatuses.map((status) => <option key={status} value={status}>{statusNames[status]}</option>)}
          </select>
        </label>
      </div>
      <div className="work-form__row">
        <TextField error={errors.planned_start_date?.message} label="Planned start" type="date" {...register('planned_start_date')} />
        <TextField error={errors.planned_due_date?.message} label="Planned due date" type="date" {...register('planned_due_date')} />
      </div>
      {canAssign && (
        <fieldset className="task-assignees">
          <legend>Assignees</legend>
          <p className="work-form__hint">Select one or more active project members. They share this task’s status and progress.</p>
          {usersQuery.isPending && <small className="work-form__hint">Loading eligible project assignees…</small>}
          {candidates.map((candidate) => (
            <label className="task-assignees__option" key={candidate.id}>
              <input type="checkbox" value={candidate.id} {...register('assignee_ids')} />
              <span>{candidate.full_name}{candidate.department ? ` · ${candidate.department}` : ''}</span>
            </label>
          ))}
          {candidates.length === 0 && !usersQuery.isPending && !usersQuery.isError &&
            <small className="work-form__hint">No eligible project members are available.</small>}
          {errors.assignee_ids?.message && <small className="work-form__error">{errors.assignee_ids.message}</small>}
          {usersQuery.isError && <small className="work-form__error">{getErrorMessage(usersQuery.error)}</small>}
        </fieldset>
      )}
      {projectPermissionsQuery.isError && (
        <small className="work-form__error">{getErrorMessage(projectPermissionsQuery.error)}</small>
      )}
      {permissions.includes('tasks.assign') && !canReadProjects && (
        <p className="work-form__hint">Project access is required to change task assignments.</p>
      )}
      <TextField
        error={errors.progress?.message}
        label="Progress (%)"
        max="100"
        min="0"
        step="0.1"
        type="number"
        {...register('progress')}
      />
      <div className="work-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={submitting} type="submit">{submitting ? 'Saving…' : initialTask ? 'Save changes' : 'Create task'}</Button>
      </div>
    </form>
  )
}

function TaskList({
  tasks,
  total,
  emptyTitle,
  emptyDescription,
  canAssign,
  onAssign,
}: {
  tasks: Task[]
  total: number
  emptyTitle: string
  emptyDescription: string
  canAssign?: boolean
  onAssign?: (task: Task) => void
}) {
  const columns = useMemo<DataTableColumn<Task>[]>(() => [
    {
      key: 'title',
      header: 'Task',
      render: (task) => (
        <div className="work-list__title">
          <Link to={`/tasks/${task.id}`}>{task.title}</Link>
          {task.description && <span>{task.description}</span>}
        </div>
      ),
    },
    {
      key: 'assignees',
      header: 'Assignees',
      render: (task) => task.assignees.length > 0
        ? <span className="task-assignees__names">{task.assignees.map((assignee) => assignee.full_name).join(', ')}</span>
        : <span className="task-assignees__unassigned">Unassigned</span>,
    },
    ...(canAssign ? [{
      key: 'assignment',
      header: 'Assignment',
      render: (task: Task) => (
        <Button onClick={() => onAssign?.(task)} size="small" variant="secondary">
          {task.assignees.length > 0 ? 'Manage' : 'Assign'}
        </Button>
      ),
    } satisfies DataTableColumn<Task>] : []),
    {
      key: 'schedule',
      header: 'Due date',
      render: (task) => (
        <span className={task.is_overdue ? 'work-list__overdue' : ''}>
          {task.is_overdue && <Clock3 size={13} aria-label="Overdue" />}
          {formatTaskDate(task.planned_due_date)}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (task) => <span className={`work-priority work-priority--${task.priority.toLowerCase()}`}>{task.priority}</span>,
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (task) => (
        <div className="work-list__progress">
          <span>{task.progress.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</span>
          <span className="work-list__progress-track"><span style={{ width: `${Math.min(Math.max(task.progress, 0), 100)}%` }} /></span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (task) => (
        <div className="work-list__status">
          <TaskStatusBadge status={task.status} />
          {task.is_overdue && <StatusBadge tone="danger">Overdue</StatusBadge>}
        </div>
      ),
    },
  ], [canAssign, onAssign])
  return (
    <>
      <div className="work-list-meta">{total.toLocaleString()} {total === 1 ? 'task' : 'tasks'}</div>
      <DataTable
        columns={columns}
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        getRowKey={(task) => task.id}
        rows={tasks}
      />
    </>
  )
}

function TaskAssignmentDialog({
  task,
  onClose,
  onSaved,
}: {
  task: Task
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [selectedIDs, setSelectedIDs] = useState(() => task.assignees.map((assignee) => assignee.user_id))
  const usersQuery = useQuery({
    queryKey: ['task-user-options', task.project_id],
    queryFn: () => listProjectTaskAssignees(task.project_id),
    staleTime: 60_000,
  })
  const mutation = useMutation({
    mutationFn: () => setTaskAssignees(task.id, selectedIDs),
    onSuccess: async () => {
      await onSaved()
      onClose()
    },
  })
  const available = usersQuery.data ?? []
  const availableIDs = new Set(available.map((item) => item.id))
  const candidates = [
    ...available,
    ...task.assignees
      .filter((assignee) => !availableIDs.has(assignee.user_id))
      .map((assignee) => ({ id: assignee.user_id, full_name: `${assignee.full_name} (current assignee)`, department: null })),
  ]

  return (
    <Dialog description="Select one or more active project members. Assignees share this task’s status and progress." onClose={onClose} open title="Manage task assignees">
      {mutation.isError && <Feedback tone="error" title="Assignments could not be saved">{getErrorMessage(mutation.error)}</Feedback>}
      {usersQuery.isError && <Feedback tone="error" title="Eligible assignees could not be loaded">{getErrorMessage(usersQuery.error)}</Feedback>}
      {usersQuery.isPending ? (
        <div className="work-loading" aria-label="Loading eligible assignees" aria-live="polite"><span /><span /></div>
      ) : (
        <fieldset className="task-assignees">
          <legend>Assignees</legend>
          {candidates.map((candidate) => (
            <label className="task-assignees__option" key={candidate.id}>
              <input
                checked={selectedIDs.includes(candidate.id)}
                onChange={(event) => setSelectedIDs((current) => event.target.checked
                  ? [...current, candidate.id]
                  : current.filter((id) => id !== candidate.id))}
                type="checkbox"
              />
              <span>{candidate.full_name}{candidate.department ? ` · ${candidate.department}` : ''}</span>
            </label>
          ))}
          {candidates.length === 0 && <small className="work-form__hint">No eligible project members are available.</small>}
        </fieldset>
      )}
      <div className="work-form__actions">
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
        <Button disabled={mutation.isPending || usersQuery.isPending || usersQuery.isError} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save assignments'}
        </Button>
      </div>
    </Dialog>
  )
}

function TaskFilters({
  filters,
  onChange,
}: {
  filters: TaskListFilters
  onChange: (key: 'status' | 'priority' | 'overdue', value: string) => void
}) {
  return (
    <section aria-label="Task filters" className="work-filters">
      <label><span>Status</span>
        <select onChange={(event) => onChange('status', event.target.value)} value={filters.status}>
          <option value="">All statuses</option>
          {taskStatuses.map((status) => <option key={status} value={status}>{statusNames[status]}</option>)}
        </select>
      </label>
      <label><span>Priority</span>
        <select onChange={(event) => onChange('priority', event.target.value)} value={filters.priority}>
          <option value="">All priorities</option>
          {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
      </label>
      <label><span>Due date</span>
        <select onChange={(event) => onChange('overdue', event.target.value)} value={filters.overdue}>
          <option value="">Any due date</option>
          <option value="true">Overdue only</option>
          <option value="false">Not overdue</option>
        </select>
      </label>
    </section>
  )
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  return (
    <nav aria-label="Page navigation" className="work-pagination">
      <span>Page {page} of {Math.max(totalPages, 1)}</span>
      <div>
        <Button disabled={page <= 1} onClick={() => onPage(page - 1)} size="small" variant="secondary"><ChevronLeft size={15} /> Previous</Button>
        <Button disabled={!totalPages || page >= totalPages} onClick={() => onPage(page + 1)} size="small" variant="secondary">Next <ChevronRight size={15} /></Button>
      </div>
    </nav>
  )
}

export function MyTasksPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<TaskListFilters>({
    status: '',
    priority: '',
    overdue: '',
    page: 1,
    per_page: perPage,
  })
  const query = useQuery({
    queryKey: ['my-tasks', user?.id, filters],
    queryFn: () => listMyTasks(filters),
    staleTime: 30_000,
  })
  const tasks = query.data?.items ?? []

  if (query.isError) {
    return <div className="work-page"><Feedback tone="error" title="Tasks couldn’t be loaded">{getErrorMessage(query.error)}</Feedback><Button onClick={() => void query.refetch()} variant="secondary"><RefreshCw size={15} /> Try again</Button></div>
  }

  return (
    <div className="work-page">
      <header className="work-heading">
        <div><p className="work-eyebrow">PROJECT MANAGEMENT</p><h2>My tasks</h2><p>Tasks assigned to your account, with due dates from the business calendar.</p></div>
        <Button onClick={() => void query.refetch()} variant="secondary"><RefreshCw size={15} /> Refresh</Button>
      </header>
      <TaskFilters
        filters={filters}
        onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }))}
      />
      {query.isPending ? (
        <div className="work-loading" aria-label="Loading tasks" aria-live="polite">{Array.from({ length: 5 }, (_, i) => <span key={i} />)}</div>
      ) : (
        <>
          <TaskList
            tasks={tasks}
            total={query.data?.total ?? 0}
            emptyTitle="No assigned tasks"
            emptyDescription="Tasks assigned to you will appear here."
          />
          {tasks.length > 0 && <Pagination page={filters.page} totalPages={query.data?.total_pages ?? 0} onPage={(page) => setFilters((current) => ({ ...current, page }))} />}
        </>
      )}
    </div>
  )
}

export function ProjectTasksPage() {
  const { projectId = '' } = useParams()
  const { user } = useAuth()
  const [filters, setFilters] = useState<TaskListFilters>({
    status: '',
    priority: '',
    overdue: '',
    page: 1,
    per_page: perPage,
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [assignmentTask, setAssignmentTask] = useState<Task | null>(null)
  const queryClient = useQueryClient()
  const canReadProject = user?.permissions.includes('projects.read') ?? false
  const projectQuery = useQuery({ queryKey: ['project', projectId], queryFn: () => getProject(projectId), enabled: Boolean(projectId) && canReadProject })
  const projectPermissionsQuery = useQuery({
    queryKey: ['project-permissions', projectId],
    queryFn: () => getProjectPermissions(projectId),
    enabled: Boolean(projectId),
  })
  const tasksQuery = useQuery({
    queryKey: ['project-tasks', projectId, filters],
    queryFn: () => listProjectTasks(projectId, filters),
    enabled: Boolean(projectId),
  })
  const createMutation = useMutation({
    mutationFn: (input: TaskInput) => createTask(projectId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
      setCreateOpen(false)
    },
  })
  const project = projectQuery.data
  const projectPermissions = projectPermissionsQuery.data ?? []
  const canCreate = projectPermissions.includes('tasks.create')

  if ((canReadProject && projectQuery.isError) || tasksQuery.isError) {
    const error = projectQuery.error ?? tasksQuery.error
    return <div className="work-page"><Feedback tone="error" title="Project tasks couldn’t be loaded">{getErrorMessage(error)}</Feedback><Link className="button button--secondary" to={canReadProject ? `/projects/${projectId}` : '/my-tasks'}><ArrowLeft size={15} /> {canReadProject ? 'Back to project' : 'Back to my tasks'}</Link></div>
  }

  return (
    <div className="work-page">
      <Link className="work-back" to={canReadProject ? `/projects/${projectId}` : '/my-tasks'}>
        <ArrowLeft size={15} /> {canReadProject ? project?.name ?? 'Back to project' : 'Back to my tasks'}
      </Link>
      <header className="work-heading">
        <div><p className="work-eyebrow">{project?.project_code ?? 'PROJECT'}</p><h2>Project tasks</h2><p>Tasks and their current schedule and progress.</p></div>
        {canCreate && <Button onClick={() => { createMutation.reset(); setCreateOpen(true) }}><CirclePlus size={16} /> New task</Button>}
      </header>
      {projectPermissionsQuery.isError && <Feedback tone="error" title="Project permissions couldn’t be loaded">{getErrorMessage(projectPermissionsQuery.error)}</Feedback>}
      {createMutation.isError && <Feedback tone="error" title="Task could not be created">{getErrorMessage(createMutation.error)}</Feedback>}
      <TaskFilters filters={filters} onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }))} />
      {tasksQuery.isPending ? (
        <div className="work-loading" aria-label="Loading project tasks" aria-live="polite">{Array.from({ length: 5 }, (_, i) => <span key={i} />)}</div>
      ) : (
        <>
          <TaskList
            canAssign={projectPermissions.includes('tasks.assign')}
            onAssign={setAssignmentTask}
            tasks={tasksQuery.data?.items ?? []}
            total={tasksQuery.data?.total ?? 0}
            emptyTitle="No project tasks"
            emptyDescription="Create a task to track a piece of this project’s work."
          />
          {(tasksQuery.data?.items.length ?? 0) > 0 && <Pagination page={filters.page} totalPages={tasksQuery.data?.total_pages ?? 0} onPage={(page) => setFilters((current) => ({ ...current, page }))} />}
        </>
      )}
      <Dialog description="Schedule and task fields are validated by the server before saving." onClose={() => setCreateOpen(false)} open={createOpen} title="Create task">
        <TaskForm projectID={projectId} onCancel={() => setCreateOpen(false)} onSubmit={(input) => createMutation.mutateAsync(input)} submitting={createMutation.isPending} />
      </Dialog>
      {assignmentTask && (
        <TaskAssignmentDialog
          key={assignmentTask.id}
          task={assignmentTask}
          onClose={() => setAssignmentTask(null)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
            await queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
            await queryClient.invalidateQueries({ queryKey: ['task', assignmentTask.id] })
          }}
        />
      )}
    </div>
  )
}

export function TaskDetailPage() {
  const { taskId = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState('')
  const [status, setStatus] = useState<TaskStatus | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const taskQuery = useQuery({ queryKey: ['task', taskId], queryFn: () => getTask(taskId), enabled: Boolean(taskId) })
  const task = taskQuery.data
  const canReadProject = user?.permissions.includes('projects.read') ?? false
  const projectQuery = useQuery({
    queryKey: ['project', task?.project_id],
    queryFn: () => getProject(task!.project_id),
    enabled: Boolean(task?.project_id) && canReadProject,
  })
  const projectPermissionsQuery = useQuery({
    queryKey: ['project-permissions', task?.project_id],
    queryFn: () => getProjectPermissions(task!.project_id),
    enabled: Boolean(task?.project_id),
  })
  const projectPermissions = projectPermissionsQuery.data ?? []
  const canManageSchedule = projectPermissions.includes('tasks.update')
  const canUpdate = projectPermissions.includes('tasks.update')
  const updateQuery = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task', taskId] }),
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] }),
    ])
  }
  const statusMutation = useMutation({
    mutationFn: (nextStatus: TaskStatus) => updateTaskStatus(taskId, nextStatus),
    onSuccess: async () => { await updateQuery(); setActionError(null) },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const progressMutation = useMutation({
    mutationFn: (value: number) => updateTaskProgress(taskId, value),
    onSuccess: async () => { await updateQuery(); setActionError(null) },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const updateMutation = useMutation({
    mutationFn: (input: TaskInput) => updateTask(taskId, input),
    onSuccess: async () => { await updateQuery(); setEditOpen(false); setActionError(null) },
    onError: (error) => setActionError(getErrorMessage(error)),
  })

  if (taskQuery.isPending) return <div className="work-loading work-loading--detail" aria-label="Loading task" aria-live="polite"><span /><span /></div>
  if (taskQuery.isError || !task) {
    return <div className="work-page"><Feedback tone="error" title="Task couldn’t be loaded">{taskQuery.isError ? getErrorMessage(taskQuery.error) : 'Task not found.'}</Feedback><Link className="button button--secondary" to="/my-tasks"><ArrowLeft size={15} /> Back to my tasks</Link></div>
  }
  if (canReadProject && projectQuery.isError) {
    return <div className="work-page"><Feedback tone="error" title="Project details couldn’t be loaded">{getErrorMessage(projectQuery.error)}</Feedback><Link className="button button--secondary" to={`/projects/${task.project_id}/tasks`}><ArrowLeft size={15} /> Project tasks</Link></div>
  }
  const currentStatus = status ?? task.status

  return (
    <div className="work-page work-detail">
      <Link className="work-back" to={`/projects/${task.project_id}/tasks`}><ArrowLeft size={15} /> Project tasks</Link>
      {actionError && <Feedback tone="error" title="Task update failed">{actionError}</Feedback>}
      {updateMutation.isError && <Feedback tone="error" title="Task details could not be saved">{getErrorMessage(updateMutation.error)}</Feedback>}
      {projectPermissionsQuery.isError && <Feedback tone="error" title="Project permissions couldn’t be loaded">{getErrorMessage(projectPermissionsQuery.error)}</Feedback>}
      <header className="work-detail__heading">
        <div>
          <p className="work-eyebrow">TASK DETAIL</p>
          <div className="work-detail__title"><h2>{task.title}</h2><TaskStatusBadge status={task.status} />{task.is_overdue && <StatusBadge tone="danger">Overdue</StatusBadge>}</div>
          <p>{task.description || 'No description has been added.'}</p>
        </div>
        <div className="work-detail__actions">
          {projectPermissions.includes('tasks.assign') && <Button onClick={() => setAssignmentOpen(true)} variant="secondary">Manage assignees</Button>}
          {canManageSchedule && <Button onClick={() => { updateMutation.reset(); setEditOpen(true) }} variant="secondary">Edit task</Button>}
        </div>
      </header>
      <section className="work-facts">
        <div><span>Priority</span><strong>{task.priority}</strong></div>
        <div><span>Planned start</span><strong>{task.planned_start_date ? formatTaskDate(task.planned_start_date) : 'Not set'}</strong></div>
        <div className={task.is_overdue ? 'work-facts__overdue' : ''}><span>Due date</span><strong>{formatTaskDate(task.planned_due_date)}</strong></div>
        <div><span>Actual start</span><strong>{task.actual_start_date ? formatTaskDate(task.actual_start_date) : 'Not started'}</strong></div>
        <div><span>Completed</span><strong>{task.actual_completion_date ? formatTaskDate(task.actual_completion_date) : 'Not completed'}</strong></div>
        <div><span>Project</span><strong>{projectQuery.data?.name ?? task.project_id}</strong></div>
        <div><span>Assignees</span><strong>{task.assignees.length > 0 ? task.assignees.map((assignee) => assignee.full_name).join(', ') : 'Unassigned'}</strong></div>
      </section>
      <section className="work-panel">
        <header className="work-panel__heading"><div><h3>Progress and status</h3><p>Updates are checked against your task permissions.</p></div><ListTodo size={18} /></header>
        <div className="work-detail__progress"><span className="work-list__progress-track"><span style={{ width: `${Math.min(Math.max(task.progress, 0), 100)}%` }} /></span><strong>{task.progress.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</strong></div>
        {canUpdate && (
          <div className="work-detail__controls">
            <form onSubmit={(event) => {
              event.preventDefault()
              const value = Number(progress)
              if (progress === '' || !Number.isFinite(value) || value < 0 || value > 100) {
                setActionError('Progress must be a number from 0 to 100.')
                return
              }
              setActionError(null)
              progressMutation.mutate(value)
            }}>
              <TextField label="Progress (%)" max="100" min="0" step="0.1" type="number" value={progress} onChange={(event) => setProgress(event.target.value)} placeholder={String(task.progress)} />
              <Button disabled={progressMutation.isPending} size="small" type="submit">Save progress</Button>
            </form>
            <form onSubmit={(event) => {
              event.preventDefault()
              setActionError(null)
              statusMutation.mutate(currentStatus)
            }}>
              <label className="work-form__field"><span>Task status</span><select onChange={(event) => setStatus(event.target.value as TaskStatus)} value={currentStatus}>{taskStatuses.map((item) => <option key={item} value={item}>{statusNames[item]}</option>)}</select></label>
              <Button disabled={statusMutation.isPending} size="small" type="submit">Save status</Button>
            </form>
          </div>
        )}
        {!canUpdate && <EmptyState icon={<UserRound size={18} />} title="View-only task" description="Your account does not have task update permission." />}
      </section>
      <Dialog description="Task schedule changes are tracked by the server." onClose={() => setEditOpen(false)} open={editOpen} title="Edit task">
        <TaskForm
          initialTask={task}
          projectID={task.project_id}
          onCancel={() => setEditOpen(false)}
          onSubmit={(input) => updateMutation.mutateAsync(input)}
          submitting={updateMutation.isPending}
        />
      </Dialog>
      {assignmentOpen && (
        <TaskAssignmentDialog
          key={task.id}
          task={task}
          onClose={() => setAssignmentOpen(false)}
          onSaved={updateQuery}
        />
      )}
    </div>
  )
}
