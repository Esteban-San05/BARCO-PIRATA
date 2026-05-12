import { useState, useMemo, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { CalendarDays, Download, ClipboardList, CheckCircle2, AlertTriangle, Users } from 'lucide-react'
import { usePassengersByDate } from '@features/passengers/hooks/usePassengers'
import { useBusinessSettings } from '@features/settings/hooks/useBusinessSettings'
import { CalendarPicker } from '@components/ui/CalendarPicker'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import type { PassengerType } from '@app-types/index'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const localToday = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

const TYPE_LABEL: Record<PassengerType, string> = {
  adult: 'Adulto',
  youth: 'Adolescente',
  child: 'Niño',
  baby:  'Bebé',
}

const TYPE_COLOR: Record<PassengerType, string> = {
  adult: 'bg-navy-100 text-navy-700',
  youth: 'bg-blue-100 text-blue-700',
  child: 'bg-green-100 text-green-700',
  baby:  'bg-purple-100 text-purple-700',
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ManifiestosPage() {
  const [selectedDate, setSelectedDate] = useState(localToday)
  const [calOpen, setCalOpen]           = useState(false)
  const [timeFilter, setTimeFilter]     = useState<string>('all')

  const { data: passengers, isLoading, isError } = usePassengersByDate(selectedDate)
  const { data: settings }                        = useBusinessSettings()

  const timeSlots = settings?.activeTimeSlots ?? []

  // Aplicar filtro de horario
  const filtered = useMemo(() => {
    if (!passengers) return []
    if (timeFilter === 'all') return passengers
    return passengers.filter(p => p.reservationTime === timeFilter)
  }, [passengers, timeFilter])

  // Métricas
  const total    = filtered.length
  const complete = filtered.filter(p => p.fullName && p.fullName.trim() !== '' && p.age != null).length
  const percent  = total === 0 ? 100 : Math.round((complete / total) * 100)

  const progressColor =
    percent === 100 ? '#16a34a' :
    percent === 0   ? '#f87171' : '#d97706'

  // Export Excel
  const handleExport = useCallback(() => {
    if (filtered.length === 0) return

    const rows = filtered.map((p, i) => ({
      '#':       i + 1,
      'Nombre':  p.fullName ?? '',
      'Edad':    p.age ?? '',
      'Tipo':    TYPE_LABEL[p.passengerType],
      'Horario': p.reservationTime,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)

    // Ancho de columnas
    ws['!cols'] = [
      { wch: 5  },
      { wch: 32 },
      { wch: 8  },
      { wch: 14 },
      { wch: 10 },
    ]

    const wb = XLSX.utils.book_new()
    const sheetName = `Manifiesto ${selectedDate}`
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `manifiesto_${selectedDate}${timeFilter !== 'all' ? `_${timeFilter.replace(':', '')}` : ''}.xlsx`)
  }, [filtered, selectedDate, timeFilter])

  const dateLabel = format(
    parse(selectedDate, 'yyyy-MM-dd', new Date()),
    "d 'de' MMMM yyyy",
    { locale: es },
  )

  return (
    <div className="space-y-5">

      {/* ── Barra de filtros ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Fecha */}
        <button
          type="button"
          onClick={() => setCalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors shadow-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-body)' }}
        >
          <CalendarDays className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span className="capitalize">{dateLabel}</span>
        </button>
        <CalendarPicker
          value={selectedDate}
          onChange={(d) => { setSelectedDate(d); setTimeFilter('all') }}
          isOpen={calOpen}
          onClose={() => setCalOpen(false)}
          adminMode
        />

        {/* Horario */}
        {timeSlots.length > 0 && (
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm font-medium"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-body)' }}
          >
            <option value="all">Todos los horarios</option>
            {timeSlots.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export */}
        <button
          type="button"
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-alt)', color: 'var(--text-body)' }}
        >
          <Download className="w-4 h-4" />
          Exportar Excel
        </button>
      </div>

      {/* ── Tarjeta de resumen ─────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-3 rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="px-5 py-4" style={{ borderRight: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Pasajeros
            </p>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-title)' }}>{total}</p>
        </div>

        <div className="px-5 py-4" style={{ borderRight: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Completos
            </p>
          </div>
          <p className="text-2xl font-bold text-green-500">{complete}</p>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Completado
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-alt)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${percent}%`, background: progressColor }}
              />
            </div>
            <span className="text-sm font-bold w-10 text-right" style={{ color: progressColor }}>
              {percent}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabla de pasajeros ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="font-display font-bold text-sm tracking-wide" style={{ color: 'var(--text-title)' }}>
            Lista de pasajeros — {dateLabel}
            {timeFilter !== 'all' && ` · ${timeFilter}`}
          </span>
          {total > 0 && (
            <span className="text-xs font-semibold" style={{ color: complete === total ? '#16a34a' : '#d97706' }}>
              {complete === total
                ? '✓ Manifiesto completo'
                : `${total - complete} faltante${total - complete !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : isError ? (
          <p className="text-center py-16 text-sm" style={{ color: '#f87171' }}>
            Error al cargar pasajeros. Intenta recargar.
          </p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ClipboardList className="w-10 h-10" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {(passengers?.length ?? 0) === 0
                ? 'No hay manifiestos guardados para esta fecha.'
                : 'Ninguna reservación coincide con el horario seleccionado.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-surface-alt)' }}>
                <tr>
                  {[
                    { label: '#',        cls: 'w-12' },
                    { label: 'Horario',  cls: 'hidden sm:table-cell' },
                    { label: 'Nombre',   cls: '' },
                    { label: 'Edad',     cls: '' },
                    { label: 'Tipo',     cls: 'hidden sm:table-cell' },
                    { label: 'Estado',   cls: '' },
                  ].map(({ label, cls }) => (
                    <th
                      key={label}
                      className={`px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider ${cls}`}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const isDone = !!(p.fullName && p.fullName.trim() !== '' && p.age != null)

                  return (
                    <tr
                      key={p.id}
                      className="transition-colors"
                      style={{ borderTop: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-alt)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {i + 1}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 font-mono text-xs font-bold" style={{ color: 'var(--text-body)' }}>
                        {p.reservationTime}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: p.fullName ? 'var(--text-title)' : 'var(--text-muted)' }}>
                        {p.fullName || <span className="italic">Sin nombre</span>}
                      </td>
                      <td className="px-4 py-3" style={{ color: p.age != null ? 'var(--text-body)' : 'var(--text-muted)' }}>
                        {p.age != null ? `${p.age} años` : <span className="italic">—</span>}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLOR[p.passengerType]}`}>
                          {TYPE_LABEL[p.passengerType]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Completo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#d97706' }}>
                            <AlertTriangle className="w-3.5 h-3.5" /> Incompleto
                          </span>
                        )}
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
