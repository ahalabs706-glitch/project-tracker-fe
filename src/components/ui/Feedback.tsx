import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

type FeedbackProps = {
  tone?: 'success' | 'warning' | 'error' | 'info'
  title?: string
  children: ReactNode
}

const icons = {
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
  info: Info,
}

export function Feedback({
  tone = 'info',
  title,
  children,
}: FeedbackProps) {
  const Icon = icons[tone]

  return (
    <div
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`feedback feedback--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="feedback__icon" size={16} aria-hidden="true" />
      <div className="feedback__content">
        {title && <p className="feedback__title">{title}</p>}
        <p className="feedback__message">{children}</p>
      </div>
    </div>
  )
}
