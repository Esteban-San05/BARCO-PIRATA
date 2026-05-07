import { useState, useMemo, useCallback } from 'react'
import { CalendarDays, Search, Download } from 'lucide-react'
import { useReservationStore } from '@app/store/reservationStore'
import { useReservationsByDate, useCancelReservation } from '@features/reservations/hooks/useReservations'
import { formatCurrency } from '@utils/formatters'
import { StatusBadge } from '@components/ui/Badge'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { Link } from 'react-router-dom'
import { PACKAGES } from '@constants/index'
import type { PackageId } from '@constants/index'
import { CalendarPicker } from '@components/ui/CalendarPicker'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'

type StatusFilter = 'all' | 'pendiente' | 'pagada' | 'cancelada'

export default function ReservationsPage() {
  const { selectedDate, setSelectedDate } = useReservationStore()
  const [calOpen, setCalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const { data, isLoading, isError, error } = useReservationsByDate(selectedDate)
  const { mutateAsync: cancelReservation } = useCancelReservation()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const reservations = data?.data ?? []

  const filtered = useMemo(() => {
    let list = reservations
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.contactName.toLowerCase().includes(q) ||
        r.contactPhone?.toLowerCase().includes(q)
      )
    }
    return list
  }, [reservations, statusFilter, search])

  // Métricas del footer
  const totalPersonas    = filtered.reduce((s, r) => s + r.totalPassengers, 0)
  const ingresosFiltrados = filtered
    .filter(r => r.status === 'pagada')
    .reduce((s, r) => s + r.total, 0)
  const pendientesCobro  = filtered
    .filter(r => r.status === 'pendiente' || r.status === 'confirmada')
    .reduce((s, r) => s + r.total, 0)

  const statusCounts = {
    pendiente: reservations.filter(r => r.status === 'pendiente').length,
    pagada:    reservations.filter(r => r.status === 'pagada').length,
    cancelada: reservations.filter(r => r.status === 'cancelada').length,
  }

  const statusChips: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all',       label: 'Todas' },
    { key: 'pendiente', label: 'Pendiente' },
    { key: 'pagada',    label: 'Pagada' },
    { key: 'cancelada', label: 'Cancelada' },
  ]

  const exportCSV = useCallback(() => {
    const headers = ['Nombre', 'Teléfono', 'Hora', 'Personas', 'Paquete', 'Subtotal', 'Descuento', 'Total', 'Estado', 'Método de Pago']
    const rows = filtered.map(r => {
      const pkg = PACKAGES[r.packageId as PackageId]
      return [r.contactName, r.contactPhone ?? '', r.time, r.totalPassengers, pkg?.label ?? r.packageId, r.subtotal, r.discount, r.total, r.status, r.paymentMethod ?? '']
    })
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `reservaciones-${selectedDate}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [filtered, selectedDate])

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap">
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
        <CalendarPicker value={selectedDate} onChange={setSelectedDate} isOpen={calOpen} onClose={() => setCalOpen(false)} adminMode />

        <div className="bp-status-chips flex-1">
          {statusChips.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`bp-status-chip${statusFilter === key ? ' active' : ''}`}
            >
              {label}
              <span className="bp-status-chip-count">
                {key === 'all' ? reservations.length : (statusCounts[key as keyof typeof statusCounts] ?? 0)}
              </span>
            </button>
          ))}
        </div>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar nombre o teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg border text-sm w-56 focus:outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-body)' }}
          />
        </div>
      </div>

      {/* Table card */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        {/* Error de cancelación */}
        {cancelError && (
          <div className="flex items-center justify-between px-5 py-3 text-sm" style={{ background: 'rgba(248,113,113,0.12)', borderBottom: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
            <span>{cancelError}</span>
            <button type="button" onClick={() => setCancelError(null)} className="ml-3 font-bold hover:opacity-70">✕</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-display font-bold text-sm tracking-wide" style={{ color: 'var(--text-title)' }}>
            {filtered.length} Reservaciones
          </span>
          <button
            type="button"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--text-body)', background: 'var(--bg-surface-alt)' }}
          >
            <Download size={13} />
            Exportar
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : isError ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: '#F87171' }}>
            Error al cargar reservaciones: {(error as Error)?.message ?? 'Error desconocido'}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            {reservations.length === 0 ? 'No hay reservaciones para esta fecha.' : 'No hay resultados con los filtros aplicados.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-surface-alt)' }}>
                <tr>
                  {[
                    { label: 'Nombre',   cls: '' },
                    { label: 'Hora',     cls: 'hidden sm:table-cell' },
                    { label: 'Personas', cls: 'hidden sm:table-cell' },
                    { label: 'Paquete',  cls: 'hidden md:table-cell' },
                    { label: 'Subtotal', cls: 'hidden md:table-cell' },
                    { label: 'Desc.',    cls: 'hidden lg:table-cell' },
                    { label: 'Total',    cls: '' },
                    { label: 'Estado',   cls: '' },
                    { label: 'Pago',     cls: 'hidden lg:table-cell' },
                    { label: 'Acción',   cls: '' },
                  ].map(({ label, cls }) => (
                    <th
                      key={label}
                      className={`px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider whitespace-nowrap ${cls}`}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const pkg = PACKAGES[r.packageId as PackageId]
                  return (
                    <tr
                      key={r.id}
                      className="transition-colors"
                      style={{ borderTop: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-alt)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-4 font-semibold" style={{ color: 'var(--text-title)' }}>{r.contactName}</td>
                      <td className="hidden sm:table-cell px-4 py-4 font-mono text-xs font-bold" style={{ color: 'var(--text-body)' }}>{r.time}</td>
                      <td className="hidden sm:table-cell px-4 py-4 text-center" style={{ color: 'var(--text-body)' }}>{r.totalPassengers}</td>
                      <td className="hidden md:table-cell px-4 py-4" style={{ color: 'var(--text-body)' }}>{pkg?.label ?? r.packageId.replace(/_/g, ' ')}</td>
                      <td className="hidden md:table-cell px-4 py-4 font-semibold" style={{ color: 'var(--accent)' }}>{formatCurrency(r.subtotal)}</td>
                      <td className="hidden lg:table-cell px-4 py-4 font-semibold" style={{ color: r.discount > 0 ? '#F87171' : 'var(--text-muted)' }}>
                        {r.discount > 0 ? `-${formatCurrency(r.discount)}` : '—'}
                      </td>
                      <td className="px-4 py-4 font-bold" style={{ color: 'var(--text-title)' }}>{formatCurrency(r.total)}</td>
                      <td className="px-4 py-4"><StatusBadge status={r.status} /></td>
                      <td className="hidden lg:table-cell px-4 py-4 capitalize" style={{ color: 'var(--text-muted)' }}>{r.paymentMethod ?? '—'}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/admin/venta/${r.id}`}
                            className="text-xs font-bold transition-opacity hover:opacity-70 whitespace-nowrap"
                            style={{ color: 'var(--accent)' }}
                          >
                            Gestionar
                          </Link>
                          {r.status !== 'cancelada' && r.status !== 'pagada' && (
                            confirmingId === r.id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>¿Cancelar?</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await cancelReservation(r.id)
                                      setConfirmingId(null)
                                      setCancelError(null)
                                    } catch (e) {
                                      setCancelError((e as Error)?.message ?? 'Error al cancelar')
                                      setConfirmingId(null)
                                    }
                                  }}
                                  className="text-xs font-bold text-red-400 hover:text-red-600 transition-colors"
                                >
                                  Sí
                                </button>
                                <span style={{ color: 'var(--border)' }}>·</span>
                                <button
                                  type="button"
                                  onClick={() => setConfirmingId(null)}
                                  className="text-xs font-bold transition-colors"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmingId(r.id)}
                                className="text-xs font-bold transition-colors hover:opacity-70 whitespace-nowrap"
                                style={{ color: '#f87171' }}
                              >
                                Cancelar
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Summary footer ── */}
        {filtered.length > 0 && !isLoading && (
          <div
            className="grid grid-cols-3"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface-alt)' }}
          >
            {/* Total Personas */}
            <div className="px-6 py-5" style={{ borderRight: '1px solid var(--border)' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                Total Personas
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-title)' }}>{totalPersonas}</p>
            </div>

            {/* Ingresos Filtrados */}
            <div className="px-6 py-5" style={{ borderRight: '1px solid var(--border)' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                Ingresos Filtrados
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{formatCurrency(ingresosFiltrados)}</p>
            </div>

            {/* Pendientes de Cobro */}
            <div className="px-6 py-5">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                Pendientes de Cobro
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-title)' }}>{formatCurrency(pendientesCobro)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
