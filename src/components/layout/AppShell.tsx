import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Button, Dialog, IconButton, StatusBadge } from '../ui'
import { useAuth } from '../../features/auth/AuthContext'
import { getUnreadNotificationCount } from '../../features/notifications/notifications.api'
import '../../features/notifications/notifications.css'

type NavigationItem = {
  id: string
  label: string
  icon: LucideIcon
  path: string
  permission?: string
  role?: string
}

type NavigationGroup = {
  label: string
  items: NavigationItem[]
}

const dashboardItem: NavigationItem = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
  path: '/',
  permission: 'dashboard.read',
}

const navigationGroups: NavigationGroup[] = [
  {
    label: 'Project management',
    items: [
      { id: 'projects', label: 'Projects', icon: FolderKanban, path: '/projects', permission: 'projects.read' },
      { id: 'my-tasks', label: 'My tasks', icon: ListTodo, path: '/my-tasks', permission: 'tasks.read' },
      { id: 'milestones', label: 'Milestones', icon: CalendarDays, path: '/milestones', permission: 'milestones.read' },
    ],
  },
  {
    label: 'Contract management',
    items: [
      { id: 'contracts', label: 'Contracts', icon: FileText, path: '/contracts', permission: 'contracts.read' },
      { id: 'expiring-contracts', label: 'Expiring contracts', icon: BriefcaseBusiness, path: '/contracts/expiring', permission: 'contracts.read' },
    ],
  },
  {
    label: 'Financial',
    items: [
      { id: 'budgets', label: 'Budget overview', icon: Wallet, path: '/budgets', permission: 'budgets.read' },
      {
        id: 'transactions',
        label: 'Transactions',
        icon: Wallet,
        path: '/budgets/transactions',
        permission: 'budget_transactions.read',
      },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell, path: '/notifications', permission: 'notifications.read' },
      { id: 'users', label: 'User management', icon: Building2, path: '/admin/users', permission: 'users.read' },
      { id: 'departments', label: 'Departments', icon: Building2, path: '/admin/departments', permission: 'departments.read' },
      { id: 'role-permissions', label: 'Role permissions', icon: ShieldCheck, path: '/admin/role-permissions', role: 'SUPER_ADMIN' },
      { id: 'audit-logs', label: 'Audit logs', icon: ChartNoAxesCombined, path: '/audit-logs', permission: 'audit_logs.read' },
    ],
  },
]

type AppShellProps = {
  permissions?: readonly string[]
}

export function AppShell({ permissions }: AppShellProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const allItems = useMemo(
    () => [dashboardItem, ...navigationGroups.flatMap((group) => group.items)],
    [],
  )
  const activeItem =
    [...allItems]
      .sort((left, right) => right.path.length - left.path.length)
      .find(
        (item) =>
          location.pathname === item.path ||
          (item.path !== '/' && location.pathname.startsWith(`${item.path}/`)),
      ) ?? dashboardItem
  const userPermissions = permissions ?? user?.permissions
  const unreadNotificationsQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
    enabled: Boolean(userPermissions?.includes('notifications.read')),
    refetchInterval: 60_000,
  })

  const visibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              (!item.role || user?.roles.includes(item.role)) &&
              (!userPermissions || !item.permission || userPermissions.includes(item.permission)),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [userPermissions, user?.roles],
  )
  const visibleActiveItem =
    userPermissions &&
    activeItem.permission &&
    !userPermissions.includes(activeItem.permission)
      ? dashboardItem
      : activeItem
  const accountRole = user?.roles.includes('SUPER_ADMIN')
    ? 'Super Admin'
    : user?.roles.includes('ADMIN')
      ? 'Admin'
      : user?.roles[0]?.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') ?? 'Member'

  useEffect(() => {
    if (!profileOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setProfileOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileOpen])

  const selectItem = (item: NavigationItem) => {
    navigate(item.path)
    setSidebarOpen(false)
  }

  const handleLogout = async () => {
    setProfileOpen(false)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      navigate('/login', {
        replace: true,
        state: {
          notice:
            'You were signed out on this device, but the server could not confirm the logout.',
        },
      })
    }
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <a className="sidebar__brand" href="/" aria-label="ProjectFlow home">
          <span className="sidebar__brand-mark" aria-hidden="true">
            P
          </span>
          <span>ProjectFlow</span>
        </a>

        <nav aria-label="Main navigation" className="sidebar__nav">
          {(!userPermissions ||
            !dashboardItem.permission ||
            userPermissions.includes(dashboardItem.permission)) && (
            <NavButton
              item={dashboardItem}
              active={visibleActiveItem.id === dashboardItem.id}
              onSelect={selectItem}
            />
          )}
          {visibleGroups.map((group) => (
            <section aria-label={group.label} className="nav-group" key={group.label}>
              <h2 className="nav-group__heading">{group.label}</h2>
              {group.items.map((item) => (
                <NavButton
                  active={visibleActiveItem.id === item.id}
                  item={item}
                  key={item.id}
                  onSelect={selectItem}
                />
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="workspace-card">
            <span className="workspace-card__mark" aria-hidden="true">
              PF
            </span>
            <div className="workspace-card__copy">
              <span className="workspace-card__label">Workspace</span>
              <span className="workspace-card__name">ProjectFlow</span>
            </div>
            <ChevronDown size={15} aria-hidden="true" />
          </div>
        </div>
      </aside>

      <div className="app-shell__main">
        <header className="topbar">
          <IconButton
            className="topbar__menu"
            icon={<Menu size={19} aria-hidden="true" />}
            label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          />
          <div aria-label="Breadcrumb" className="breadcrumbs">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <strong>{visibleActiveItem.label}</strong>
          </div>

          <div className="topbar__actions">
            <label className="global-search">
              <Search size={16} aria-hidden="true" />
              <input aria-label="Search workspace" placeholder="Search anything..." type="search" />
            </label>
            <IconButton
              icon={<CircleHelp size={18} aria-hidden="true" />}
              label="Help"
              onClick={() => setHelpOpen(true)}
            />
            {(!userPermissions || userPermissions.includes('notifications.read')) && (
              <IconButton
                icon={(
                  <span className="notification-bell">
                    <Bell size={18} aria-hidden="true" />
                    {unreadNotificationsQuery.isError ? (
                      <span aria-hidden="true" className="notification-bell__count notification-bell__count--error">!</span>
                    ) : unreadNotificationsQuery.data ? (
                      <span aria-hidden="true" className="notification-bell__count">
                        {unreadNotificationsQuery.data > 99 ? '99+' : unreadNotificationsQuery.data}
                      </span>
                    ) : null}
                  </span>
                )}
                label={unreadNotificationsQuery.isError
                  ? 'Notifications (unread count unavailable)'
                  : `Notifications${unreadNotificationsQuery.data ? `, ${unreadNotificationsQuery.data} unread` : ''}`}
                onClick={() =>
                  selectItem({
                    id: 'notifications',
                    label: 'Notifications',
                    icon: Bell,
                    path: '/notifications',
                    permission: 'notifications.read',
                  })
                }
              />
            )}
            <div className="profile-menu" ref={profileMenuRef}>
              <button
                aria-label={`Account: ${user?.full_name ?? 'Profile'}`}
                aria-controls="profile-menu-panel"
                aria-expanded={profileOpen}
                className="profile-menu__trigger"
                onClick={() => setProfileOpen((open) => !open)}
                type="button"
              >
                <span aria-hidden="true" className="avatar">{user?.full_name.trim().charAt(0).toUpperCase() || 'M'}</span>
                <span className="profile-menu__name">{accountRole}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {profileOpen && (
                <div className="profile-menu__popover" id="profile-menu-panel">
                  <p className="profile-menu__title">{user?.full_name}</p>
                  <p className="profile-menu__description">{user?.email}</p>
                  {user?.roles.map((role) => (
                    <StatusBadge key={role} tone="info">
                      {role.replaceAll('_', ' ')}
                    </StatusBadge>
                  ))}
                  <Button
                    className="profile-menu__action"
                    onClick={() => void handleLogout()}
                    size="small"
                    variant="secondary"
                  >
                    <LogOut size={14} aria-hidden="true" />
                    Sign out
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page-content">
          <div className="page-heading">
            <div>
              <div className="page-heading__eyebrow">
                <span>Workspace</span>
              </div>
              <h1>{visibleActiveItem.label}</h1>
              <p>
                {visibleActiveItem.id === 'dashboard'
                  ? 'A clear view of your projects, contracts, timelines, and budgets.'
                  : visibleActiveItem.id === 'projects'
                    ? 'Review project delivery, assignments, progress, and budget summaries.'
                    : visibleActiveItem.id === 'notifications'
                      ? 'Review updates and follow them to resources available to your account.'
                      : visibleActiveItem.id === 'users' || visibleActiveItem.id === 'departments'
                        ? 'Manage workspace access and department organization.'
                        : visibleActiveItem.id === 'role-permissions'
                          ? 'Configure global permissions by system role.'
                          : visibleActiveItem.id === 'audit-logs'
                            ? 'Review recorded system changes and activity.'
                        : `Your ${visibleActiveItem.label.toLowerCase()} workspace will be available in its development stage.`}
              </p>
            </div>
            <Button
              onClick={() => setHelpOpen(true)}
              variant="secondary"
            >
              <CircleHelp size={15} aria-hidden="true" />
              Getting started
            </Button>
          </div>

          <section aria-label={`${visibleActiveItem.label} overview`} className="content-card">
            <Outlet />
          </section>

          <footer className="page-footer">
            <span>ProjectFlow</span>
            <span>Project &amp; contract management</span>
          </footer>
        </main>
      </div>

      <Dialog
        description="ProjectFlow keeps project delivery, contracts, timelines, and budgets in one workspace."
        onClose={() => setHelpOpen(false)}
        open={helpOpen}
        title="Welcome to ProjectFlow"
      >
        <p className="help-dialog__copy">
          You’re signed in to your ProjectFlow workspace. Project and dashboard information
          is loaded from the services available to your account.
        </p>
        <div className="help-dialog__footer">
          <StatusBadge tone="success">FE-03 · Authentication ready</StatusBadge>
          <Button onClick={() => setHelpOpen(false)}>Got it</Button>
        </div>
      </Dialog>
    </div>
  )
}

type NavButtonProps = {
  item: NavigationItem
  active: boolean
  onSelect: (item: NavigationItem) => void
}

function NavButton({ item, active, onSelect }: NavButtonProps) {
  const Icon = item.icon

  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={`nav-item ${active ? 'nav-item--active' : ''}`}
      onClick={() => onSelect(item)}
      type="button"
    >
      <Icon size={17} aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  )
}
