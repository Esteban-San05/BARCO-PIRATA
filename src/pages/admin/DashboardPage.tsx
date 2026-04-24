import { useState } from 'react'
import { Users, CalendarCheck, DollarSign, TrendingUp, CalendarDays } from 'lucide-react'
import { ClimaMarino } from '@components/ClimaMarino'
import { useReservationStore } from '@app/store/reservationStore'
import { useReservationsByDate } from '@features/reservations/hooks/useReservations'
import { formatCurrency } from '@utils/formatters'
import { StatusBadge } from '@components/ui/Badge'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { Link } from 'react-router-dom'
import { Button } from '@components/ui/Button'
import { CalendarPicker } from '@components/ui/CalendarPicker'
import { BOAT_CAPACITY } from '@constants/index'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'

export default function DashboardPage() {
  const { selectedDate, setSelectedDate } = useReservationStore()
  const [calOpen, setCalOpen] = useState(false)
  const { data, isLoading } = useReservationsByDate(selectedDate)

  const reservations = data?.data ?? []
  const totalRevenue = reservations
    .filter((r) => r.status === 'pagada')
    .reduce((sum, r) => sum + r.total, 0)
  const totalPeople    = reservations.reduce((sum, r) => sum + r.numberOfPeople, 0)
  const pagadasCount   = reservations.filter(r => r.status === 'pagada').length
  const payRate        = reservations.length
    ? Math.round((pagadasCount / reservations.length) * 100)
    : 0

  const dateLabel = format(
    parse(selectedDate, 'yyyy-MM-dd', new Date()),
    "d 'DE' MMMM', 'yyyy",
    { locale: es },
  ).toUpperCase()

  return (
    <div className="space-y-6">
      {/* Date picker row */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors shadow-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-body)' }}
        >
          <CalendarDays className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <span className="capitalize">
            {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), "d 'de' MMMM yyyy", { locale: es })}
          </span>
        </button>
        <CalendarPicker
          value={selectedDate}
          onChange={setSelectedDate}
          isOpen={calOpen}
          onClose={() => setCalOpen(false)}
          adminMode
        />
      </div>

      {/* KPI Grid */}
      <div className="bp-kpi-grid">
        <div className="bp-kpi-card visible" style={{ animationDelay: '0ms' }}>
          <div className="bp-kpi-icon"><CalendarCheck size={20} /></div>
          <div>
            <p className="bp-kpi-label">Reservaciones hoy</p>
            <p className="bp-kpi-value">{reservations.length}</p>
            <p className="bp-kpi-hint">{pagadasCount} pagadas</p>
          </div>
        </div>

        <div className="bp-kpi-card visible" style={{ animationDelay: '60ms' }}>
          <div className="bp-kpi-icon"><Users size={20} /></div>
          <div>
            <p className="bp-kpi-label">Personas embarcadas</p>
            <p className="bp-kpi-value">{totalPeople}</p>
            <p className="bp-kpi-hint">Capacidad: {BOAT_CAPACITY} por salida</p>
          </div>
        </div>

        <div className="bp-kpi-card bp-kpi-card--accent visible" style={{ animationDelay: '120ms' }}>
          <div className="bp-kpi-icon"><DollarSign size={20} /></div>
          <div>
            <p className="bp-kpi-label">Ingresos del día</p>
            <p className="bp-kpi-value">{formatCurrency(totalRevenue)}</p>
            <p className="bp-kpi-hint">Solo reservas pagadas</p>
          </div>
        </div>

        <div className="bp-kpi-card visible" style={{ animationDelay: '180ms' }}>
          <div className="bp-kpi-icon"><TrendingUp size={20} /></div>
          <div>
            <p className="bp-kpi-label">Tasa de pago</p>
            <p className="bp-kpi-value">{payRate}%</p>
            <p className="bp-kpi-hint">Reservas cobradas</p>
          </div>
        </div>
      </div>

      {/* Clima marino */}
      <ClimaMarino fecha={selectedDate} />

      {/* Tabla de reservaciones */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="bp-table-header">
          <span className="bp-table-title">
            Reservaciones — {dateLabel}
          </span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {reservations.length} total
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : reservations.length === 0 ? (
          <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            No hay reservaciones para esta fecha.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-surface-alt)' }}>
                <tr>
                  {['Nombre', 'Hora', 'Personas', 'Paquete', 'Total', 'Estado', 'Acción'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left font-bold text-[11px] uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors"
                    style={{ borderTop: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-alt)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-5 py-4 font-semibold" style={{ color: 'var(--text-title)' }}>{r.contactName}</td>
                    <td className="px-5 py-4" style={{ color: 'var(--text-body)' }}>{r.time}</td>
                    <td className="px-5 py-4 text-center" style={{ color: 'var(--text-body)' }}>{r.numberOfPeople}</td>
                    <td className="px-5 py-4" style={{ color: 'var(--text-body)' }}>{r.packageId.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-4 font-bold" style={{ color: 'var(--accent)' }}>{formatCurrency(r.total)}</td>
                    <td className="px-5 py-4"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-4">
                      <Link
                        to={`/admin/venta/${r.id}`}
                        className="text-sm font-semibold transition-opacity hover:opacity-70"
                        style={{ color: 'var(--accent)' }}
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
