import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../../api/errors'
import { Button, EmptyState, Feedback } from '../../components/ui'
import { useAuth } from '../auth/AuthContext'
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from './notifications.api'
import './notifications.css'

const pageSize = 20

function notificationDestination(notification: Notification, permissions: readonly string[]) {
  if (!notification.entity_id || !notification.entity_type) return null

  switch (notification.entity_type.toUpperCase()) {
    case 'PROJECT':
      return permissions.includes('projects.read')
        ? { path: `/projects/${notification.entity_id}`, label: 'Open project' }
        : null
    case 'CONTRACT':
      return permissions.includes('contracts.read')
        ? { path: `/contracts/${notification.entity_id}`, label: 'Open contract' }
        : null
    case 'TASK':
      return permissions.includes('tasks.read')
        ? { path: `/tasks/${notification.entity_id}`, label: 'Open task' }
        : null
    case 'MILESTONE':
      return permissions.includes('milestones.read')
        ? { path: `/milestones/${notification.entity_id}`, label: 'Open milestone' }
        : null
    case 'BUDGET':
    case 'BUDGET_ALLOCATION':
      return permissions.includes('budgets.read')
        ? { path: '/budgets', label: 'Open budget' }
        : null
    case 'BUDGET_TRANSACTION':
      return permissions.includes('budget_transactions.read')
        ? { path: '/budgets/transactions', label: 'Open transactions' }
        : null
    default:
      return null
  }
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function NotificationsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const permissions = user?.permissions ?? []
  const [page, setPage] = useState(1)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const listQuery = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => listNotifications(page, pageSize),
  })
  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 60_000,
  })
  const invalidateNotifications = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  ])
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      setActionMessage('Notification marked as read.')
      await invalidateNotifications()
    },
  })
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async ({ updated }) => {
      setActionMessage(updated === 1 ? '1 notification marked as read.' : `${updated} notifications marked as read.`)
      await invalidateNotifications()
    },
  })
  const notifications = listQuery.data?.items ?? []
  const unreadCount = unreadQuery.data ?? 0

  return (
    <main className="notifications-page">
      <header className="notifications-heading">
        <div>
          <p className="notifications-eyebrow">YOUR WORKSPACE</p>
          <h2>Notifications</h2>
          <p>Updates about projects and work items you can access.</p>
        </div>
        {permissions.includes('notifications.update') && unreadCount > 0 && (
          <Button
            disabled={markAllMutation.isPending || markReadMutation.isPending}
            onClick={() => {
              setActionMessage(null)
              markAllMutation.mutate()
            }}
            variant="secondary"
          >
            <Check size={15} />
            {markAllMutation.isPending ? 'Marking…' : 'Mark all as read'}
          </Button>
        )}
      </header>

      <section aria-label="Notification summary" className="notifications-summary">
        <div><Bell size={17} aria-hidden="true" /><span><strong>{unreadCount}</strong> unread</span></div>
        <span>{listQuery.data?.total ?? 0} total notifications</span>
      </section>

      {actionMessage && <Feedback tone="success">{actionMessage}</Feedback>}
      {markReadMutation.isError && (
        <Feedback tone="error" title="Notification could not be updated">
          {getErrorMessage(markReadMutation.error)}
        </Feedback>
      )}
      {markAllMutation.isError && (
        <Feedback tone="error" title="Notifications could not be updated">
          {getErrorMessage(markAllMutation.error)}
        </Feedback>
      )}
      {unreadQuery.isError && (
        <Feedback tone="error" title="Unread count couldn’t be loaded">
          {getErrorMessage(unreadQuery.error)}
        </Feedback>
      )}
      {listQuery.isError ? (
        <section className="notifications-panel">
          <Feedback tone="error" title="Notifications couldn’t be loaded">
            {getErrorMessage(listQuery.error)}
          </Feedback>
          <Button onClick={() => void listQuery.refetch()} variant="secondary">
            <RefreshCw size={15} /> Try again
          </Button>
        </section>
      ) : listQuery.isPending ? (
        <div aria-label="Loading notifications" aria-live="polite" className="notifications-loading">
          <span /><span /><span />
        </div>
      ) : notifications.length === 0 ? (
        <section className="notifications-panel">
          <EmptyState
            icon={<Bell size={20} />}
            title={page === 1 ? 'You’re all caught up' : 'No more notifications'}
            description={page === 1 ? 'New updates for your workspace will appear here.' : 'Go back to the previous page to see older updates.'}
            action={page > 1 ? <Button onClick={() => setPage((current) => current - 1)} variant="secondary">Previous page</Button> : undefined}
          />
        </section>
      ) : (
        <section aria-label="Notification list" className="notifications-panel">
          <ul className="notifications-list">
            {notifications.map((notification) => {
              const destination = notificationDestination(notification, permissions)
              return (
                <li className={`notification-item ${notification.is_read ? '' : 'notification-item--unread'}`} key={notification.id}>
                  <span aria-hidden="true" className="notification-item__marker" />
                  <div className="notification-item__body">
                    <div className="notification-item__title">
                      <h3>{notification.title}</h3>
                      {!notification.is_read && <span className="notification-item__unread">Unread</span>}
                    </div>
                    <p>{notification.message}</p>
                    <time dateTime={notification.created_at}>{formatNotificationDate(notification.created_at)}</time>
                    {destination && <Link className="notification-item__link" to={destination.path}>{destination.label}</Link>}
                  </div>
                  {!notification.is_read && permissions.includes('notifications.update') && (
                    <Button
                      aria-label={`Mark “${notification.title}” as read`}
                      disabled={markReadMutation.isPending || markAllMutation.isPending}
                      onClick={() => {
                        setActionMessage(null)
                        markReadMutation.mutate(notification.id)
                      }}
                      size="small"
                      variant="secondary"
                    >
                      <Check size={14} /> Mark read
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          <nav aria-label="Notification pages" className="notifications-pagination">
            <span>Page {page} of {Math.max(listQuery.data?.total_pages ?? 1, 1)}</span>
            <div>
              <Button
                disabled={page <= 1 || listQuery.isFetching}
                onClick={() => setPage((current) => current - 1)}
                size="small"
                variant="secondary"
              >
                <ChevronLeft size={15} /> Previous
              </Button>
              <Button
                disabled={!listQuery.data?.total_pages || page >= listQuery.data.total_pages || listQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
                size="small"
                variant="secondary"
              >
                Next <ChevronRight size={15} />
              </Button>
            </div>
          </nav>
        </section>
      )}
    </main>
  )
}
