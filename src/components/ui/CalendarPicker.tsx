import { useState, useEffect, useCallback } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, format, isSameMonth,
  isBefore, startOfDay, isSameDay, parse,
} from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { MAX_ADVANCE_DAYS } from '@constants/index'

interface CalendarPickerProps {
  value: string | null          // 'yyyy-MM-dd'
  onChange: (iso: string) => void
  closedWeekdays?: number[]     // 0=dom … 6=sáb, puede ser varios días
  closedDates?: string[]        // fechas específicas cerradas 'yyyy-MM-dd'
  isOpen: boolean
  onClose: () => void
  adminMode?: boolean           // sin restricciones de fecha
  enforceClosedDays?: boolean   // aun en adminMode, bloquea días sin paseos
}

export function CalendarPicker({
  value,
  onChange,
  closedWeekdays = [1],
  closedDates = [],
  isOpen,
  onClose,
  adminMode = false,
  enforceClosedDays = false,
}: CalendarPickerProps) {
  const { i18n } = useTranslation()
  const dfLocale  = i18n.resolvedLanguage === 'en' ? enUS : es

  const today   = startOfDay(new Date())
  const maxDate = addDays(today, MAX_ADVANCE_DAYS)

  const initialMonth = value
    ? startOfMonth(parse(value, 'yyyy-MM-dd', new Date()))
    : startOfMonth(today)

  const [viewMonth, setViewMonth] = useState(initialMonth)

  // Sincroniza el mes visible si el valor externo cambia mientras está cerrado
  useEffect(() => {
    if (value) {
      setViewMonth(startOfMonth(parse(value, 'yyyy-MM-dd', new Date())))
    }
  }, [value, isOpen])

  const handleSelect = useCallback((date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'))
    onClose()
  }, [onChange, onClose])

  // Cierra con Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // ─── Construir grilla del mes ─────────────────────────────────────────
  const monthStart = startOfMonth(viewMonth)
  const monthEnd   = endOfMonth(viewMonth)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 }) // lunes primero
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 })

  const cells: Date[] = []
  let cur = gridStart
  while (cur <= gridEnd) { cells.push(cur); cur = addDays(cur, 1) }

  const prevMonth = subMonths(viewMonth, 1)
  const prevOk    = adminMode ? true : endOfMonth(prevMonth) >= today
  const nextOk    = adminMode ? true : startOfMonth(addMonths(viewMonth, 1)) <= maxDate

  const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    /* ── Backdrop ── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-navy-900/30 backdrop-blur-sm" />

      {/* ── Panel del calendario ── */}
      <div
        className="relative z-10 w-full max-w-sm animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cal-border-wrap rounded-2xl bg-gradient-to-br from-navy-200/80 to-navy-100/50 p-[1.5px] shadow-card-lg">
          <div className="cal-panel rounded-2xl bg-white overflow-hidden">

            {/* ── Cabecera ── */}
            <div className="cal-header bg-navy-50 border-b border-navy-100 px-5 pt-5 pb-4">
              {/* Título + cierre */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-navy-400" />
                  <span className="font-display text-navy-600 text-sm font-bold tracking-widest uppercase">
                    Seleccionar Fecha
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-navy-300 hover:text-navy-600 hover:bg-navy-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navegación mes */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => prevOk && setViewMonth(subMonths(viewMonth, 1))}
                  disabled={!prevOk}
                  className="p-2 rounded-xl border border-navy-200 text-navy-400 hover:border-navy-400 hover:text-navy-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="font-display font-bold text-navy-700 tracking-wider capitalize">
                  {format(viewMonth, 'MMMM yyyy', { locale: dfLocale })}
                </span>

                <button
                  type="button"
                  onClick={() => nextOk && setViewMonth(addMonths(viewMonth, 1))}
                  disabled={!nextOk}
                  className="p-2 rounded-xl border border-navy-200 text-navy-400 hover:border-navy-400 hover:text-navy-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Cuerpo del calendario ── */}
            <div className="cal-body px-4 pb-5 pt-3 bg-white">

              {/* Nombres de día */}
              <div className="grid grid-cols-7 mb-1">
                {weekdays.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-bold text-navy-400 tracking-widest py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Celdas */}
              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((d) => {
                  const iso            = format(d, 'yyyy-MM-dd')
                  const inMonth        = isSameMonth(d, viewMonth)
                  const isPast         = isBefore(d, today)
                  const isOverMax      = d > maxDate
                  const isClosed       = closedWeekdays.includes(d.getDay())
                  const isClosedDate   = closedDates.includes(iso)
                  const closedBlocked  = (!adminMode || enforceClosedDays) && (isClosed || isClosedDate)
                  const isDisabled     = adminMode
                    ? (!inMonth || closedBlocked)
                    : (isPast || isOverMax || isClosed || isClosedDate || !inMonth)
                  const isSelected     = value === iso
                  const isToday        = isSameDay(d, today)

                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => !isDisabled && handleSelect(d)}
                      className={clsx(
                        'relative mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold transition-all',
                        // Seleccionado
                        isSelected && inMonth &&
                          'cal-day-sel bg-navy-500 text-white shadow-card scale-110 font-bold',
                        // Hoy (no seleccionado)
                        isToday && !isSelected &&
                          'border border-navy-300 text-navy-500 bg-navy-50',
                        // Disponible normal
                        !isSelected && !isDisabled &&
                          'text-navy-700 hover:bg-navy-50 hover:text-navy-900',
                        // Fuera del mes
                        !inMonth &&
                          'opacity-0 pointer-events-none',
                        // Deshabilitado (pasado / cerrado / fuera de rango)
                        isDisabled && inMonth &&
                          'text-navy-200 cursor-not-allowed',
                        // Día sin paseos (semanal o fecha específica) con tachado
                        closedBlocked && inMonth &&
                          'line-through text-pirate-300',
                      )}
                    >
                      {format(d, 'd')}
                      {isToday && !isSelected && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-navy-400" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Leyenda */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-navy-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border border-navy-300 bg-navy-50" />
                  <span className="text-[10px] text-navy-400">Hoy</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-lg bg-navy-500" />
                  <span className="text-[10px] text-navy-400">Seleccionado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-pirate-300 line-through font-semibold">L</span>
                  <span className="text-[10px] text-navy-400">Cerrado</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
