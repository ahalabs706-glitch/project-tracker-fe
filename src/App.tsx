import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { EmptyState } from './components/ui'
import { AppShell } from './components/layout/AppShell'
import { AuthProvider } from './features/auth/AuthProvider'
import { useAuth } from './features/auth/AuthContext'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth, RequirePermission, RequireRole } from './features/auth/AuthRoutes'
import './App.css'

const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then(({ DashboardPage: page }) => ({
    default: page,
  })),
)
const ProjectsPage = lazy(() =>
  import('./features/projects/ProjectsPage').then(({ ProjectsPage: page }) => ({
    default: page,
  })),
)
const ProjectDetailPage = lazy(() =>
  import('./features/projects/ProjectsPage').then(({ ProjectDetailPage: page }) => ({
    default: page,
  })),
)
const MyTasksPage = lazy(() =>
  import('./features/tasks/TasksPage').then(({ MyTasksPage: page }) => ({
    default: page,
  })),
)
const ProjectTasksPage = lazy(() =>
  import('./features/tasks/TasksPage').then(({ ProjectTasksPage: page }) => ({
    default: page,
  })),
)
const TaskDetailPage = lazy(() =>
  import('./features/tasks/TasksPage').then(({ TaskDetailPage: page }) => ({
    default: page,
  })),
)
const MilestonesPage = lazy(() =>
  import('./features/tasks/MilestonesPage').then(({ MilestonesPage: page }) => ({
    default: page,
  })),
)
const MilestoneDetailPage = lazy(() =>
  import('./features/tasks/MilestonesPage').then(({ MilestoneDetailPage: page }) => ({
    default: page,
  })),
)
const ContractsPage = lazy(() =>
  import('./features/contracts/ContractsPage').then(({ ContractsPage: page }) => ({
    default: page,
  })),
)
const ContractDetailPage = lazy(() =>
  import('./features/contracts/ContractsPage').then(({ ContractDetailPage: page }) => ({
    default: page,
  })),
)
const BudgetsPage = lazy(() =>
  import('./features/budgets/BudgetsPage').then(({ BudgetsPage: page }) => ({
    default: page,
  })),
)
const NotificationsPage = lazy(() =>
  import('./features/notifications/NotificationsPage').then(({ NotificationsPage: page }) => ({
    default: page,
  })),
)
const AuditLogsPage = lazy(() =>
  import('./features/audit-logs/AuditLogsPage').then(({ AuditLogsPage: page }) => ({
    default: page,
  })),
)
const UsersPage = lazy(() =>
  import('./features/admin/AdminManagementPage').then(({ UsersPage: page }) => ({
    default: page,
  })),
)
const DepartmentsPage = lazy(() =>
  import('./features/admin/AdminManagementPage').then(({ DepartmentsPage: page }) => ({
    default: page,
  })),
)
const RolePermissionsPage = lazy(() =>
  import('./features/admin/AdminManagementPage').then(({ RolePermissionsPage: page }) => ({
    default: page,
  })),
)

function ForbiddenPage() {
  return (
    <EmptyState
      icon={<span aria-hidden="true">403</span>}
      title="You don’t have access to this page"
      description="Your account does not have the permission required for this resource."
      action={
        <Link className="button button--secondary" to="/">
          Return to dashboard
        </Link>
      }
    />
  )
}

function NotFoundPage() {
  return (
    <EmptyState
      icon={<span aria-hidden="true">404</span>}
      title="This page could not be found"
      description="The link may be incorrect, or this page may have moved."
    />
  )
}

function AuthenticatedLoginRoute() {
  const { status } = useAuth()
  if (status === 'loading') {
    return (
      <main className="auth-loading" aria-live="polite">
        <span>Checking your session…</span>
      </main>
    )
  }
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <LoginPage />
}

function DefaultWorkspace() {
  const { user } = useAuth()
  const permissions = user?.permissions ?? []

  if (permissions.includes('dashboard.read')) {
    return (
      <Suspense fallback={<main className="dashboard-page" aria-live="polite">Loading dashboard…</main>}>
        <DashboardPage />
      </Suspense>
    )
  }

  const firstAllowedRoute = [
    { path: '/projects', permission: 'projects.read' },
    { path: '/contracts', permission: 'contracts.read' },
    { path: '/my-tasks', permission: 'tasks.read' },
    { path: '/budgets', permission: 'budgets.read' },
    { path: '/notifications', permission: 'notifications.read' },
  ].find((route) => permissions.includes(route.permission))

  return firstAllowedRoute ? (
    <Navigate to={firstAllowedRoute.path} replace />
  ) : (
    <ForbiddenPage />
  )
}

function ProtectedWorkspace() {
  return (
    <RequireAuth>
      <AppShell />
    </RequireAuth>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthenticatedLoginRoute />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route element={<ProtectedWorkspace />}>
        <Route index element={<DefaultWorkspace />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route
          path="projects"
          element={(
            <RequirePermission permission="projects.read">
              <Suspense fallback={<div className="projects-page" aria-live="polite">Loading projects…</div>}>
                <ProjectsPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="projects/:projectId"
          element={(
            <RequirePermission permission="projects.read">
              <Suspense fallback={<div className="projects-page" aria-live="polite">Loading project…</div>}>
                <ProjectDetailPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="my-tasks"
          element={(
            <RequirePermission permission="tasks.read">
              <Suspense fallback={<div className="work-page" aria-live="polite">Loading tasks…</div>}>
                <MyTasksPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="projects/:projectId/tasks"
          element={(
            <RequirePermission permission="tasks.read">
              <Suspense fallback={<div className="work-page" aria-live="polite">Loading project tasks…</div>}>
                <ProjectTasksPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="tasks/:taskId"
          element={(
            <RequirePermission permission="tasks.read">
              <Suspense fallback={<div className="work-page" aria-live="polite">Loading task…</div>}>
                <TaskDetailPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="milestones"
          element={(
            <RequirePermission permission="milestones.read">
              <Suspense fallback={<div className="work-page" aria-live="polite">Loading milestones…</div>}>
                <MilestonesPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="projects/:projectId/milestones"
          element={(
            <RequirePermission permission="milestones.read">
              <Suspense fallback={<div className="work-page" aria-live="polite">Loading project milestones…</div>}>
                <MilestonesPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="milestones/:milestoneId"
          element={(
            <RequirePermission permission="milestones.read">
              <Suspense fallback={<div className="work-page" aria-live="polite">Loading milestone…</div>}>
                <MilestoneDetailPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="contracts"
          element={(
            <RequirePermission permission="contracts.read">
              <Suspense fallback={<div className="contracts-page" aria-live="polite">Loading contracts…</div>}>
                <ContractsPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="contracts/expiring"
          element={(
            <RequirePermission permission="contracts.read">
              <Suspense fallback={<div className="contracts-page" aria-live="polite">Loading contracts…</div>}>
                <ContractsPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="contracts/:contractId"
          element={(
            <RequirePermission permission="contracts.read">
              <Suspense fallback={<div className="contracts-page" aria-live="polite">Loading contract…</div>}>
                <ContractDetailPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="budgets"
          element={(
            <RequirePermission permission="budgets.read">
              <Suspense fallback={<div className="budgets-page" aria-live="polite">Loading budgets…</div>}>
                <BudgetsPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="budgets/transactions"
          element={(
            <RequirePermission permission="budget_transactions.read">
              <Suspense fallback={<div className="budgets-page" aria-live="polite">Loading transactions…</div>}>
                <BudgetsPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="notifications"
          element={(
            <RequirePermission permission="notifications.read">
              <Suspense fallback={<div className="notifications-page" aria-live="polite">Loading notifications…</div>}>
                <NotificationsPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="admin/users"
          element={(
            <RequirePermission permission="users.read">
              <Suspense fallback={<div className="admin-page" aria-live="polite">Loading users…</div>}>
                <UsersPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="admin/departments"
          element={(
            <RequirePermission permission="departments.read">
              <Suspense fallback={<div className="admin-page" aria-live="polite">Loading departments…</div>}>
                <DepartmentsPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route
          path="admin/role-permissions"
          element={(
            <RequireRole role="SUPER_ADMIN">
              <Suspense fallback={<div className="admin-page" aria-live="polite">Loading role permissions…</div>}>
                <RolePermissionsPage />
              </Suspense>
            </RequireRole>
          )}
        />
        <Route
          path="audit-logs"
          element={(
            <RequirePermission permission="audit_logs.read">
              <Suspense fallback={<div className="audit-page" aria-live="polite">Loading audit logs…</div>}>
                <AuditLogsPage />
              </Suspense>
            </RequirePermission>
          )}
        />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
