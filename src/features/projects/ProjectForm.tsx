import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { getErrorMessage } from '../../api/errors'
import { Button, Feedback, TextField } from '../../components/ui'
import { useAuth } from '../auth/AuthContext'
import type {
  Project,
  ProjectDepartmentOption,
  ProjectInput,
  ProjectUserOption,
} from './projects.api'
import './projects.css'

const projectStatuses = [
  'DRAFT',
  'PROPOSED',
  'PLANNING',
  'APPROVED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const

const projectPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

const projectSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name.').max(255, 'Use 255 characters or fewer.'),
  description: z.string().max(5000, 'Use 5,000 characters or fewer.'),
  category: z.string().max(100, 'Use 100 characters or fewer.'),
  department_id: z.string().min(1, 'Select a department.'),
  owner_id: z.string().min(1, 'Select a project owner.'),
  manager_id: z.string().min(1, 'Select a project manager.'),
  start_date: z.string().min(1, 'Select a start date.'),
  target_end_date: z.string().min(1, 'Select a target end date.'),
  approved_budget: z
    .string()
    .regex(/^\d{1,18}(\.\d{1,2})?$/, 'Enter a non-negative amount with up to 2 decimal places.'),
  currency: z.string().regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code.'),
  priority: z.enum(projectPriorities),
  status: z.enum(projectStatuses),
}).refine((value) => value.target_end_date >= value.start_date, {
  message: 'Target end date must be on or after the start date.',
  path: ['target_end_date'],
})

type ProjectValues = z.infer<typeof projectSchema>

const statusLabels: Record<(typeof projectStatuses)[number], string> = {
  DRAFT: 'Draft',
  PROPOSED: 'Proposed',
  PLANNING: 'Planning',
  APPROVED: 'Approved',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const priorityLabels: Record<(typeof projectPriorities)[number], string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

type ProjectFormProps = {
  project?: Project
  users: ProjectUserOption[]
  departments: ProjectDepartmentOption[]
  onSubmit: (input: ProjectInput) => Promise<unknown>
  onCancel: () => void
  submitting: boolean
}

function projectValues(
  project?: Project,
  currentUser?: { id: string; department: { id: string; name: string } | null } | null,
): ProjectValues {
  return {
    name: project?.name ?? '',
    description: project?.description ?? '',
    category: project?.category ?? '',
    department_id: project?.department_id ?? currentUser?.department?.id ?? '',
    owner_id: project?.owner_id ?? currentUser?.id ?? '',
    manager_id: project?.manager_id ?? currentUser?.id ?? '',
    start_date: project?.start_date ?? '',
    target_end_date: project?.target_end_date ?? '',
    approved_budget: project?.approved_budget ?? '',
    currency: project?.currency ?? 'IDR',
    priority: project?.priority ?? 'MEDIUM',
    status: project?.status ?? 'DRAFT',
  }
}

export function ProjectForm({
  project,
  users,
  departments,
  onSubmit,
  onCancel,
  submitting,
}: ProjectFormProps) {
  const { user: authUser } = useAuth()
  const isAdministrator =
    authUser?.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN') ?? false
  const [serverError, setServerError] = useState<string | null>(null)
  const values = useMemo(() => projectValues(project, authUser), [authUser, project])
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: values,
  })

  useEffect(() => {
    reset(values)
  }, [reset, values])

  const availableUsers = useMemo(() => {
    const options = new Map(users.map((item) => [item.id, item]))
    if (authUser && !options.has(authUser.id)) {
      options.set(authUser.id, {
        id: authUser.id,
        full_name: authUser.full_name,
        email: authUser.email,
        department: authUser.department,
        is_active: true,
      })
    }
    for (const [id, label] of [
      [project?.owner_id, 'Current project owner'],
      [project?.manager_id, 'Current project manager'],
    ] as const) {
      if (id && !options.has(id)) {
        options.set(id, {
          id,
          full_name: `${label} (${id.slice(0, 8)})`,
          email: '',
          department: project ? { id: project.department_id, name: 'Current department' } : null,
          is_active: true,
        })
      }
    }
    return [...options.values()]
  }, [authUser, project, users])

  const selectedDepartmentID = useWatch({ control, name: 'department_id' })
  const departmentUsers = availableUsers.filter(
    (option) => option.department?.id === selectedDepartmentID,
  )
  const assignableUsers =
    !project && !isAdministrator && authUser
      ? departmentUsers.filter((option) => option.id === authUser.id)
      : departmentUsers

  const availableDepartments = useMemo(() => {
    const options = new Map(departments.map((item) => [item.id, item]))
    if (authUser?.department && !options.has(authUser.department.id)) {
      options.set(authUser.department.id, {
        id: authUser.department.id,
        code: '',
        name: authUser.department.name,
        is_active: true,
      })
    }
    if (project && !options.has(project.department_id)) {
      options.set(project.department_id, {
        id: project.department_id,
        code: '',
        name: `Current department (${project.department_id.slice(0, 8)})`,
        is_active: true,
      })
    }
    const values = [...options.values()]
    if (!isAdministrator && authUser?.department) {
      return values.filter((item) => item.id === authUser.department?.id)
    }
    return values
  }, [authUser, departments, isAdministrator, project])

  const submit = async (input: ProjectValues) => {
    setServerError(null)
    try {
      if (
        !isAdministrator &&
        !project &&
        authUser &&
        input.owner_id !== authUser.id &&
        input.manager_id !== authUser.id
      ) {
        setServerError('You must be the project owner or manager to create this project.')
        return
      }
      if (
        !isAdministrator &&
        authUser?.department &&
        input.department_id !== authUser.department.id
      ) {
        setServerError('You can only create projects in your department.')
        return
      }
      await onSubmit({
        ...input,
        currency: input.currency.trim().toUpperCase(),
        description: input.description.trim(),
        category: input.category.trim(),
      })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  return (
    <form className="project-form" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <Feedback tone="error" title="Project could not be saved">{serverError}</Feedback>}

      <TextField
        autoFocus
        error={errors.name?.message}
        label="Project name"
        placeholder="e.g. Infrastructure modernization"
        {...register('name')}
      />

      <label className="project-form__field">
        <span>Project description</span>
        <textarea rows={3} maxLength={5000} {...register('description')} />
        {errors.description?.message && <small className="project-form__error">{errors.description.message}</small>}
      </label>

      <div className="project-form__row">
        <label className="project-form__field">
          <span>Department</span>
          <select {...register('department_id')} aria-invalid={Boolean(errors.department_id)}>
            <option value="">Select department</option>
            {availableDepartments.map((department) => (
              <option disabled={!department.is_active} key={department.id} value={department.id}>
                {department.code ? `${department.name} (${department.code})` : department.name}
              </option>
            ))}
          </select>
          {errors.department_id?.message && <small className="project-form__error">{errors.department_id.message}</small>}
        </label>
        <TextField
          error={errors.category?.message}
          label="Category"
          placeholder="e.g. RKAP"
          {...register('category')}
        />
      </div>

      <div className="project-form__row">
        <label className="project-form__field">
          <span>Owner</span>
          <select {...register('owner_id')} aria-invalid={Boolean(errors.owner_id)}>
            <option value="">Select owner</option>
            {assignableUsers.map((option) => (
              <option disabled={!option.is_active} key={option.id} value={option.id}>
                {option.full_name}{option.department ? ` · ${option.department.name}` : ''}
              </option>
            ))}
          </select>
          {errors.owner_id?.message && <small className="project-form__error">{errors.owner_id.message}</small>}
        </label>
        <label className="project-form__field">
          <span>Project manager</span>
          <select {...register('manager_id')} aria-invalid={Boolean(errors.manager_id)}>
            <option value="">Select manager</option>
            {assignableUsers.map((option) => (
              <option disabled={!option.is_active} key={option.id} value={option.id}>
                {option.full_name}{option.department ? ` · ${option.department.name}` : ''}
              </option>
            ))}
          </select>
          {errors.manager_id?.message && <small className="project-form__error">{errors.manager_id.message}</small>}
        </label>
      </div>

      <div className="project-form__row project-form__row--dates">
        <TextField error={errors.start_date?.message} label="Start date" type="date" {...register('start_date')} />
        <TextField error={errors.target_end_date?.message} label="Target end date" type="date" {...register('target_end_date')} />
      </div>

      <div className="project-form__row">
        <TextField
          error={errors.approved_budget?.message}
          label="Approved budget"
          inputMode="decimal"
          placeholder="0.00"
          {...register('approved_budget')}
        />
        <TextField
          error={errors.currency?.message}
          label="Currency"
          maxLength={3}
          placeholder="IDR"
          {...register('currency')}
        />
      </div>

      <div className="project-form__row">
        <label className="project-form__field">
          <span>Priority</span>
          <select {...register('priority')}>
            {projectPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
          </select>
        </label>
        <label className="project-form__field">
          <span>Status</span>
          <select {...register('status')}>
            {projectStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </label>
      </div>

      {(!departments.length || !users.length) && (
        <p className="project-form__hint">
          Assignment options are limited to the information available to your account. The server will validate all assignments.
        </p>
      )}

      <div className="project-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={submitting} type="submit">{submitting ? 'Saving…' : project ? 'Save changes' : 'Create project'}</Button>
      </div>
    </form>
  )
}
