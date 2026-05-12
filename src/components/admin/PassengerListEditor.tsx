import { useState, useEffect } from 'react'
import { ClipboardList, Save, CheckCircle, AlertTriangle } from 'lucide-react'
import { usePassengers, useSavePassengers } from '@features/passengers/hooks/usePassengers'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import type { PassengerInput, PassengerType } from '@app-types/index'

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface PassengerCounts {
  adults:   number
  youth:    number
  children: number
  babies:   number
}

interface RowState {
  position:      number
  passengerType: PassengerType
  fullName:      string
  age:           string   // string en el input, convertido a number al guardar
}

interface Props {
  reservationId: string
  counts:        PassengerCounts
  readOnly?:     boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<PassengerType, { label: string; color: string }> = {
  adult: { label: 'Adulto',       color: 'bg-navy-100 text-navy-700' },
  youth: { label: 'Adolescente',  color: 'bg-blue-100 text-blue-700' },
  child: { label: 'Niño',         color: 'bg-green-100 text-green-700' },
  baby:  { label: 'Bebé',         color: 'bg-purple-100 text-purple-700' },
}

/** Genera las filas en orden adultos → adolescentes → niños → bebés. */
function buildRows(counts: PassengerCounts): Omit<RowState, 'fullName' | 'age'>[] {
  const rows: Omit<RowState, 'fullName' | 'age'>[] = []
  let pos = 1
  const push = (type: PassengerType, n: number) => {
    for (let i = 0; i < n; i++) rows.push({ position: pos++, passengerType: type })
  }
  push('adult', counts.adults)
  push('youth', counts.youth)
  push('child', counts.children)
  push('baby',  counts.babies)
  return rows
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PassengerListEditor({ reservationId, counts, readOnly = false }: Props) {
  const { data: saved, isLoading } = usePassengers(reservationId)
  const { mutateAsync: save, isPending } = useSavePassengers(reservationId)

  const [rows, setRows]       = useState<RowState[]>([])
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Inicializa/sincroniza filas cuando llegan los datos guardados
  useEffect(() => {
    const template = buildRows(counts)
    setRows(template.map((t) => {
      const existing = saved?.find((p) => p.position === t.position)
      return {
        ...t,
        fullName: existing?.fullName ?? '',
        age:      existing?.age != null ? String(existing.age) : '',
      }
    }))
  }, [saved, counts.adults, counts.youth, counts.children, counts.babies])

  // ── Métricas ───────────────────────────────────────────────────────────────
  const total   = rows.length
  const filled  = rows.filter((r) => r.fullName.trim() !== '' && r.age !== '').length
  const percent = total === 0 ? 100 : Math.round((filled / total) * 100)

  const progressColor =
    percent === 100 ? 'bg-green-500' :
    percent === 0   ? 'bg-red-400'   : 'bg-gold-500'

  const statusColor =
    percent === 100 ? 'text-green-600' :
    percent === 0   ? 'text-red-500'   : 'text-gold-600'

  // ── Handlers ───────────────────────────────────────────────────────────────
  const updateRow = (pos: number, field: 'fullName' | 'age', value: string) => {
    setSaveSuccess(false)
    setRows((prev) => prev.map((r) => r.position === pos ? { ...r, [field]: value } : r))
  }

  const handleSave = async () => {
    setSaveError(null)
    setSaveSuccess(false)
    const inputs: PassengerInput[] = rows.map((r) => ({
      fullName:      r.fullName.trim() || null,
      age:           r.age !== '' ? Number(r.age) : null,
      passengerType: r.passengerType,
      position:      r.position,
    }))
    try {
      await save(inputs)
      setSaveSuccess(true)
    } catch (e) {
      setSaveError((e as Error)?.message ?? 'Error al guardar. Intenta de nuevo.')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="border border-navy-100 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-4 h-4 text-gold-600" />
          <span className="text-sm font-semibold text-navy-700">Manifiesto de pasajeros</span>
        </div>
        <p className="text-sm text-navy-400 animate-pulse">Cargando...</p>
      </Card>
    )
  }

  if (total === 0) return null

  return (
    <Card className="border border-navy-100 mt-4">
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gold-600" />
          <span className="text-sm font-semibold text-navy-700">Manifiesto de pasajeros</span>
        </div>
        <span className={`text-xs font-semibold ${statusColor}`}>
          {filled} / {total} completos
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full h-1.5 bg-navy-100 rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {!readOnly && (
        <p className="text-xs text-navy-400 mb-4">
          Nombre y edad son necesarios para el reporte a Capitanía de Puerto. Puedes dejar en blanco lo que no sepas.
        </p>
      )}

      {/* ── Filas de pasajeros ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        {rows.map((row) => {
          const meta      = TYPE_META[row.passengerType]
          const isRowDone = row.fullName.trim() !== '' && row.age !== ''

          return (
            <div
              key={row.position}
              className={[
                'flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors',
                isRowDone ? 'border-green-200 bg-green-50' : 'border-navy-100 bg-white',
              ].join(' ')}
            >
              {/* Posición + tipo */}
              <span className="text-xs text-navy-400 w-5 shrink-0 text-right font-mono">
                {row.position}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.color}`}>
                {meta.label}
              </span>

              {readOnly ? (
                <>
                  <span className="flex-1 text-sm text-navy-800 truncate">
                    {row.fullName || <span className="text-navy-300 italic">—</span>}
                  </span>
                  <span className="text-sm text-navy-500 shrink-0 w-16 text-right">
                    {row.age !== '' ? `${row.age} años` : <span className="text-navy-300">—</span>}
                  </span>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={row.fullName}
                    onChange={(e) => updateRow(row.position, 'fullName', e.target.value)}
                    placeholder="Nombre completo"
                    className="input-field flex-1 text-sm py-1.5"
                  />
                  <input
                    type="number"
                    value={row.age}
                    onChange={(e) => updateRow(row.position, 'age', e.target.value)}
                    placeholder="Edad"
                    min={0}
                    max={120}
                    className="input-field w-20 shrink-0 text-sm py-1.5"
                  />
                </>
              )}

              {isRowDone && (
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Acciones ──────────────────────────────────────────────────────────*/}
      {!readOnly && (
        <div className="mt-4 space-y-2">
          <Button
            variant="outline"
            onClick={handleSave}
            isLoading={isPending}
            className="w-full"
          >
            <Save className="w-4 h-4" /> Guardar manifiesto
          </Button>

          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm text-green-700">Manifiesto guardado correctamente.</p>
            </div>
          )}

          {saveError && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{saveError}</p>
              </div>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="text-red-400 hover:text-red-600 font-bold shrink-0"
              >✕</button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
