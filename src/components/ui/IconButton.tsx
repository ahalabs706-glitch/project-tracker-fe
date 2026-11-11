import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  icon: ReactNode
  active?: boolean
}

export function IconButton({
  label,
  icon,
  active = false,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`icon-button ${active ? 'icon-button--active' : ''} ${className}`.trim()}
      title={label}
      type="button"
      {...props}
    >
      {icon}
    </button>
  )
}
