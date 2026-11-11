import { zodResolver } from '@hookform/resolvers/zod'
import { useDeferredValue, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  FilePenLine,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
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
import {
  createAdminDepartment,
  createAdminUser,
  getAdminUser,
  listAdminDepartments,
  listAdminRoles,
  listRolePermissions,
  listAdminUsers,
  setAdminDepartmentActive,
  setAdminUserActive,
  updateAdminDepartment,
  updateAdminUser,
  updateRolePermissions,
  type AdminDepartment,
  type AdminRolePermissionSet,
  type AdminRole,
  type AdminUser,
  type AdminUserFilters,
  type AdminUserInput,
} from './admin.api'
import './admin.css'

const userPageSize = 20
const departmentPageSize = 20

const userSchema = z.object({
  full_name: z.string().trim().min(1, 'Enter a full name.').max(150, 'Use 150 characters or fewer.'),
  email: z.string().trim().email('Enter a valid email address.').max(255, 'Use 255 characters or fewer.'),
  password: z.string().refine((value) => value === '' || value.length >= 8, 'Password must be at least 8 characters.')
    .refine((value) => value === '' || new TextEncoder().encode(value).length <= 72, 'Password must be at most 72 bytes.'),
  department_id: z.string(),
  role_ids: z.array(z.string()).min(1, 'Select at least one role.'),
})

type UserValues = z.infer<typeof userSchema>

function RolePermissionEditor({
  role,
  onClose,
}: {
  role: AdminRolePermissionSet
  onClose?: () => void
}) {
  const queryClient = useQueryClient()
  const [permissionCodes, setPermissionCodes] = useState(() => role.permissions.filter((permission) => permission.granted).map((permission) => permission.code))
  const [saved, setSaved] = useState(false)
  const mutation = useMutation({
    mutationFn: () => updateRolePermissions(role.role.id, permissionCodes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-role-permissions'] })
      setActionError(null)
      setSaved(true)
      onClose?.()
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const [actionError, setActionError] = useState<string | null>(null)

  return (
    <div className="admin-form">
      {actionError && <Feedback tone="error" title="Role permissions could not be saved">{actionError}</Feedback>}
      {saved && <p className="admin-form__hint" role="status">Role permissions saved.</p>}
      <p className="admin-form__hint">These permissions apply globally to the {role.role.name} role. For project members, project-role settings control task and milestone permissions within each project.</p>
      <fieldset className="admin-roles">
        <legend>Permissions</legend>
        {role.permissions.map((permission) => (
          <label className="admin-roles__option" key={permission.code}>
            <input
              checked={permissionCodes.includes(permission.code)}
              onChange={(event) => {
                setSaved(false)
                setPermissionCodes((current) => event.target.checked
                  ? [...current, permission.code]
                  : current.filter((code) => code !== permission.code))
              }}
              type="checkbox"
            />
            <span><strong>{permission.code}</strong><small>{permission.description}</small></span>
          </label>
        ))}
        {role.permissions.length === 0 && <p>No permissions are available for this role.</p>}
      </fieldset>
      <div className="admin-form__actions">
        {onClose && <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>}
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save permissions'}
        </Button>
      </div>
    </div>
  )
}

function RolePermissionsContent({ onClose }: { onClose?: () => void }) {
  const query = useQuery({
    queryKey: ['admin-role-permissions'],
    queryFn: listRolePermissions,
  })
  const [roleID, setRoleID] = useState('')
  const editableRoles = (query.data ?? []).filter((item) => !item.locked)
  const selectedRole = editableRoles.find((item) => item.role.id === roleID) ?? editableRoles[0]

  return (
    <>
      {query.isError && <Feedback tone="error" title="Role permissions couldn’t be loaded">{getErrorMessage(query.error)}</Feedback>}
      {query.isPending ? (
        <div aria-label="Loading role permissions" className="admin-loading" />
      ) : (
        <>
          <label className="admin-form__field">
            <span>Global role</span>
            <select onChange={(event) => setRoleID(event.target.value)} value={selectedRole?.role.id ?? ''}>
              {editableRoles.map((item) => <option key={item.role.id} value={item.role.id}>{item.role.name}</option>)}
            </select>
          </label>
          {selectedRole && <RolePermissionEditor key={selectedRole.role.id} onClose={onClose} role={selectedRole} />}
          <p className="admin-form__hint">SUPER_ADMIN is locked to preserve a recovery administrator. Permission changes are audited and take effect on the next API request.</p>
        </>
      )}
    </>
  )
}

function RolePermissionsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog description="Global role permissions control system-wide capabilities. Only a super administrator can change them." onClose={onClose} open title="Configure role permissions">
      <RolePermissionsContent onClose={onClose} />
    </Dialog>
  )
}

function UserForm({
  user,
  roles,
  departments,
  onSubmit,
  onCancel,
  submitting,
}: {
  user?: AdminUser
  roles: AdminRole[]
  departments: AdminDepartment[]
  onSubmit: (input: AdminUserInput) => Promise<unknown>
  onCancel: () => void
  submitting: boolean
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
      password: '',
      department_id: user?.department?.id ?? '',
      role_ids: roles.filter((role) => user?.roles.includes(role.code)).map((role) => role.id),
    },
  })
  const submit = async (values: UserValues) => {
    setServerError(null)
    try {
      await onSubmit({
        ...values,
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        department_id: values.department_id || null,
      })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }
  return (
    <form className="admin-form" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <Feedback tone="error" title="User could not be saved">{serverError}</Feedback>}
      <TextField autoFocus error={errors.full_name?.message} label="Full name" maxLength={150} {...register('full_name')} />
      <TextField autoComplete="email" error={errors.email?.message} label="Email address" maxLength={255} type="email" {...register('email')} />
      <TextField
        autoComplete="new-password"
        error={errors.password?.message}
        hint={user ? 'Leave blank to keep the current password.' : 'At least 8 characters. Changing it signs the user out of other sessions.'}
        label={user ? 'Set new password (optional)' : 'Temporary password'}
        maxLength={72}
        type="password"
        {...register('password')}
      />
      <label className="admin-form__field">
        <span>Department</span>
        <select {...register('department_id')}>
          <option value="">No department</option>
          {departments.filter((department) => department.is_active || department.id === user?.department?.id)
            .map((department) => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}
        </select>
      </label>
      <fieldset className="admin-roles">
        <legend>Roles</legend>
        {roles.map((role) => (
          <label className="admin-roles__option" key={role.id}>
            <input type="checkbox" value={role.id} {...register('role_ids')} />
            <span><strong>{role.name}</strong><small>{role.code.replaceAll('_', ' ')}</small></span>
          </label>
        ))}
        {roles.length === 0 && <p>No assignable roles are available.</p>}
        {errors.role_ids?.message && <small className="admin-form__error">{errors.role_ids.message}</small>}
      </fieldset>
      <p className="admin-form__hint">
        Role assignment is checked by the backend. Only super administrators can assign administrator roles.
      </p>
      <div className="admin-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={submitting || roles.length === 0} type="submit">{submitting ? 'Saving…' : user ? 'Save user' : 'Create user'}</Button>
      </div>
    </form>
  )
}

const departmentSchema = z.object({
  code: z.string().trim().min(1, 'Enter a department code.').max(30).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens, or underscores.'),
  name: z.string().trim().min(1, 'Enter a department name.').max(150),
  description: z.string().max(5000, 'Use 5,000 characters or fewer.'),
})
type DepartmentValues = z.infer<typeof departmentSchema>

function DepartmentForm({
  department,
  onSubmit,
  onCancel,
  submitting,
}: {
  department?: AdminDepartment
  onSubmit: (input: Omit<AdminDepartment, 'id' | 'is_active'>) => Promise<unknown>
  onCancel: () => void
  submitting: boolean
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<DepartmentValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      code: department?.code ?? '',
      name: department?.name ?? '',
      description: department?.description ?? '',
    },
  })
  const submit = async (values: DepartmentValues) => {
    setServerError(null)
    try {
      await onSubmit({
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        description: values.description.trim() || null,
      })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }
  return (
    <form className="admin-form" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <Feedback tone="error" title="Department could not be saved">{serverError}</Feedback>}
      <TextField autoFocus error={errors.code?.message} label="Department code" maxLength={30} {...register('code')} />
      <TextField error={errors.name?.message} label="Department name" maxLength={150} {...register('name')} />
      <label className="admin-form__field">
        <span>Description (optional)</span>
        <textarea maxLength={5000} rows={4} {...register('description')} />
        {errors.description?.message && <small className="admin-form__error">{errors.description.message}</small>}
      </label>
      <div className="admin-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={submitting} type="submit">{submitting ? 'Saving…' : department ? 'Save department' : 'Create department'}</Button>
      </div>
    </form>
  )
}

function formatRole(role: string) {
  return role.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<AdminUserFilters>({
    page: 1,
    per_page: userPageSize,
    search: '',
    department_id: '',
    is_active: '',
    sort_by: 'created_at',
    sort_order: 'desc',
  })
  const [formUserID, setFormUserID] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(filters.search)
  const permissions = currentUser?.permissions ?? []
  const canCreate = permissions.includes('users.create')
  const canUpdate = permissions.includes('users.update')
  const canDeactivate = permissions.includes('users.deactivate')
  const isSuperAdmin = currentUser?.roles.includes('SUPER_ADMIN') ?? false
  const usersQuery = useQuery({
    queryKey: ['admin-users', { ...filters, search: deferredSearch }],
    queryFn: () => listAdminUsers({ ...filters, search: deferredSearch }),
    enabled: permissions.includes('users.read'),
  })
  const departmentsQuery = useQuery({
    queryKey: ['admin-departments'],
    queryFn: listAdminDepartments,
    enabled: permissions.includes('departments.read'),
    staleTime: 60_000,
  })
  const rolesQuery = useQuery({
    queryKey: ['admin-roles'],
    queryFn: listAdminRoles,
    enabled: formOpen && permissions.includes('users.read'),
    staleTime: 60_000,
  })
  const selectedUserQuery = useQuery({
    queryKey: ['admin-user', formUserID],
    queryFn: () => getAdminUser(formUserID!),
    enabled: Boolean(formOpen && formUserID),
  })
  const refreshUsers = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-user'] }),
  ])
  const saveUserMutation = useMutation({
    mutationFn: (input: AdminUserInput) => formUserID
      ? updateAdminUser(formUserID, input)
      : createAdminUser(input),
    onSuccess: async () => {
      await refreshUsers()
      setActionError(null)
      setFormOpen(false)
      setFormUserID(null)
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const statusMutation = useMutation({
    mutationFn: ({ userID, isActive }: { userID: string; isActive: boolean }) => setAdminUserActive(userID, isActive),
    onSuccess: async () => { await refreshUsers(); setActionError(null) },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const user = selectedUserQuery.data ?? usersQuery.data?.items.find((item) => item.id === formUserID)
  const updateFilter = (key: keyof AdminUserFilters, value: string | number) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }
  const roleOptions = rolesQuery.data ?? []
  const departmentOptions = departmentsQuery.data ?? []
  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: 'name',
      header: 'User',
      render: (item) => <div className="admin-table__identity"><strong>{item.full_name}</strong><span>{item.email}</span></div>,
    },
    {
      key: 'department',
      header: 'Department',
      render: (item) => item.department?.name ?? '—',
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (item) => <div className="admin-role-list">{item.roles.map((role) => <StatusBadge key={role} tone="info">{formatRole(role)}</StatusBadge>)}</div>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge tone={item.is_active ? 'success' : 'neutral'}>{item.is_active ? 'Active' : 'Inactive'}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => {
        const privilegedTarget = item.roles.includes('ADMIN') || item.roles.includes('SUPER_ADMIN')
        const canEditTarget = canUpdate && (!privilegedTarget || isSuperAdmin)
        const canChangeStatus = canDeactivate && item.id !== currentUser?.id && (!privilegedTarget || isSuperAdmin)
        return (
          <div className="admin-table__actions">
            {canEditTarget && <Button onClick={() => {
              saveUserMutation.reset()
              setActionError(null)
              setFormUserID(item.id)
              setFormOpen(true)
            }} size="small" variant="secondary"><FilePenLine size={13} /> Edit</Button>}
            {canChangeStatus && <Button
              disabled={statusMutation.isPending}
              onClick={() => {
                const nextStatus = !item.is_active
                if (!window.confirm(`${nextStatus ? 'Activate' : 'Deactivate'} ${item.full_name}?${nextStatus ? '' : ' This revokes their active sessions.'}`)) return
                setActionError(null)
                statusMutation.mutate({ userID: item.id, isActive: nextStatus })
              }}
              size="small"
              variant={item.is_active ? 'danger' : 'secondary'}
            >{item.is_active ? 'Deactivate' : 'Activate'}</Button>}
          </div>
        )
      },
    },
  ]

  if (usersQuery.isError) {
    return <div className="admin-page"><Feedback tone="error" title="Users couldn’t be loaded">{getErrorMessage(usersQuery.error)}</Feedback><Button onClick={() => void usersQuery.refetch()} variant="secondary"><RefreshCw size={15} /> Try again</Button></div>
  }

  return (
    <div className="admin-page">
      <header className="admin-heading">
        <div><p className="admin-eyebrow">ACCESS MANAGEMENT</p><h2>Users</h2><p>Search accounts, manage roles, and update access status.</p></div>
        <div className="admin-heading__actions">
          {isSuperAdmin && <Button onClick={() => setPermissionsOpen(true)} variant="secondary"><ShieldCheck size={15} /> Role permissions</Button>}
          {canCreate && <Button onClick={() => {
            saveUserMutation.reset()
            setActionError(null)
            setFormUserID(null)
            setFormOpen(true)
          }}><CirclePlus size={15} /> New user</Button>}
        </div>
      </header>
      <div className="admin-tabs"><Link className="admin-tabs__active" to="/admin/users"><Users size={15} /> Users</Link>{permissions.includes('departments.read') && <Link to="/admin/departments"><Building2 size={15} /> Departments</Link>}</div>
      {actionError && <Feedback tone="error" title="User action failed">{actionError}</Feedback>}
      {departmentsQuery.isError && permissions.includes('departments.read') && <Feedback tone="error" title="Department filters couldn’t be loaded">{getErrorMessage(departmentsQuery.error)}</Feedback>}
      {rolesQuery.isError && formOpen && <Feedback tone="error" title="Role options couldn’t be loaded">{getErrorMessage(rolesQuery.error)}</Feedback>}
      {statusMutation.isError && !actionError && <Feedback tone="error" title="User status couldn’t be updated">{getErrorMessage(statusMutation.error)}</Feedback>}
      <section aria-label="User filters" className="admin-filters">
        <label className="admin-search"><Search size={15} aria-hidden="true" /><input aria-label="Search users" maxLength={100} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search name or email" type="search" value={filters.search} /></label>
        {permissions.includes('departments.read') && <label><span>Department</span><select onChange={(event) => updateFilter('department_id', event.target.value)} value={filters.department_id}><option value="">All departments</option>{departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>}
        <label><span>Status</span><select onChange={(event) => updateFilter('is_active', event.target.value)} value={filters.is_active}><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
        <label><span>Sort by</span><select onChange={(event) => updateFilter('sort_by', event.target.value)} value={filters.sort_by}><option value="created_at">Recently created</option><option value="full_name">Name</option><option value="email">Email</option></select></label>
        <button aria-label={`Sort ${filters.sort_order === 'asc' ? 'ascending' : 'descending'}`} className="admin-sort" onClick={() => updateFilter('sort_order', filters.sort_order === 'asc' ? 'desc' : 'asc')} type="button">{filters.sort_order === 'asc' ? '↑' : '↓'}</button>
      </section>
      {usersQuery.isPending ? <div aria-label="Loading users" aria-live="polite" className="admin-loading"><span /><span /><span /></div> : (
        <>
          <div className="admin-list-meta">{(usersQuery.data?.total ?? 0).toLocaleString()} users</div>
          <DataTable columns={columns} emptyDescription={deferredSearch || filters.department_id || filters.is_active ? 'Try another search or filter.' : 'Create a user to grant workspace access.'} emptyTitle={deferredSearch || filters.department_id || filters.is_active ? 'No matching users' : 'No users yet'} getRowKey={(item) => item.id} rows={usersQuery.data?.items ?? []} />
          {(usersQuery.data?.items.length ?? 0) > 0 && <nav aria-label="User pages" className="admin-pagination"><span>Page {filters.page} of {Math.max(usersQuery.data?.total_pages ?? 1, 1)}</span><div><Button disabled={filters.page <= 1 || usersQuery.isFetching} onClick={() => updateFilter('page', filters.page - 1)} size="small" variant="secondary"><ChevronLeft size={15} /> Previous</Button><Button disabled={!usersQuery.data?.total_pages || filters.page >= usersQuery.data.total_pages || usersQuery.isFetching} onClick={() => updateFilter('page', filters.page + 1)} size="small" variant="secondary">Next <ChevronRight size={15} /></Button></div></nav>}
        </>
      )}
      <Dialog description={formUserID ? 'Update profile, department, roles, or optionally set a new password.' : 'Create a new account and assign at least one role.'} onClose={() => { setFormOpen(false); setFormUserID(null) }} open={formOpen} title={formUserID ? 'Edit user' : 'Create user'}>
        {formUserID && selectedUserQuery.isPending ? <div aria-label="Loading user" className="admin-loading" /> : user && formUserID ? (
          <UserForm key={user.id} departments={departmentOptions} onCancel={() => { setFormOpen(false); setFormUserID(null) }} onSubmit={(input) => saveUserMutation.mutateAsync(input)} roles={roleOptions} submitting={saveUserMutation.isPending} user={user} />
        ) : !formUserID && rolesQuery.data ? (
          <UserForm departments={departmentOptions} onCancel={() => setFormOpen(false)} onSubmit={(input) => saveUserMutation.mutateAsync(input)} roles={roleOptions} submitting={saveUserMutation.isPending} />
        ) : formUserID && selectedUserQuery.isError ? (
          <Feedback tone="error" title="User couldn’t be loaded">{getErrorMessage(selectedUserQuery.error)}</Feedback>
        ) : !rolesQuery.isError ? <div aria-label="Loading user form options" className="admin-loading" /> : null}
      </Dialog>
      {permissionsOpen && <RolePermissionsDialog onClose={() => setPermissionsOpen(false)} />}
    </div>
  )
}

export function RolePermissionsPage() {
  return (
    <div className="admin-page">
      <header className="admin-heading">
        <div>
          <p className="admin-eyebrow">ACCESS MANAGEMENT</p>
          <h2>Role permissions</h2>
          <p>Configure global system permissions for each role.</p>
        </div>
      </header>
      <div className="admin-tabs">
        <Link to="/admin/users"><Users size={15} /> Users</Link>
        <Link className="admin-tabs__active" to="/admin/role-permissions"><ShieldCheck size={15} /> Role permissions</Link>
      </div>
      <RolePermissionsContent />
    </div>
  )
}

export function DepartmentsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [department, setDepartment] = useState<AdminDepartment | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const permissions = user?.permissions ?? []
  const query = useQuery({ queryKey: ['admin-departments'], queryFn: listAdminDepartments })
  const mutation = useMutation({
    mutationFn: (input: Omit<AdminDepartment, 'id' | 'is_active'>) => department
      ? updateAdminDepartment(department.id, input)
      : createAdminDepartment(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-departments'] })
      setActionError(null)
      setFormOpen(false)
      setDepartment(null)
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setAdminDepartmentActive(id, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-departments'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setActionError(null)
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  })
  const canCreate = permissions.includes('departments.create')
  const canUpdate = permissions.includes('departments.update')
  const filteredDepartments = (query.data ?? []).filter((item) =>
    `${item.code} ${item.name} ${item.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  )
  const totalPages = Math.ceil(filteredDepartments.length / departmentPageSize)
  const departments = filteredDepartments.slice((page - 1) * departmentPageSize, page * departmentPageSize)
  const columns: DataTableColumn<AdminDepartment>[] = [
    { key: 'code', header: 'Code', render: (item) => <strong>{item.code}</strong> },
    { key: 'name', header: 'Department', render: (item) => <div className="admin-table__identity"><strong>{item.name}</strong><span>{item.description || 'No description'}</span></div> },
    { key: 'status', header: 'Status', render: (item) => <StatusBadge tone={item.is_active ? 'success' : 'neutral'}>{item.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => <div className="admin-table__actions">
        {canUpdate && <Button onClick={() => { mutation.reset(); setActionError(null); setDepartment(item); setFormOpen(true) }} size="small" variant="secondary"><FilePenLine size={13} /> Edit</Button>}
        {canUpdate && <Button disabled={statusMutation.isPending} onClick={() => {
          const nextStatus = !item.is_active
          if (!window.confirm(`${nextStatus ? 'Activate' : 'Deactivate'} ${item.name}?${nextStatus ? '' : ' Existing users remain assigned, but new assignments will be blocked.'}`)) return
          setActionError(null)
          statusMutation.mutate({ id: item.id, isActive: nextStatus })
        }} size="small" variant={item.is_active ? 'danger' : 'secondary'}>{item.is_active ? 'Deactivate' : 'Activate'}</Button>}
      </div>,
    },
  ]

  if (query.isError) return <div className="admin-page"><Feedback tone="error" title="Departments couldn’t be loaded">{getErrorMessage(query.error)}</Feedback><Button onClick={() => void query.refetch()} variant="secondary"><RefreshCw size={15} /> Try again</Button></div>

  return (
    <div className="admin-page">
      <header className="admin-heading"><div><p className="admin-eyebrow">ACCESS MANAGEMENT</p><h2>Departments</h2><p>Manage department details and activation status.</p></div>{canCreate && <Button onClick={() => { mutation.reset(); setActionError(null); setDepartment(null); setFormOpen(true) }}><CirclePlus size={15} /> New department</Button>}</header>
      <div className="admin-tabs">{permissions.includes('users.read') && <Link to="/admin/users"><Users size={15} /> Users</Link>}<Link className="admin-tabs__active" to="/admin/departments"><Building2 size={15} /> Departments</Link></div>
      {actionError && <Feedback tone="error" title="Department action failed">{actionError}</Feedback>}
      {statusMutation.isError && !actionError && <Feedback tone="error" title="Department status couldn’t be updated">{getErrorMessage(statusMutation.error)}</Feedback>}
      <section aria-label="Department search" className="admin-filters"><label className="admin-search"><Search size={15} aria-hidden="true" /><input aria-label="Search departments" maxLength={100} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search name, code, or description" type="search" value={search} /></label></section>
      {query.isPending ? <div aria-label="Loading departments" aria-live="polite" className="admin-loading"><span /><span /><span /></div> : <><div className="admin-list-meta">{filteredDepartments.length.toLocaleString()} departments</div><DataTable columns={columns} emptyDescription={search ? 'Try another search.' : 'Create a department to organize workspace users.'} emptyTitle={search ? 'No matching departments' : 'No departments yet'} getRowKey={(item) => item.id} rows={departments} />{departments.length > 0 && <nav aria-label="Department pages" className="admin-pagination"><span>Page {page} of {Math.max(totalPages, 1)}</span><div><Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} size="small" variant="secondary"><ChevronLeft size={15} /> Previous</Button><Button disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} size="small" variant="secondary">Next <ChevronRight size={15} /></Button></div></nav>}</>}
      <Dialog description="Department codes are normalized to uppercase. Duplicate codes are rejected by the backend." onClose={() => { setFormOpen(false); setDepartment(null) }} open={formOpen} title={department ? 'Edit department' : 'Create department'}>
        <DepartmentForm department={department ?? undefined} onCancel={() => { setFormOpen(false); setDepartment(null) }} onSubmit={(input) => mutation.mutateAsync(input)} submitting={mutation.isPending} />
      </Dialog>
    </div>
  )
}
