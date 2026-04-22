import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format, isTomorrow, isToday, parse, startOfDay } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PICKER_DAYS } from '@constants/index'
import { CalendarPicker } from './CalendarPicker'

interface DateSlotPickerProps {
  value: string | null       // 'yyyy-MM-dd'
  onChange: (iso: string) => void
  days?: number              // cuántos días mostrar
  minDate?: Date
  error?: string
  closedWeekday?: number     // 0 = domingo, 1 = lunes, ... (día que no hay servicio)
}

/**
 * Selector de fecha como tarjetas horizontales de los próximos N días.
 * - Día 0 se etiqueta "Hoy", día 1 "Mañana".
 * - Scroll horizontal con flechas en desktop.
 * - Día "closedWeekday" se marca como cerrado (no seleccionable).
 * - Se traduce con i18n y muestra los nombres de día en el idioma activo.
 */
export function DateSlotPicker({
  value,
  onChange,
  days = DATE_PICKER_DAYS,
  minDate,
  error,
  closedWeekday = 1, // Martes a Domingo → cerrado lunes
}: DateSlotPickerProps) {
  const { t, i18n } = useTranslation()
  const today = useMemo(() => startOfDay(new Date()), [])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [calOpen, setCalOpen] = useState(false)

  // date-fns locale según el idioma activo de i18n
  const dfLocale = i18n.resolvedLanguage === 'en' ? enUS : es

  const base = useMemo(() => minDate ?? today, [minDate, today])
  const context = Math.floor(days / 2) // días a mostrar antes de la seleccionada

  const [windowStart, setWindowStart] = useState(base)

  // Recentra la ventana cuando cambia la fecha seleccionada
  useEffect(() => {
    if (!value) { setWindowStart(base); return }
    const selected = parse(value, 'yyyy-MM-dd', new Date())
    const ideal = addDays(selected, -context)
    setWindowStart(ideal < base ? base : ideal)
  }, [value, base, context])

  const dates = useMemo(() =>
    Array.from({ length: days }).map((_, i) => addDays(windowStart, i))
  , [days, windowStart])

  const scroll = (dir: 'left' | 'right') => {
    setWindowStart(prev => {
      const next = addDays(prev, dir === 'left' ? -3 : 3)
      return next < base ? base : next
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label flex items-center gap-2 mb-0">
          <CalendarDays className="w-4 h-4 text-gold-600" />
          {t('datePicker.label')} <span className="text-pirate-500">*</span>
        </label>
        <div className="flex gap-1">
          {/* Botón calendario completo */}
          <button
            type="button"
            onClick={() => setCalOpen(true)}
            title="Abrir calendario"
            className="p-1.5 rounded-lg border border-gold-400 bg-gold-50 text-gold-700 hover:bg-gold-400 hover:text-navy-900 transition-colors shadow-gold"
          >
            <CalendarDays className="w-4 h-4" />
          </button>

          {/* Flechas scroll (solo desktop) */}
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label={t('datePicker.prev')}
            className="hidden md:flex p-1.5 rounded-lg border border-navy-200 text-navy-600 hover:bg-navy-50 hover:border-navy-400 transition-colors items-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label={t('datePicker.next')}
            className="hidden md:flex p-1.5 rounded-lg border border-navy-200 text-navy-600 hover:bg-navy-50 hover:border-navy-400 transition-colors items-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal calendario completo */}
      <CalendarPicker
        value={value}
        onChange={onChange}
        closedWeekday={closedWeekday}
        isOpen={calOpen}
        onClose={() => setCalOpen(false)}
      />

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth -mx-1 px-1"
        style={{ scrollbarWidth: 'thin' }}
        role="radiogroup"
        aria-label={t('datePicker.label')}
      >
        {dates.map((d) => {
          const iso       = format(d, 'yyyy-MM-dd')
          const isClosed  = d.getDay() === closedWeekday
          const isSelected = value === iso

          const weekday = isToday(d)    ? t('datePicker.today')
                        : isTomorrow(d) ? t('datePicker.tomorrow')
                        : format(d, 'EEE', { locale: dfLocale }).toUpperCase()

          const monthLabel = format(d, 'MMM', { locale: dfLocale }).toUpperCase()

          return (
            <button
              key={iso}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isClosed}
              onClick={() => onChange(iso)}
              className={clsx(
                'snap-start shrink-0 w-20 md:w-24 py-3 px-2 rounded-xl text-center transition-all border-2 relative',
                isSelected && !isClosed &&
                  'bg-navy-900 text-white border-gold-400 shadow-gold scale-105',
                !isSelected && !isClosed &&
                  'bg-white text-navy-900 border-navy-200 hover:border-gold-400 hover:shadow-card',
                isClosed &&
                  'bg-navy-50 text-navy-300 border-navy-100 cursor-not-allowed line-through',
              )}
            >
              <div
                className={clsx(
                  'text-[10px] font-bold tracking-wider mb-0.5',
                  isSelected ? 'text-gold-400' : isClosed ? 'text-navy-300' : 'text-gold-600',
                )}
              >
                {weekday}
              </div>
              <div className={clsx(
                'text-2xl md:text-3xl font-display font-bold leading-none',
                isClosed && 'line-through decoration-2',
              )}>
                {format(d, 'd')}
              </div>
              <div className={clsx(
                'text-[10px] font-semibold mt-0.5',
                isSelected ? 'text-navy-200' : 'text-navy-500',
              )}>
                {monthLabel}
              </div>
              {isClosed && (
                <div className="absolute inset-x-0 bottom-1 text-[8px] font-bold text-pirate-500 uppercase">
                  {t('datePicker.closed')}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {error && <p className="error-message">{error}</p>}
      {!error && (
        <p className="text-xs text-navy-500">
          {t('datePicker.hint')}
        </p>
      )}
    </div>
  )
}
