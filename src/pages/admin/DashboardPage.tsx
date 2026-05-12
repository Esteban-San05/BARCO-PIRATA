import { useState } from 'react'
import { Users, CalendarCheck, DollarSign, TrendingUp, CalendarDays, Banknote, ArrowLeftRight, Baby } from 'lucide-react'
import { ClimaMarino } from '@components/ClimaMarino'
import { useReservationStore } from '@app/store/reservationStore'
import { useReservationsByDate } from '@features/reservations/hooks/useReservations'
import { formatCurrency } from '@utils/formatters'
import { StatusBadge } from '@components/ui/Badge'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { Link } from 'react-router-dom'
import { CalendarPicker } from '@components/ui/CalendarPicker'
import { BOAT_CAPACITY, PACKAGES } from '@constants/index'
import type { PackageId } from '@constants/index'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'

export default function DashboardPage() {
  const { selectedDate, setSelectedDate } = useReservationStore()
  const [calOpen, setCalOpen] = useState(false)
  const { data, isLoading, isError } = useReservationsByDate(selectedDate)

  const reservations = data?.data ?? []

  // ── KPI derivados ──────────────────────────────────────────────────────────
  const pagadas        = reservations.filter(r => r.status === 'pagada')
  const totalRevenue   = pagadas.reduce((s, r) => s + r.total, 0)
  const pagadasCount   = pagadas.length
  const payRate        = reservations.length ? Math.round((pagadasCount / reservations.length) * 100) : 0

  // Desglose de tripulación (totalPassengers incluye bebés para capacidad real)
  const totalPassengers = reservations.reduce((s, r) => s + r.totalPassengers, 0)
  const totalAdults     = reservations.reduce((s, r) => s + r.adults, 0)
  const totalYouth      = reservations.reduce((s, r) => s + r.youth, 0)
  const totalChildren   = reservations.reduce((s, r) => s + r.children, 0)
  const totalBabies     = reservations.reduce((s, r) => s + r.babies, 0)

  // Distribución por método de pago
  const efectivoCount      = reservations.filter(r => r.paymentMethod === 'efectivo').length
  const transferenciaCount = reservations.filter(r => r.paymentMethod === 'transferencia').length

  const dateLabel = format(
    parse(selectedDate, 'yyyy-MM-dd', new Date()),
    "d 'DE' MMMM', 'yyyy",
    { locale: es },
  ).toUpperCase()

  return (
    <div className="space-y-6">
      {/* Date picker */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors shadow-sm max-w-full"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-body)' }}
        >
          <CalendarDays className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span className="capitalize truncate">
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

      {/* ── KPI Grid ──────────────────────────────────────────────────────── */}
      <div className="bp-kpi-grid">
        <div className="bp-kpi-card visible" style={{ animationDelay: '0ms' }}>
          <div className="bp-kpi-icon"><CalendarCheck size={20} /></div>
          <div>
            <p className="bp-kpi-label">Reservaciones</p>
            <p className="bp-kpi-value">{reservations.length}</p>
            <p className="bp-kpi-hint">{pagadasCount} pagadas · {reservations.length - pagadasCount} pendientes</p>
          </div>
        </div>

        <div className="bp-kpi-card visible" style={{ animationDelay: '60ms' }}>
          <div className="bp-kpi-icon"><Users size={20} /></div>
          <div>
            <p className="bp-kpi-label">Tripulación del día</p>
            <p className="bp-kpi-value">{totalPassengers}</p>
            <p className="bp-kpi-hint">Cap. {BOAT_CAPACITY} por salida</p>
          </div>
        </div>

        <div className="bp-kpi-card bp-kpi-card--accent visible" style={{ animationDelay: '120ms' }}>
          <div className="bp-kpi-icon"><DollarSign size={20} /></div>
          <div>
            <p className="bp-kpi-label">Ingresos confirmados</p>
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

      {/* ── Desglose de tripulación + métodos de pago ─────────────────────── */}
      {reservations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Desglose por tipo de pasajero */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Desglose de tripulación
              </span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Adultos (18+)',       value: totalAdults,   color: 'var(--text-title)' },
                { label: 'Adolescentes (12-17)', value: totalYouth,    color: 'var(--text-title)' },
                { label: 'Niños (3-11)',         value: totalChildren, color: 'var(--text-title)' },
                { label: 'Bebés (gratis)',        value: totalBabies,  color: '#16a34a' },
              ].filter(row => row.value > 0).map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-body)' }}>
                    {row.label === 'Bebés (gratis)' && <Baby className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />}
                    {row.label}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-alt)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${totalPassengers > 0 ? Math.round((row.value / totalPassengers) * 100) : 0}%`,
                          background: row.label === 'Bebés (gratis)' ? '#16a34a' : 'var(--accent)',
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold w-6 text-right" style={{ color: row.color }}>{row.value}</span>
                  </div>
                </div>
              ))}
              {totalAdults === 0 && totalYouth === 0 && totalChildren === 0 && totalBabies === 0 && (
                <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
              )}
            </div>
          </div>

          {/* Distribución por método de pago */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Banknote className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Método de pago
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--text-body)' }}>
                  <Banknote className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Efectivo
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-alt)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${reservations.length > 0 ? Math.round((efectivoCount / reservations.length) * 100) : 0}%`,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold w-6 text-right" style={{ color: 'var(--text-title)' }}>{efectivoCount}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--text-body)' }}>
                  <ArrowLeftRight className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Transferencia
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-alt)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${reservations.length > 0 ? Math.round((transferenciaCount / reservations.length) * 100) : 0}%`,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold w-6 text-right" style={{ color: 'var(--text-title)' }}>{transferenciaCount}</span>
                </div>
              </div>
              {efectivoCount === 0 && transferenciaCount === 0 && (
                <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>
                  Sin pagos registrados
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Clima marino ─────────────────────────────────────────────────── */}
      <ClimaMarino fecha={selectedDate} />

      {/* ── Tabla de reservaciones ────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="bp-table-header">
          <span className="bp-table-title">Reservaciones — {dateLabel}</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {reservations.length} total
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : isError ? (
          <p className="text-center py-12 text-sm" style={{ color: '#F87171' }}>
            Error al cargar reservaciones. Intenta recargar la página.
          </p>
        ) : reservations.length === 0 ? (
          <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            No hay reservaciones para esta fecha.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-surface-alt)' }}>
                <tr>
                  {[
                    { label: 'Nombre',      cls: '' },
                    { label: 'Hora',        cls: 'hidden sm:table-cell' },
                    { label: 'Tripulación', cls: 'hidden sm:table-cell' },
                    { label: 'Paquete',     cls: 'hidden md:table-cell' },
                    { label: 'Total',       cls: '' },
                    { label: 'Estado',      cls: '' },
                    { label: 'Acción',      cls: '' },
                  ].map(({ label, cls }) => (
                    <th
                      key={label}
                      className={`px-5 py-3 text-left font-bold text-[11px] uppercase tracking-wider ${cls}`}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const pkg = PACKAGES[r.packageId as PackageId]
                  // Desglose corto de tripulación
                  const crewParts = [
                    r.adults   > 0 && `${r.adults}a`,
                    r.youth    > 0 && `${r.youth}adol`,
                    r.children > 0 && `${r.children}n`,
                    r.babies   > 0 && `${r.babies}🍼`,
                  ].filter(Boolean).join(' · ')

                  return (
                    <tr
                      key={r.id}
                      className="transition-colors"
                      style={{ borderTop: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-alt)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-5 py-4 font-semibold" style={{ color: 'var(--text-title)' }}>{r.contactName}</td>
                      <td className="hidden sm:table-cell px-5 py-4" style={{ color: 'var(--text-body)' }}>{r.time}</td>
                      <td className="hidden sm:table-cell px-5 py-4 text-xs" style={{ color: 'var(--text-body)' }}>
                        <span className="font-medium">{r.totalPassengers}</span>
                        {crewParts && (
                          <span className="ml-1.5" style={{ color: 'var(--text-muted)' }}>({crewParts})</span>
                        )}
                      </td>
                      <td className="hidden md:table-cell px-5 py-4" style={{ color: 'var(--text-body)' }}>
                        {r.packageBreakdown?.length
                          ? r.packageBreakdown.map(item => {
                              const p = PACKAGES[item.packageId as PackageId]
                              return `${p?.icon ?? ''} ${p?.label ?? item.packageId}`
                            }).join(' · ')
                          : pkg ? `${pkg.icon} ${pkg.label}` : r.packageId
                        }
                      </td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
