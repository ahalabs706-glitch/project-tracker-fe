import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  ExternalLink,
  ListTodo,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getErrorMessage } from '../../api/errors'
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Feedback,
  StatusBadge,
  type DataTableColumn,
} from '../../components/ui'
import { useAuth } from '../auth/AuthContext'
import { ProjectForm } from './ProjectForm'
import {
  addProjectMember,
  archiveProject,
  createProject,
  getProject,
  getProjectBudgetSummary,
  listProjectDepartments,
  listProjectMembers,
  listProjectRolePermissions,
  listProjectUsers,
  listProjects,
  removeProjectMember,
  updateProject,
  updateProjectRolePermissions,
  updateProjectProgress,
  updateProjectStatus,
  type Project,
  type ProjectBudgetSummary,
  type ProjectFilters,
  type ProjectMember,
  type ProjectRolePermissionSet,
  type ProjectPriority,
  type ProjectStatus,
  projectScopedPermissions,
} from './projects.api'
import './projects.css'

const projectStatuses: ProjectStatus[] = [
  'DRAFT',
  'PROPOSED',
  'PLANNING',
  'APPROVED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
]
const priorities: ProjectPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const perPage = 10

const statusLabels: Record<ProjectStatus, string> = {
  DRAFT: 'Draft',
  PROPOSED: 'Proposed',
  PLANNING: 'Planning',
  APPROVED: 'Approved',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

function statusTone(status: ProjectStatus): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'COMPLETED') return 'success'
  if (status === 'IN_PROGRESS' || status === 'APPROVED') return 'info'
  if (status === 'ON_HOLD' || status === 'PROPOSED' || status === 'PLANNING') return 'warning'
  if (status === 'CANCELLED') return 'danger'
  return 'neutral'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

function formatMoney(value: string, currency: string) {
  const negative = value.startsWith('-')
  const [whole = '0', decimal = '00'] = value.slice(negative ? 1 : 0).split('.')
  const grouped = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(BigInt(whole || '0'))
  return `${currency} ${negative ? '-' : ''}${grouped},${decimal.padEnd(2, '0').slice(0, 2)}`
}

function userCanManageProject(project: Project, userID: string, roles: string[]) {
  return (
    roles.includes('ADMIN') ||
    roles.includes('SUPER_ADMIN') ||
    project.owner_id === userID ||
    project.manager_id === userID
  )
}

function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <StatusBadge tone={statusTone(status)}>{statusLabels[status] ?? status}</StatusBadge>
}

function ProjectRolePermissionsEditor({
  projectID,
  role,
  onClose,
}: {
  projectID: string
  role: ProjectRolePermissionSet
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [permissionCodes, setPermissionCodes] = useState(role.permissions)
  const mutation = useMutation({
    mutationFn: () => updateProjectRolePermissions(projectID, role.project_role, permissionCodes),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-role-permissions', projectID] }),
        queryClient.invalidateQueries({ queryKey: ['project-permissions', projectID] }),
        queryClient.invalidateQueries({ queryKey: ['project-tasks', projectID] }),
        queryClient.invalidateQueries({ queryKey: ['task-user-options', projectID] }),
      ])
      onClose()
    },
  })

  return (
    <div className="project-form">
      {mutation.isError && <Feedback tone="error" title="Project role permissions could not be saved">{getErrorMessage(mutation.error)}</Feedback>}
      <p className="project-form__hint">
        {role.is_customized ? 'Custom permissions are active for this role.' : 'These are the defaults. Saving applies a custom set for this project.'}
      </p>
      <fieldset className="project-role-permissions">
        <legend>{role.project_role.charAt(0) + role.project_role.slice(1).toLowerCase()} permissions</legend>
        {projectScopedPermissions.map((permission) => (
          <label className="project-role-permissions__option" key={permission.code}>
            <input
              checked={permissionCodes.includes(permission.code)}
              onChange={(event) => setPermissionCodes((current) => event.target.checked
                ? [...current, permission.code]
                : current.filter((code) => code !== permission.code))}
              type="checkbox"
            />
            <span>{permission.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="project-form__actions">
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save role permissions'}
        </Button>
      </div>
    </div>
  )
}

function ProjectRolePermissionsDialog({
  projectID,
  onClose,
}: {
  projectID: string
  onClose: () => void
}) {
  const query = useQuery({
    queryKey: ['project-role-permissions', projectID],
    queryFn: () => listProjectRolePermissions(projectID),
  })
  const [selectedRole, setSelectedRole] = useState<ProjectMember['project_role']>('MEMBER')
  const role = query.data?.find((item) => item.project_role === selectedRole)

  return (
    <Dialog description="Project owners and managers can configure task and milestone permissions for each project role." onClose={onClose} open title="Configure project roles">
      {query.isError && <Feedback tone="error" title="Project role permissions couldn’t be loaded">{getErrorMessage(query.error)}</Feedback>}
      {query.isPending ? (
        <div aria-label="Loading project role permissions" className="project-detail__loading" />
      ) : (
        <>
          <label className="project-detail__inline-field">
            <span>Project role</span>
            <select onChange={(event) => setSelectedRole(event.target.value as ProjectMember['project_role'])} value={selectedRole}>
              <option value="MEMBER">Member</option>
              <option value="LEAD">Lead</option>
              <option value="CONTRIBUTOR">Contributor</option>
            </select>
          </label>
          {role && <ProjectRolePermissionsEditor key={role.project_role} onClose={onClose} projectID={projectID} role={role} />}
          <p className="project-form__hint">Global system permissions, user administration, and finance-wide access remain controlled by SUPER_ADMIN.</p>
        </>
      )}
    </Dialog>
  )
}

function useProjectOptions(departmentID?: string, enabled = true) {
  const { user } = useAuth()
  const permissions = user?.permissions ?? []
  const canReadUsers = permissions.includes('users.read')
  const canReadDepartments = permissions.includes('departments.read')
  const isAdministrator = user?.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN') ?? false
  const usersQuery = useQuery({
    queryKey: ['project-user-options', departmentID],
    queryFn: () => listProjectUsers(departmentID),
    enabled: enabled && canReadUsers,
    staleTime: 60_000,
  })
  const departmentsQuery = useQuery({
    queryKey: ['project-department-options'],
    queryFn: listProjectDepartments,
    enabled: enabled && canReadDepartments,
    staleTime: 60_000,
  })

  const users = [...(usersQuery.data ?? [])]
  if (user && !users.some((item) => item.id === user.id)) {
    users.push({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      department: user.department,
      is_active: true,
    })
  }
  const departments = [...(departmentsQuery.data ?? [])].filter(
    (item) => isAdministrator || !user?.department || item.id === user.department.id,
  )
  if (user?.department && !departments.some((item) => item.id === user.department?.id)) {
    departments.push({
      id: user.department.id,
      code: '',
      name: user.department.name,
      is_active: true,
    })
  }

  return {
    users,
    departments,
    usersError: usersQuery.isError ? usersQuery.error : null,
    departmentsError: departmentsQuery.isError ? departmentsQuery.error : null,
  }
}

type ProjectListFilters = Omit<ProjectFilters, 'page' | 'per_page'>

export function ProjectsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const permissions = user?.permissions ?? []
  const [filters, setFilters] = useState<ProjectListFilters>({
    search: '',
    status: '',
    department_id: '',
    priority: '',
    sort_by: 'created_at',
    sort_order: 'DESC',
    include_archived: false,
  })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const deferredSearch = useDeferredValue(search.trim())
  const { users, departments, usersError, departmentsError } = useProjectOptions()
  const queryFilters: ProjectFilters = {
    ...filters,
    search: deferredSearch,
    page,
    per_page: perPage,
  }
  const projectsQuery = useQuery({
    queryKey: ['projects', queryFilters],
    queryFn: () => listProjects(queryFilters),
    staleTime: 30_000,
  })
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      setFormOpen(false)
      navigate(`/projects/${project.id}`)
    },
  })

  const updateFilter = (key: keyof ProjectListFilters, value: string | boolean) => {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }
  const rows = projectsQuery.data?.projects ?? []
  const meta = projectsQuery.data
  const canCreate = permissions.includes('projects.create')

  const columns = useMemo<DataTableColumn<Project>[]>(() => [
    {
      key: 'project',
      header: 'Project',
      render: (project) => (
        <div className="project-list__identity">
          <Link to={`/projects/${project.id}`}>{project.name}</Link>
          <span>{project.project_code}</span>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Timeline',
      render: (project) => (
        <div className="project-list__dates">
          <span>{formatDate(project.start_date)}</span>
          <span>to {formatDate(project.target_end_date)}</span>
        </div>
      ),
    },
    {
      key: 'manager',
      header: 'Project manager',
      render: (project) => {
        const manager = users.find((item) => item.id === project.manager_id)
        return <span className="project-list__person">{manager?.full_name ?? `User ${project.manager_id.slice(0, 8)}`}</span>
      },
    },
    {
      key: 'department',
      header: 'Department',
      render: (project) => (
        <span className="project-list__person">
          {departments.find((item) => item.id === project.department_id)?.name ?? `Department ${project.department_id.slice(0, 8)}`}
        </span>
      ),
    },
    {
      key: 'budget',
      header: 'Approved budget',
      render: (project) => <span className="project-list__money">{formatMoney(project.approved_budget, project.currency)}</span>,
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (project) => (
        <div className="project-list__progress">
          <span>{project.progress.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</span>
          <span className="project-list__progress-track"><span style={{ width: `${Math.min(Math.max(project.progress, 0), 100)}%` }} /></span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (project) => <span className={`project-priority project-priority--${project.priority.toLowerCase()}`}>{project.priority}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (project) => (
        <div className="project-list__statuses">
          <ProjectStatusBadge status={project.status} />
          {project.archived_at && <StatusBadge>Archived</StatusBadge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (project) => (
        <Link aria-label={`View ${project.name}`} className="project-list__open" to={`/projects/${project.id}`}>
          <ExternalLink size={15} />
        </Link>
      ),
    },
  ], [departments, users])

  if (projectsQuery.isError) {
    return (
      <div className="projects-page">
        <Feedback tone="error" title="Projects couldn’t be loaded">
          {getErrorMessage(projectsQuery.error)}
        </Feedback>
        <Button onClick={() => void projectsQuery.refetch()} variant="secondary">
          <RefreshCw size={15} /> Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="projects-page">
      {usersError && permissions.includes('users.read') && (
        <Feedback tone="error" title="User assignment options couldn’t be loaded">{getErrorMessage(usersError)}</Feedback>
      )}
      {departmentsError && permissions.includes('departments.read') && (
        <Feedback tone="error" title="Department options couldn’t be loaded">{getErrorMessage(departmentsError)}</Feedback>
      )}
      <header className="projects-heading">
        <div>
          <p className="projects-eyebrow">PROJECT MANAGEMENT</p>
          <p>Find and manage projects you’re authorized to access.</p>
        </div>
        {canCreate && (
          <Button onClick={() => { createMutation.reset(); setFormOpen(true) }}>
            <CirclePlus size={16} /> New project
          </Button>
        )}
      </header>

      <section aria-label="Project filters" className="projects-filters">
        <label className="projects-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search projects"
            maxLength={100}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder="Search project name or code"
            type="search"
            value={search}
          />
        </label>
        <label>
          <span>Status</span>
          <select onChange={(event) => updateFilter('status', event.target.value)} value={filters.status}>
            <option value="">All statuses</option>
            {projectStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select onChange={(event) => updateFilter('priority', event.target.value)} value={filters.priority}>
            <option value="">All priorities</option>
            {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
        {departments.length > 1 && (
          <label>
            <span>Department</span>
            <select onChange={(event) => updateFilter('department_id', event.target.value)} value={filters.department_id}>
              <option value="">All departments</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
        )}
        <label>
          <span>Sort by</span>
          <select
            onChange={(event) => updateFilter('sort_by', event.target.value)}
            value={filters.sort_by}
          >
            <option value="created_at">Recently created</option>
            <option value="name">Name</option>
            <option value="project_code">Project code</option>
            <option value="start_date">Start date</option>
            <option value="target_end_date">Target end date</option>
            <option value="status">Status</option>
          </select>
        </label>
        <button
          aria-label={`Sort ${filters.sort_order === 'ASC' ? 'ascending' : 'descending'}`}
          className="projects-sort-direction"
          onClick={() => updateFilter('sort_order', filters.sort_order === 'ASC' ? 'DESC' : 'ASC')}
          type="button"
        >
          {filters.sort_order === 'ASC' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
        </button>
        <label className="projects-archived-filter">
          <input
            checked={filters.include_archived}
            onChange={(event) => updateFilter('include_archived', event.target.checked)}
            type="checkbox"
          />
          Include archived
        </label>
      </section>

      {projectsQuery.isPending ? (
        <div className="projects-loading" aria-label="Loading projects" aria-live="polite">
          {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
        </div>
      ) : (
        <>
          <div className="projects-list-meta">
            <span>{(meta?.total ?? 0).toLocaleString()} {meta?.total === 1 ? 'project' : 'projects'}</span>
            {projectsQuery.isFetching && <span className="projects-refreshing"><RefreshCw size={13} /> Updating…</span>}
          </div>
          <DataTable
            columns={columns}
            emptyDescription={filters.include_archived
              ? 'Try another search or filter, or create a project.'
              : 'Try another search or filter, or create your first project.'}
            emptyTitle={deferredSearch || filters.status || filters.priority ? 'No matching projects' : 'No projects yet'}
            getRowKey={(project) => project.id}
            rows={rows}
          />
          {rows.length > 0 && (
            <nav aria-label="Project pages" className="projects-pagination">
              <span>
                Page {meta?.page ?? 1} of {Math.max(meta?.total_pages ?? 1, 1)}
              </span>
              <div>
                <Button
                  disabled={page <= 1 || projectsQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  size="small"
                  variant="secondary"
                >
                  <ChevronLeft size={15} /> Previous
                </Button>
                <Button
                  disabled={!meta?.total_pages || page >= meta.total_pages || projectsQuery.isFetching}
                  onClick={() => setPage((current) => current + 1)}
                  size="small"
                  variant="secondary"
                >
                  Next <ChevronRight size={15} />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      <Dialog
        description="Project codes are generated automatically after a project is created."
        onClose={() => setFormOpen(false)}
        open={formOpen}
        title="Create project"
      >
        <ProjectForm
          departments={departments}
          onCancel={() => setFormOpen(false)}
          onSubmit={(input) => createMutation.mutateAsync(input)}
          submitting={createMutation.isPending}
          users={users}
        />
      </Dialog>
    </div>
  )
}

function ProjectDetailLoading() {
  return <div className="projects-loading projects-loading--detail" aria-label="Loading project" aria-live="polite"><span /><span /></div>
}

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const { user } = useAuth()
  const permissions = user?.permissions ?? []
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [rolePermissionsOpen, setRolePermissionsOpen] = useState(false)
  const [progress, setProgress] = useState('')
  const [status, setStatus] = useState<ProjectStatus | null>(null)
  const [statusReason, setStatusReason] = useState('')
  const [memberID, setMemberID] = useState('')
  const [memberRole, setMemberRole] = useState<ProjectMember['project_role']>('MEMBER')
  const [actionError, setActionError] = useState<string | null>(null)
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  })
  const project = projectQuery.data
  const canManage = Boolean(project && user && permissions.includes('projects.update')
    && userCanManageProject(project, user.id, user.roles))
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => listProjectMembers(projectId),
    enabled: Boolean(project),
  })
  const budgetQuery = useQuery({
    queryKey: ['project-budget', projectId],
    queryFn: () => getProjectBudgetSummary(projectId),
    enabled: Boolean(project) && permissions.includes('budgets.read'),
  })
  const { users, departments, usersError, departmentsError } = useProjectOptions(project?.department_id, Boolean(project))
  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateProject>[1]) => updateProject(projectId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ])
      setEditOpen(false)
    },
  })
  const statusMutation = useMutation({
    mutationFn: ({ nextStatus, reason }: { nextStatus: ProjectStatus; reason: string }) =>
      updateProjectStatus(projectId, nextStatus, reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ])
      setActionError(null)
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const progressMutation = useMutation({
    mutationFn: (value: number) => updateProjectProgress(projectId, value),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ])
      setActionError(null)
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const archiveMutation = useMutation({
    mutationFn: () => archiveProject(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate('/projects')
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const addMemberMutation = useMutation({
    mutationFn: (input: { user_id: string; project_role: ProjectMember['project_role'] }) =>
      addProjectMember(projectId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-members', projectId] })
      setMemberID('')
      setActionError(null)
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const removeMemberMutation = useMutation({
    mutationFn: (userID: string) => removeProjectMember(projectId, userID),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-members', projectId] })
      setActionError(null)
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const budget = budgetQuery.data
  const members = membersQuery.data ?? []
  const memberCandidates = users.filter((option) =>
    option.is_active &&
    option.department?.id === project?.department_id &&
    !members.some((member) => member.user_id === option.id),
  )
  const canArchive = Boolean(canManage && permissions.includes('projects.archive') && !project?.archived_at)
  const optionsError = usersError ?? departmentsError

  if (projectQuery.isPending) return <ProjectDetailLoading />
  if (projectQuery.isError || !project) {
    return (
      <div className="projects-page">
        <Feedback tone="error" title="Project details couldn’t be loaded">
          {projectQuery.isError ? getErrorMessage(projectQuery.error) : 'Project not found.'}
        </Feedback>
        <Link className="button button--secondary" to="/projects"><ArrowLeft size={15} /> Back to projects</Link>
      </div>
    )
  }

  const openEdit = () => {
    updateMutation.reset()
    setEditOpen(true)
  }

  return (
    <div className="projects-page project-detail">
      <Link className="project-detail__back" to="/projects"><ArrowLeft size={15} /> All projects</Link>
      {actionError && <Feedback tone="error" title="Project action failed">{actionError}</Feedback>}
      {updateMutation.isError && <Feedback tone="error" title="Project could not be saved">{getErrorMessage(updateMutation.error)}</Feedback>}
      {optionsError && <Feedback tone="error" title="Project assignment options unavailable">{getErrorMessage(optionsError)}</Feedback>}

      <header className="project-detail__header">
        <div>
          <p className="projects-eyebrow">{project.project_code}</p>
          <div className="project-detail__title">
            <h2>{project.name}</h2>
            <ProjectStatusBadge status={project.status} />
            {project.archived_at && <StatusBadge tone="neutral">Archived</StatusBadge>}
          </div>
          <p>{project.description || 'No project description has been added.'}</p>
        </div>
        <div className="project-detail__actions">
          {permissions.includes('tasks.read') && (
            <Link className="button button--secondary" to={`/projects/${project.id}/tasks`}>
              <ListTodo size={15} /> Tasks
            </Link>
          )}
          {permissions.includes('milestones.read') && (
            <Link className="button button--secondary" to={`/projects/${project.id}/milestones`}>
              <CalendarDays size={15} /> Milestones
            </Link>
          )}
          {canManage && !project.archived_at && (
            <Button onClick={openEdit} variant="secondary">Edit project</Button>
          )}
          {canArchive && (
            <Button
              disabled={archiveMutation.isPending}
              onClick={() => {
                if (window.confirm(`Archive “${project.name}”? It will remain available in project history.`)) {
                  setActionError(null)
                  archiveMutation.mutate()
                }
              }}
              variant="danger"
            >
              <Archive size={15} /> Archive
            </Button>
          )}
        </div>
      </header>

      <section aria-label="Project overview" className="project-detail__overview">
        <div><span>Department</span><strong>{departments.find((item) => item.id === project.department_id)?.name ?? project.department_id}</strong></div>
        <div><span>Project manager</span><strong>{users.find((item) => item.id === project.manager_id)?.full_name ?? project.manager_id}</strong></div>
        <div><span>Owner</span><strong>{users.find((item) => item.id === project.owner_id)?.full_name ?? project.owner_id}</strong></div>
        <div><span>Priority</span><strong>{project.priority}</strong></div>
        <div><span>Timeline</span><strong>{formatDate(project.start_date)} – {formatDate(project.target_end_date)}</strong></div>
        <div><span>Approved budget</span><strong>{formatMoney(project.approved_budget, project.currency)}</strong></div>
        <div><span>Progress</span><strong>{project.progress.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</strong></div>
      </section>

      <section className="project-detail__grid">
        <article className="project-panel">
          <header className="project-panel__heading">
            <div><h3>Delivery progress</h3><p>Project status and completion progress</p></div>
          </header>
          <div className="project-detail__progress">
            <div className="project-detail__progress-track"><span style={{ width: `${Math.min(Math.max(project.progress, 0), 100)}%` }} /></div>
            <strong>{project.progress.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</strong>
          </div>
          {canManage && !project.archived_at && (
            <div className="project-detail__controls">
              <form onSubmit={(event) => {
                event.preventDefault()
                const nextProgress = Number(progress)
                if (progress === '' || !Number.isFinite(nextProgress) || nextProgress < 0 || nextProgress > 100) {
                  setActionError('Progress must be a number from 0 to 100.')
                  return
                }
                setActionError(null)
                progressMutation.mutate(nextProgress)
              }}>
                <label className="project-detail__inline-field">
                  <span>Update progress (%)</span>
                  <input aria-label="Project progress" max="100" min="0" onChange={(event) => setProgress(event.target.value)} placeholder={String(project.progress)} step="0.1" type="number" value={progress} />
                </label>
                <Button disabled={progressMutation.isPending} size="small" type="submit">Save progress</Button>
              </form>
              <form onSubmit={(event) => {
                event.preventDefault()
                setActionError(null)
                statusMutation.mutate({ nextStatus: status ?? project.status, reason: statusReason })
              }}>
                <label className="project-detail__inline-field">
                  <span>Update status</span>
                  <select onChange={(event) => setStatus(event.target.value as ProjectStatus)} value={status ?? project.status}>
                    {projectStatuses.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}
                  </select>
                </label>
                <label className="project-detail__inline-field">
                  <span>Reason (optional)</span>
                  <input maxLength={1000} onChange={(event) => setStatusReason(event.target.value)} value={statusReason} />
                </label>
                <Button disabled={statusMutation.isPending} size="small" type="submit">Save status</Button>
              </form>
            </div>
          )}
        </article>

        <article className="project-panel">
          <header className="project-panel__heading">
            <div><h3>Budget summary</h3><p>Backend-calculated project totals</p></div>
          </header>
          {!permissions.includes('budgets.read') ? (
            <EmptyState icon={<span aria-hidden="true">—</span>} title="Budget access unavailable" description="Your account does not have permission to view project budget totals." />
          ) : budgetQuery.isPending ? (
            <div className="project-panel__loading" aria-label="Loading budget summary" />
          ) : budgetQuery.isError ? (
            <Feedback tone="error" title="Budget summary unavailable">
              {getErrorMessage(budgetQuery.error)}
            </Feedback>
          ) : budget ? (
            <BudgetSummaryView budget={budget} />
          ) : (
            <EmptyState icon={<span aria-hidden="true">—</span>} title="No budget summary" description="There is no budget summary for this project." />
          )}
        </article>
      </section>

      <section className="project-panel">
        <header className="project-panel__heading">
          <div><h3>Project team</h3><p>People assigned to this project</p></div>
          <div className="project-panel__actions">
            {canManage && !project.archived_at && <Button onClick={() => setRolePermissionsOpen(true)} size="small" variant="secondary"><ShieldCheck size={14} /> Configure roles</Button>}
            <Users size={18} aria-hidden="true" />
          </div>
        </header>
        {membersQuery.isPending ? (
          <div className="project-panel__loading" aria-label="Loading project team" />
        ) : membersQuery.isError ? (
          <Feedback tone="error" title="Project members couldn’t be loaded">{getErrorMessage(membersQuery.error)}</Feedback>
        ) : members.length === 0 ? (
          <EmptyState icon={<Users size={18} />} title="No team members yet" description="Add project team members to keep collaborators visible here." />
        ) : (
          <ul className="project-members">
            {members.map((member) => (
              <li key={member.user_id}>
                <span className="project-members__avatar" aria-hidden="true">{member.full_name.slice(0, 1).toUpperCase()}</span>
                <span className="project-members__identity"><strong>{member.full_name}</strong><small>{member.email}</small></span>
                <StatusBadge tone="info">{member.project_role}</StatusBadge>
                {canManage && !project.archived_at && (
                  <Button
                    disabled={removeMemberMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Remove ${member.full_name} from this project?`)) {
                        setActionError(null)
                        removeMemberMutation.mutate(member.user_id)
                      }
                    }}
                    size="small"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && !project.archived_at && (
          permissions.includes('users.read') ? (
            <form className="project-members__add" onSubmit={(event) => {
              event.preventDefault()
              if (!memberID) return
              setActionError(null)
              addMemberMutation.mutate({ user_id: memberID, project_role: memberRole })
            }}>
              <label className="project-detail__inline-field">
                <span>Add department member</span>
                <select aria-label="Team member" onChange={(event) => setMemberID(event.target.value)} value={memberID}>
                  <option value="">Select a user</option>
                  {memberCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>{candidate.full_name} · {candidate.email}</option>
                  ))}
                </select>
              </label>
              <label className="project-detail__inline-field">
                <span>Project role</span>
                <select aria-label="Project role" onChange={(event) => setMemberRole(event.target.value as ProjectMember['project_role'])} value={memberRole}>
                  <option value="MEMBER">Member</option><option value="LEAD">Lead</option><option value="CONTRIBUTOR">Contributor</option>
                </select>
              </label>
              <Button disabled={!memberID || addMemberMutation.isPending} size="small" type="submit">
                <CirclePlus size={14} /> Add member
              </Button>
              {users.length === 0 && <span className="project-form__hint">No active users are available in this department.</span>}
            </form>
          ) : (
            <p className="project-form__hint">User-list permission is required to choose members for assignment.</p>
          )
        )}
      </section>

      <Dialog
        description="The project code cannot be changed after creation."
        onClose={() => setEditOpen(false)}
        open={editOpen}
        title="Edit project"
      >
        <ProjectForm
          departments={departments.filter((department) => department.is_active || department.id === project.department_id)}
          onCancel={() => setEditOpen(false)}
          onSubmit={(input) => updateMutation.mutateAsync(input)}
          project={project}
          submitting={updateMutation.isPending}
          users={users}
        />
      </Dialog>
      {rolePermissionsOpen && <ProjectRolePermissionsDialog onClose={() => setRolePermissionsOpen(false)} projectID={projectId} />}
    </div>
  )
}

function BudgetSummaryView({ budget }: { budget: ProjectBudgetSummary }) {
  const lines = [
    ['Approved budget', budget.approved_budget],
    ['Planned budget', budget.planned_budget],
    ['Committed cost', budget.committed_cost],
    ['Actual cost', budget.actual_cost],
    ['Forecast cost', budget.forecast_cost],
    ['Remaining budget', budget.remaining_budget],
    ['Budget variance', budget.budget_variance],
  ]
  return (
    <div className="project-budget">
      <div className="project-budget__header">
        <span>{budget.currency}</span>
        <StatusBadge tone={
          budget.status === 'OVER_BUDGET' ? 'danger'
            : budget.status === 'CRITICAL' || budget.status === 'WARNING' ? 'warning'
              : 'success'
        }>
          {budget.status.replaceAll('_', ' ')}
        </StatusBadge>
      </div>
      <div className="project-budget__utilization">
        <div className="project-detail__progress-track"><span style={{ width: `${Math.min(Math.max(budget.utilization_percentage, 0), 100)}%` }} /></div>
        <span>{budget.utilization_percentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}% utilized</span>
      </div>
      <dl>
        {lines.map(([label, amount]) => (
          <div key={label}><dt>{label}</dt><dd>{formatMoney(amount, budget.currency)}</dd></div>
        ))}
      </dl>
    </div>
  )
}
