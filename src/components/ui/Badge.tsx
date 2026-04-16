import { clsx } from 'clsx'
import type { ReservationStatus } from '@app-types/index'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  className?: string
}

// Semántica pirata: sólo 3 colores → navy · gold · pirate
const variantClasses = {
  success: 'bg-gold-100 text-gold-900 border border-gold-300',   // oro conseguido = pagada
  warning: 'bg-gold-50  text-gold-800 border border-gold-200',   // amarillo claro = pendiente
  danger:  'bg-pirate-100 text-pirate-800 border border-pirate-300', // rojo = cancelada
  info:    'bg-navy-100 text-navy-900 border border-navy-300',   // azul = confirmada
  neutral: 'bg-navy-50 text-navy-700 border border-navy-200',
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span className={clsx('badge', variantClasses[variant], className)}>
      {children}
    </span>
  )
}

// Mapa rápido de estados de reservación → variante de badge
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
