import { clsx } from 'clsx'
import type { ReservationStatus } from '@app-types/index'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  className?: string
}

// Pill styles using inline CSS variables — look great in both light and dark mode
const variantStyles: Record<NonNullable<BadgeProps['variant']>, React.CSSProperties> = {
  success: {
    background: 'rgba(240,180,41,0.15)',
    color: '#F0B429',
    border: '1px solid rgba(240,180,41,0.35)',
  },
  warning: {
    background: 'rgba(234,179,8,0.15)',
    color: '#EAB308',
    border: '1px solid rgba(234,179,8,0.35)',
  },
  danger: {
    background: 'rgba(220,38,38,0.15)',
    color: '#F87171',
    border: '1px solid rgba(220,38,38,0.35)',
  },
  info: {
    background: 'rgba(59,130,246,0.15)',
    color: '#60A5FA',
    border: '1px solid rgba(59,130,246,0.35)',
  },
  neutral: {
    background: 'rgba(107,133,166,0.15)',
    color: 'var(--text-muted)',
    border: '1px solid rgba(107,133,166,0.25)',
  },
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={clsx('inline-flex items-center px-3 py-1 rounded-full text-xs font-bold', className)}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  )
}

const statusVariantMap: Record<ReservationStatus, BadgeProps['variant']> = {
  pendiente:  'warning',
  confirmada: 'info',
  pagada:     'success',
  cancelada:  'danger',
}

const statusLabels: Record<ReservationStatus, string> = {
  pendiente:  'Pendiente',
  confirmada: 'Confirmada',
  pagada:     'Pagada',
  cancelada:  'Cancelada',
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <Badge variant={statusVariantMap[status]}>
      {statusLabels[status]}
    </Badge>
  )
}
