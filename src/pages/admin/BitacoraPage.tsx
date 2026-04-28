import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, RefreshCw, Activity, X } from 'lucide-react'
import { supabase } from '@lib/supabase'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id:         string
  action:     string
  table_name: string | null
  user_email: string | null
  created_at: string
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchAuditLog(): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, table_name, user_email, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatFecha(iso: string) {
  return format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es })
}
function formatHora(iso: string) {
  return format(parseISO(iso), 'HH:mm:ss')
}

const TABLE_LABELS: Record<string, string> = {
  reservations: 'Reservaciones',
  payments:     'Pagos',
  auth:         'Acceso',
  business_settings: 'Configuración',
}

const ACTION_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  LOGIN:  { label: 'Login',      bg: 'rgba(247,201,72,0.15)',  color: '#F7C948' },
  INSERT: { label: 'Nuevo',      bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
  UPDATE: { label: 'Edición',    bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa' },
  CANCEL: { label: 'Cancelación',bg: 'rgba(251,146,60,0.15)', color: '#fb923c' },
  DELETE: { label: 'Eliminar',   bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
}

function ActionBadge({ action }: { action: string }) {
  const s = ACTION_STYLE[action] ?? { label: action, bg: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }
  return (
    <span
      className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function BitacoraPage() {
  const { data: logs, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['auditLog'],
    queryFn:  fetchAuditLog,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [filterAction, setFilterAction] = useState<string>('')
  const [filterTable,  setFilterTable]  = useState<string>('')

  const filtered = useMemo(() => {
    if (!logs) return []
    return logs.filter((e) => {
      if (filterAction && e.action     !== filterAction) return false
      if (filterTable  && e.table_name !== filterTable)  return false
      return true
    })
  }, [logs, filterAction, filterTable])

  const hasFilters = filterAction || filterTable
  const clearFilters = () => { setFilterAction(''); setFilterTable('') }

  // Opciones únicas de tabla presentes en los datos
  const tableOptions = useMemo(() =>
    [...new Set((logs ?? []).map((e) => e.table_name).filter(Boolean))] as string[]
  , [logs])

  // Contadores por tipo de acción (sobre datos originales, no filtrados)
  const counts = logs?.reduce<Record<string, number>>((acc, e) => {
    acc[e.action] = (acc[e.action] ?? 0) + 1
    return acc
  }, {}) ?? {}

  return (
    <div className="space-y-5">

      {/* Descripción */}
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Registro de actividad del sistema: accesos, reservaciones y pagos.
      </p>

      {/* Tarjetas resumen */}
      {logs && logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(ACTION_STYLE).filter(([key]) => key !== 'DELETE').map(([key, s]) => (
            <div
              key={key}
              className="rounded-xl px-4 py-3 flex flex-col gap-0.5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</span>
              <span className="text-2xl font-display font-bold" style={{ color: 'var(--text-title)' }}>
                {counts[key] ?? 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      {logs && logs.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border outline-none cursor-pointer"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-body)' }}
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_STYLE).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>

          <select
            value={filterTable}
            onChange={(e) => setFilterTable(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border outline-none cursor-pointer"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-body)' }}
          >
            <option value="">Todas las tablas</option>
            {tableOptions.map((t) => (
              <option key={t} value={t}>{TABLE_LABELS[t] ?? t}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>
      )}

      {/* Tabla */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        {/* Encabezado */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gold-500" />
            <span className="font-display font-bold text-sm tracking-wide" style={{ color: 'var(--text-title)' }}>
              {logs
                ? hasFilters
                  ? `${filtered.length} de ${logs.length} registro${logs.length !== 1 ? 's' : ''}`
                  : `${logs.length} registro${logs.length !== 1 ? 's' : ''}`
                : 'Actividad del sistema'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--text-body)', background: 'var(--bg-surface-alt)' }}
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : isError ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: '#F87171' }}>
            Error al cargar la bitácora: {(error as Error)?.message ?? 'desconocido'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Activity className="w-8 h-8 opacity-20" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {hasFilters ? 'Ningún registro coincide con los filtros.' : 'Aún no hay registros de actividad.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-surface-alt)' }}>
                <tr>
                  {[
                    { label: '#',       cls: 'w-12 text-center' },
                    { label: 'Acción',  cls: '' },
                    { label: 'Tabla',   cls: 'hidden sm:table-cell' },
                    { label: 'Usuario', cls: 'hidden md:table-cell' },
                    { label: 'Fecha',   cls: 'hidden lg:table-cell' },
                    { label: 'Hora',    cls: '' },
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
                {filtered.map((entry, i) => (
                  <tr
                    key={entry.id}
                    style={{ borderTop: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-alt)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* # */}
                    <td className="px-4 py-3 text-center tabular-nums text-xs" style={{ color: 'var(--text-muted)' }}>
                      {i + 1}
                    </td>

                    {/* Acción */}
                    <td className="px-4 py-3">
                      <ActionBadge action={entry.action} />
                    </td>

                    {/* Tabla */}
                    <td className="hidden sm:table-cell px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {TABLE_LABELS[entry.table_name ?? ''] ?? entry.table_name ?? '—'}
                    </td>

                    {/* Usuario */}
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex items-center gap-2">
                        {entry.user_email ? (
                          <>
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
                            >
                              {entry.user_email.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs truncate max-w-[160px]" style={{ color: 'var(--text-body)' }}>
                              {entry.user_email}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sistema</span>
                        )}
                      </div>
                    </td>

                    {/* Fecha */}
                    <td className="hidden lg:table-cell px-4 py-3 text-xs" style={{ color: 'var(--text-body)' }}>
                      {formatFecha(entry.created_at)}
                    </td>

                    {/* Hora */}
                    <td className="px-4 py-3">
                      <span
                        className="font-mono text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(247,201,72,0.15)', color: 'var(--accent)' }}
                      >
                        {formatHora(entry.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {logs && logs.length > 0 && (
          <div
            className="flex items-center gap-2 px-5 py-3 text-xs"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface-alt)', color: 'var(--text-muted)' }}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            {hasFilters
              ? `${filtered.length} de ${logs.length} registros · `
              : `${logs.length} registros · `}
            Actualización automática cada 60 s
          </div>
        )}
      </div>
    </div>
  )
}
