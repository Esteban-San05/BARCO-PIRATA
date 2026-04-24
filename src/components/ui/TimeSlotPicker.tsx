import { clsx } from 'clsx'
import { Clock, AlertTriangle, Users, XCircle, Loader2, CalendarOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { TIME_SLOTS, BOAT_CAPACITY } from '@constants/index'
import { useAvailability, availableInSlot } from '@features/availability/hooks/useAvailability'

interface TimeSlotPickerProps {
  date: string | null          // 'yyyy-MM-dd'
  value: string | null         // 'HH:MM'
  onChange: (time: string) => void
  numberOfPeople: number       // para saber si el slot tiene cupo suficiente
  error?: string
  activeTimeSlots?: string[]   // slots activos según business_settings
}

// Mapeo time → clave de traducción (para slots.<key> y descriptions.<key>)
const SLOT_KEYS: Record<string, string> = {
  '09:00': 'morning',
  '11:00': 'midMorning',
  '13:00': 'noon',
  '15:00': 'afternoon',
  '17:00': 'sunset',
}

/**
 * Muestra los 5 horarios disponibles como tarjetas, consultando en vivo
 * el cupo restante en Supabase vía `useAvailability`.
 *
 * Estados posibles por slot:
 *   • disponible      → verde-oro, seleccionable
 *   • pocos lugares   → aviso ámbar "Últimos X lugares"
 *   • cupo insuficiente → deshabilitado si el cliente pidió más personas que las disponibles
 *   • completo        → rojo, "Sin cupo"
 *   • ya pasó         → gris, deshabilitado (cuando la fecha es hoy y la hora ya quedó atrás)
 */
export function TimeSlotPicker({
  date,
  value,
  onChange,
  numberOfPeople,
  error,
  activeTimeSlots,
}: TimeSlotPickerProps) {
  const { t } = useTranslation()
  const { data: availability, isLoading, isError } = useAvailability(date)

  const visibleSlots = activeTimeSlots
    ? TIME_SLOTS.filter(s => activeTimeSlots.includes(s.time))
    : TIME_SLOTS

  // Detecta si la fecha seleccionada es HOY para saber qué slots ya pasaron.
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const isToday  = date === todayIso
  const nowHHMM  = format(new Date(), 'HH:mm')

  if (!date) {
    return (
      <div className="space-y-2">
        <label className="label flex items-center gap-2 mb-0">
          <Clock className="w-4 h-4 text-gold-600" />
          {t('timePicker.label')} <span className="text-pirate-500">*</span>
        </label>
        <div className="rounded-xl border-2 border-dashed border-navy-200 bg-navy-50 p-6 text-center text-navy-500 text-sm">
          {t('timePicker.selectDateFirst')}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label flex items-center gap-2 mb-0">
          <Clock className="w-4 h-4 text-gold-600" />
          {t('timePicker.label')} <span className="text-pirate-500">*</span>
        </label>
        {isLoading && (
          <span className="text-xs text-navy-500 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t('timePicker.loading')}
          </span>
        )}
      </div>

      {isError && (
        <div className="panel-danger text-xs">
          {t('timePicker.errorLoading')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleSlots.map((slot) => {
          const slotKey   = SLOT_KEYS[slot.time] ?? 'morning'
          const available = availableInSlot(availability, slot.time)
          const isPast    = isToday && slot.time <= nowHHMM
          // Solo marcar como lleno si la consulta fue exitosa (no en caso de error)
          const isFull    = !isPast && !isError && !!availability && available <= 0
          const notEnough = !isPast && !isFull && !isError && !!availability && available < numberOfPeople
          const fewLeft   = !isPast && !isFull && !notEnough && !isError && !!availability && available <= 5
          const isSelected = value === slot.time
          const disabled  = isPast || isFull || notEnough || isLoading

          // Porcentaje de ocupación para barra visual
          const occupancyPct = Math.min(100, Math.round(((BOAT_CAPACITY - available) / BOAT_CAPACITY) * 100))

          return (
            <button
              key={slot.time}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(slot.time)}
              className={clsx(
                'relative p-4 rounded-xl border-2 text-left transition-all group',
                isSelected && !disabled &&
                  'bg-navy-900 border-gold-400 shadow-gold',
                !isSelected && !disabled &&
                  'bg-white border-navy-200 hover:border-gold-400 hover:shadow-card',
                isPast &&
                  'bg-navy-50 border-navy-100 cursor-not-allowed opacity-60',
                isFull &&
                  'bg-pirate-50 border-pirate-200 cursor-not-allowed',
                notEnough &&
                  'bg-navy-50 border-navy-200 cursor-not-allowed opacity-70',
              )}
            >
              {/* Header: icono + hora + label */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className={clsx(
                    'text-2xl font-display font-bold leading-none',
                    isSelected ? 'text-white' : isPast ? 'text-navy-400 line-through' : 'text-navy-900',
                  )}>
                    {slot.time}
                  </div>
                  <div className={clsx(
                    'text-[11px] font-bold tracking-wider uppercase mt-1',
                    isSelected ? 'text-gold-400' : isPast ? 'text-navy-300' : 'text-gold-600',
                  )}>
                    {t(`timePicker.slots.${slotKey}`)}
                  </div>
                </div>
                <span className="text-2xl" aria-hidden>{slot.icon}</span>
              </div>

              {/* Descripción corta */}
              <p className={clsx(
                'text-xs mb-3',
                isSelected ? 'text-navy-200' : isPast ? 'text-navy-300' : 'text-navy-500',
              )}>
                {t(`timePicker.descriptions.${slotKey}`)}
              </p>

              {/* Estado dinámico */}
              <div className="flex items-center justify-between text-xs">
                {isLoading && !isPast && (
                  <span className="flex items-center gap-1 text-navy-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {t('timePicker.loadingShort')}
                  </span>
                )}

                {isPast && (
                  <span className="flex items-center gap-1 font-bold text-navy-400">
                    <CalendarOff className="w-3.5 h-3.5" />
                    {t('timePicker.passed')}
                  </span>
                )}

                {!isPast && !isLoading && isFull && (
                  <span className="flex items-center gap-1 font-bold text-pirate-600">
                    <XCircle className="w-3.5 h-3.5" />
                    {t('timePicker.noSeats')}
                  </span>
                )}

                {!isPast && !isLoading && notEnough && (
                  <span className="flex items-center gap-1 font-bold text-pirate-600">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t('timePicker.onlyN', { count: available })}
                  </span>
                )}

                {!isPast && !isLoading && fewLeft && (
                  <span className={clsx(
                    'flex items-center gap-1 font-bold',
                    isSelected ? 'text-gold-300' : 'text-gold-700',
                  )}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t('timePicker.lastN', { count: available })}
                  </span>
                )}

                {!isPast && !isLoading && !isFull && !notEnough && !fewLeft && (
                  <span className={clsx(
                    'flex items-center gap-1 font-semibold',
                    isSelected ? 'text-gold-300' : 'text-navy-600',
                  )}>
                    <Users className="w-3.5 h-3.5" />
                    {t('timePicker.available', { count: available })}
                  </span>
                )}
              </div>

              {/* Barra de ocupación */}
              {!isLoading && !isPast && availability && (
                <div className={clsx(
                  'mt-2 h-1 rounded-full overflow-hidden',
                  isSelected ? 'bg-white/20' : 'bg-navy-100',
                )}>
                  <div
                    className={clsx(
                      'h-full transition-all',
                      isFull
                        ? 'bg-pirate-500'
                        : fewLeft
                        ? 'bg-gold-500'
                        : 'bg-gold-400',
                    )}
                    style={{ width: `${occupancyPct}%` }}
                  />
                </div>
              )}

              {isSelected && !disabled && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gold-400 text-navy-900 flex items-center justify-center text-xs font-bold shadow">
                  ✓
                </div>
              )}
            </button>
          )
        })}
      </div>

      {error && <p className="error-message">{error}</p>}
      {!error && numberOfPeople > 0 && (
        <p className="text-xs text-navy-500">
          {t('timePicker.hint', { capacity: BOAT_CAPACITY })}
        </p>
      )}
    </div>
  )
}
