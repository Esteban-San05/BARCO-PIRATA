import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import {
  Calendar, ChevronDown, Check,
} from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, subDays, subMonths,
  startOfYear, endOfYear, subYears, startOfWeek, endOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { Granularity } from '@features/reports/services/reportService'

// ════════════════════════════════════════════════════════════════════════
//   Tipos
// ════════════════════════════════════════════════════════════════════════

export interface Period {
  startDate: string       // 'yyyy-MM-dd'
  endDate:   string       // 'yyyy-MM-dd'
  granularity: Granularity
  /** Preset ID; null cuando el usuario editó el rango manualmente */
  preset: PresetId | null
}

export type PresetId =
  | 'today' | 'yesterday' | 'last7' | 'last30'
  | 'thisWeek' | 'thisMonth' | 'lastMonth'
  | 'thisYear' | 'lastYear' | 'last12m' | 'last5y' | 'all'

interface PresetDef {
  id: PresetId
  label: string
  /** Retorna el rango + granularidad sugerida */
  compute: () => Omit<Period, 'preset'>
  /** Agrupa los presets por categoría para el menú */
  group: 'rapidos' | 'mes' | 'año'
}

function ymd(d: Date) { return format(d, 'yyyy-MM-dd') }

const PRESETS: PresetDef[] = [
  {
    id: 'today', label: 'Hoy', group: 'rapidos',
    compute: () => ({ startDate: ymd(new Date()), endDate: ymd(new Date()), granularity: 'day' }),
  },
  {
    id: 'yesterday', label: 'Ayer', group: 'rapidos',
    compute: () => {
      const d = subDays(new Date(), 1)
      return { startDate: ymd(d), endDate: ymd(d), granularity: 'day' }
    },
  },
  {
    id: 'last7', label: 'Últimos 7 días', group: 'rapidos',
    compute: () => ({ startDate: ymd(subDays(new Date(), 6)), endDate: ymd(new Date()), granularity: 'day' }),
  },
  {
    id: 'last30', label: 'Últimos 30 días', group: 'rapidos',
    compute: () => ({ startDate: ymd(subDays(new Date(), 29)), endDate: ymd(new Date()), granularity: 'day' }),
  },
  {
    id: 'thisWeek', label: 'Esta semana', group: 'rapidos',
    compute: () => ({
      startDate: ymd(startOfWeek(new Date(), { weekStartsOn: 1 })),
      endDate:   ymd(endOfWeek  (new Date(), { weekStartsOn: 1 })),
      granularity: 'day',
    }),
  },
  {
    id: 'thisMonth', label: 'Este mes', group: 'mes',
    compute: () => ({
      startDate: ymd(startOfMonth(new Date())),
      endDate:   ymd(endOfMonth(new Date())),
      granularity: 'day',
    }),
  },
  {
    id: 'lastMonth', label: 'Mes pasado', group: 'mes',
    compute: () => {
      const d = subMonths(new Date(), 1)
      return {
        startDate: ymd(startOfMonth(d)),
        endDate:   ymd(endOfMonth(d)),
        granularity: 'day',
      }
    },
  },
  {
    id: 'last12m', label: 'Últimos 12 meses', group: 'mes',
    compute: () => ({
      startDate: ymd(startOfMonth(subMonths(new Date(), 11))),
      endDate:   ymd(new Date()),
      granularity: 'month',
    }),
  },
  {
    id: 'thisYear', label: 'Este año', group: 'año',
    compute: () => ({
      startDate: ymd(startOfYear(new Date())),
      endDate:   ymd(endOfYear(new Date())),
      granularity: 'month',
    }),
  },
  {
    id: 'lastYear', label: 'Año pasado', group: 'año',
    compute: () => {
      const d = subYears(new Date(), 1)
      return {
        startDate: ymd(startOfYear(d)),
        endDate:   ymd(endOfYear(d)),
        granularity: 'month',
      }
    },
  },
  {
    id: 'last5y', label: 'Últimos 5 años', group: 'año',
    compute: () => ({
      startDate: ymd(startOfYear(subYears(new Date(), 4))),
      endDate:   ymd(endOfYear(new Date())),
      granularity: 'year',
    }),
  },
  {
    id: 'all', label: 'Todo el histórico', group: 'año',
    compute: () => ({
      startDate: '2020-01-01',
      endDate:   ymd(new Date()),
      granularity: 'year',
    }),
  },
]

const GRANULARITIES: Array<{ value: Granularity; label: string }> = [
  { value: 'day',   label: 'Día' },
  { value: 'month', label: 'Mes' },
  { value: 'year',  label: 'Año' },
]

export const DEFAULT_PERIOD: Period = {
  ...PRESETS[3].compute(),  // "Últimos 30 días"
  preset: 'last30',
}

// ════════════════════════════════════════════════════════════════════════
//   Componente
// ════════════════════════════════════════════════════════════════════════

interface PeriodPickerProps {
  value: Period
  onChange: (p: Period) => void
  className?: string
}

export function PeriodPicker({ value, onChange, className }: PeriodPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const currentPreset = PRESETS.find((p) => p.id === value.preset)
  const label = currentPreset
    ? currentPreset.label
    : `${format(new Date(value.startDate), 'd MMM yyyy', { locale: es })} → ${format(new Date(value.endDate), 'd MMM yyyy', { locale: es })}`

  const applyPreset = (p: PresetDef) => {
    const range = p.compute()
    onChange({ ...range, preset: p.id })
    setOpen(false)
  }

  const applyCustomRange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return
    if (startDate > endDate) [startDate, endDate] = [endDate, startDate]
    onChange({ startDate, endDate, granularity: value.granularity, preset: null })
  }

  const applyGranularity = (g: Granularity) => {
    onChange({ ...value, granularity: g, preset: value.preset })
  }

  const grouped: Record<PresetDef['group'], PresetDef[]> = {
    rapidos: PRESETS.filter((p) => p.group === 'rapidos'),
    mes:     PRESETS.filter((p) => p.group === 'mes'),
    año:     PRESETS.filter((p) => p.group === 'año'),
  }

  return (
    <div ref={ref} className={clsx('relative w-full sm:w-auto', className)}>
      {/* Botón principal */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
          'admin-surface border admin-border hover:border-gold-400',
          'admin-text-body shadow-sm',
        )}
      >
        <Calendar className="w-4 h-4 text-gold-500 shrink-0" />
        <span className="font-semibold admin-text-title truncate flex-1 text-left">{label}</span>
        <span className="admin-text-subtle text-xs uppercase tracking-wider border-l admin-border pl-2 ml-1 shrink-0">
          {GRANULARITIES.find((g) => g.value === value.granularity)?.label}
        </span>
        <ChevronDown className={clsx('w-4 h-4 admin-text-muted transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {/* Panel desplegable */}
      {open && (
        <div
          className={clsx(
            'absolute right-0 mt-2 w-[min(640px,90vw)] rounded-xl shadow-modal z-50',
            'admin-surface border admin-border p-4',
          )}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PresetGroup title="Rápidos"     items={grouped.rapidos} active={value.preset} onPick={applyPreset} />
            <PresetGroup title="Por mes"     items={grouped.mes}     active={value.preset} onPick={applyPreset} />
            <PresetGroup title="Por año"     items={grouped.año}     active={value.preset} onPick={applyPreset} />
          </div>

          <div className="border-t admin-border my-4" />

          {/* Rango personalizado */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider admin-text-muted mb-1">Desde</label>
              <input
                type="date"
                value={value.startDate}
                onChange={(e) => applyCustomRange(e.target.value, value.endDate)}
                className="admin-input w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400"
              />
            </div>
            <div className="hidden md:block pb-2 admin-text-subtle">→</div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider admin-text-muted mb-1">Hasta</label>
              <input
                type="date"
                value={value.endDate}
                onChange={(e) => applyCustomRange(value.startDate, e.target.value)}
                className="admin-input w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider admin-text-muted mb-1">Agrupar por</label>
              <div className="inline-flex rounded-lg overflow-hidden border admin-border">
                {GRANULARITIES.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => applyGranularity(g.value)}
                    className={clsx(
                      'px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
                      value.granularity === g.value
                        ? 'bg-gold-400 text-navy-900'
                        : 'admin-text-body hover:bg-gold-50',
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
//   Grupo de presets (interno)
// ────────────────────────────────────────────────────────────────────────
function PresetGroup({
  title, items, active, onPick,
}: {
  title: string
  items: PresetDef[]
  active: PresetId | null
  onPick: (p: PresetDef) => void
}) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider admin-text-muted mb-2">{title}</h4>
      <ul className="space-y-1">
        {items.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className={clsx(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm transition-colors',
                active === p.id
                  ? 'bg-gold-400 text-navy-900 font-semibold'
                  : 'admin-text-body hover:bg-gold-50',
              )}
            >
              <span>{p.label}</span>
              {active === p.id && <Check className="w-3.5 h-3.5" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
