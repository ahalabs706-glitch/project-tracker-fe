import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../auth/AuthContext'
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.api'
import { NotificationsPage } from './NotificationsPage'
import type { Notification, NotificationPage } from './notifications.api'

vi.mock('./notifications.api', () => ({
  getUnreadNotificationCount: vi.fn(),
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}))

const notification: Notification = {
  id: 'notice-1',
  event_type: 'CONTRACT_EXPIRATION',
  title: 'Contract expiring soon',
  message: 'A contract requires your attention.',
  entity_type: 'CONTRACT',
  entity_id: 'contract-1',
  is_read: false,
  created_at: '2026-11-10T08:30:00Z',
}

const authValue: AuthContextValue = {
  status: 'authenticated',
  user: {
    id: 'user-1',
    full_name: 'Test User',
    email: 'test@example.com',
    department: null,
    roles: [],
    permissions: ['notifications.read', 'notifications.update', 'contracts.read'],
  },
  initializationError: null,
  login: vi.fn(),
  logout: vi.fn(),
  retryInitialization: vi.fn(),
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

function pageOf(items: Notification[], total = items.length): NotificationPage {
  return { items, page: 1, total, total_pages: total > 0 ? 1 : 0 }
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listNotifications).mockResolvedValue(pageOf([notification]))
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(1)
    vi.mocked(markNotificationRead).mockResolvedValue({ ...notification, is_read: true })
    vi.mocked(markAllNotificationsRead).mockResolvedValue({ updated: 1 })
  })

  afterEach(() => cleanup())

  it('renders notifications and links only to resources the user can read', async () => {
    renderPage()

    expect(await screen.findByText('Contract expiring soon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open contract' })).toHaveAttribute(
      'href',
      '/contracts/contract-1',
    )
    expect(screen.getByRole('region', { name: 'Notification summary' })).toHaveTextContent('1 unread')
  })

  it('marks a single unread notification and refreshes the list', async () => {
    renderPage()
    await screen.findByText('Contract expiring soon')

    fireEvent.click(screen.getByRole('button', { name: 'Mark “Contract expiring soon” as read' }))

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalled())
    expect(vi.mocked(markNotificationRead).mock.calls[0]?.[0]).toBe('notice-1')
    expect(await screen.findByText('Notification marked as read.')).toBeInTheDocument()
    expect(listNotifications).toHaveBeenCalledTimes(2)
  })

  it('marks all unread notifications as read', async () => {
    renderPage()
    await screen.findByText('Contract expiring soon')

    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }))

    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('1 notification marked as read.')).toBeInTheDocument()
  })

  it('renders an empty state without fabricating records', async () => {
    vi.mocked(listNotifications).mockResolvedValue(pageOf([]))
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(0)
    renderPage()

    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open contract' })).not.toBeInTheDocument()
  })

  it('surfaces a retry action when the notification API fails', async () => {
    vi.mocked(listNotifications).mockRejectedValueOnce(new Error('Network failed'))
    renderPage()

    expect(await screen.findByText('Notifications couldn’t be loaded')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Contract expiring soon')).toBeInTheDocument()
    expect(listNotifications).toHaveBeenCalledTimes(2)
  })

  it('announces the loading state while the list request is pending', () => {
    vi.mocked(listNotifications).mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByLabelText('Loading notifications')).toBeInTheDocument()
  })

  it('disables the mark-read action while its request is pending', async () => {
    let resolveRead: ((value: Notification) => void) | undefined
    vi.mocked(markNotificationRead).mockReturnValue(new Promise((resolve) => {
      resolveRead = resolve
    }))
    renderPage()
    await screen.findByText('Contract expiring soon')

    const markRead = screen.getByRole('button', { name: 'Mark “Contract expiring soon” as read' })
    fireEvent.click(markRead)
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledTimes(1))
    expect(markRead).toBeDisabled()
    fireEvent.click(markRead)
    expect(markNotificationRead).toHaveBeenCalledTimes(1)
    resolveRead?.({ ...notification, is_read: true })
    expect(await screen.findByText('Notification marked as read.')).toBeInTheDocument()
  })

  it('does not link to a resource without the matching read permission', async () => {
    vi.mocked(listNotifications).mockResolvedValue(pageOf([{
      ...notification,
      entity_type: 'PROJECT',
    }]))
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthContext.Provider value={{
          ...authValue,
          user: { ...authValue.user!, permissions: ['notifications.read'] },
        }}>
          <MemoryRouter><NotificationsPage /></MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Contract expiring soon')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open project' })).not.toBeInTheDocument()
  })
})
