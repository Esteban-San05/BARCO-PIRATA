import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { AlertCircle, Info, ChevronLeft, ChevronRight, Calendar, Clock, Shield, Check, Minus, Plus, Wind, Waves, Thermometer, Compass, User, Phone, Mail, MessageSquare, Anchor, Star, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { addDays, format, isToday as dfIsToday, isTomorrow, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'

import { getReservationSchema, type ReservationFormValues } from '@utils/validators/reservation'
import { useCreateReservation } from '@features/reservations/hooks/useReservations'
import { useReservationStore } from '@app/store/reservationStore'
import { useBusinessSettings } from '@features/settings/hooks/useBusinessSettings'
import { useAvailability, availableInSlot } from '@features/availability/hooks/useAvailability'
import { useMarinaForecast } from '@hooks/useMarinaForecast'
import { supabase } from '@lib/supabase'
import { receiptService } from '@features/payments/services/receiptService'
import { PACKAGES, DISCOUNT_MIN_PEOPLE, DISCOUNT_RATE, BOAT_CAPACITY, MAX_ADVANCE_DAYS, TIME_SLOTS, COMPANY } from '@constants/index'
import type { PackageId } from '@constants/index'

import '../../styles/reservation.css'

// ─── Static tour display metadata ───────────────────────────────────────────
const TOUR_META: Record<string, { tag: string; tagStyle: string; features: string[]; duration: string; icon: React.ReactNode }> = {
  SOLO_PASEO: {
    tag: 'Familiar',
    tagStyle: 'bg-navy-100 text-navy-700',
    features: ['Recorrido panorámico del litoral', 'Ideal para toda la familia', 'Bebidas incluidas a bordo'],
    duration: '2 horas',
    icon: <Sun size={20} />,
  },
  SOLO_BEBIDAS: {
    tag: 'Popular',
    tagStyle: 'bg-pirate-700 text-gold-300',
    features: ['Atardecer en alta mar', 'Barra de bebidas incluida', 'Show pirata en cubierta'],
    duration: '2.5 horas',
    icon: <Waves size={20} />,
  },
  CON_COMIDA: {
    tag: 'Premium',
    tagStyle: 'bg-gold-400 text-navy-900',
    features: ['Buffet de mariscos a bordo', 'Bebidas + show en vivo', 'Experiencia completa'],
    duration: '3 horas',
    icon: <Star size={20} />,
  },
}

// ─── Addons ──────────────────────────────────────────────────────────────────
const ADDONS = [
  { id: 'costume',   label: 'Disfraz pirata para niños', desc: 'Sombrero, parche y espada de juguete', price: 80  },
  { id: 'photo',     label: 'Foto profesional a bordo',  desc: 'Recuerdo digital + impresa',            price: 150 },
  { id: 'champagne', label: 'Botella de champaña',        desc: 'Para celebraciones especiales',         price: 420 },
] as const

type AddonId = typeof ADDONS[number]['id']

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isDateClosed(iso: string, closedWeekday: number, closedDates: string[]): boolean {
  const d = new Date(iso + 'T00:00:00')
  return d.getDay() === closedWeekday || closedDates.includes(iso)
}

function getNextAvailableDate(fromIso: string, closedWeekday: number, closedDates: string[], maxDays: number): string {
  const base = new Date(fromIso + 'T00:00:00')
  for (let i = 1; i <= maxDays; i++) {
    const d = addDays(base, i)
    const iso = format(d, 'yyyy-MM-dd')
    if (!isDateClosed(iso, closedWeekday, closedDates)) return iso
  }
  return fromIso
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ReservationPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { mutateAsync: createReservation, isPending } = useCreateReservation()
  const setPendingReservation = useReservationStore((s) => s.setPendingReservation)
  const { data: bizSettings } = useBusinessSettings()
  const [serverError, setServerError] = useState<string | null>(null)
  const qc = useQueryClient()

  // Passenger state
  const [adults,   setAdults]   = useState(2)
  const [children, setChildren] = useState(0)
  const [babies,   setBabies]   = useState(0)

  // Addon state
  const [selectedAddons, setSelectedAddons] = useState<Set<AddonId>>(new Set())

  // Date window (7-day grid)
  const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()))

  // Promo code UI (display only)
  const [promoCode, setPromoCode] = useState('')

  // Real-time settings sync
  useEffect(() => {
    const channel = supabase
      .channel('reservation-page-settings-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'business_settings', filter: 'id=eq.1' }, () => {
        qc.invalidateQueries({ queryKey: ['business-settings'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc])

  const schema = useMemo(() => getReservationSchema(), [i18n.language])

  const initialDate = useMemo(() => {
    const raw = searchParams.get('date')
    const today = format(new Date(), 'yyyy-MM-dd')
    const maxIso = format(new Date(Date.now() + MAX_ADVANCE_DAYS * 86400_000), 'yyyy-MM-dd')
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw >= today && raw <= maxIso) return raw
    return today
  }, [searchParams])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { serviceType: 'individual', numberOfPeople: adults, date: initialDate },
  })

  useEffect(() => { setValue('date', initialDate) }, [initialDate, setValue])

  // Auto-advance if selected date is closed
  useEffect(() => {
    if (!bizSettings) return
    const cw = bizSettings.closedWeekday ?? 1
    const cd = bizSettings.closedDates ?? []
    const current = getValues('date') || format(new Date(), 'yyyy-MM-dd')
    if (isDateClosed(current, cw, cd)) {
      const next = getNextAvailableDate(current, cw, cd, MAX_ADVANCE_DAYS)
      setValue('date', next)
    }
  }, [bizSettings, getValues, setValue])

  // Sync numberOfPeople → form field
  useEffect(() => {
    setValue('numberOfPeople', Math.max(1, adults + children))
  }, [adults, children, setValue])

  const watchedPkg  = watch('packageId') as PackageId | undefined
  const watchedDate = watch('date')
  const watchedTime = watch('time') ?? null

  const closedWeekday   = bizSettings?.closedWeekday   ?? 1
  const closedDates     = bizSettings?.closedDates     ?? []
  const activeTimeSlots = bizSettings?.activeTimeSlots ?? TIME_SLOTS.map(s => s.time)

  // Weather/conditions for selected date+time
  const { datos: condData } = useMarinaForecast(watchedDate || null) as any

  // Availability for selected date
  const { data: availability, isLoading: availLoading } = useAvailability(watchedDate)

  // 7-day grid
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(windowStart, i)),
    [windowStart]
  )

  // Pricing
  const pkg = watchedPkg ? PACKAGES[watchedPkg] : null
  const ppp = pkg?.pricePerPerson ?? 0
  const adultsCost    = ppp * adults
  const childrenCost  = Math.round(ppp * 0.5 * children)
  const addonsTotal   = [...selectedAddons].reduce((sum, id) => {
    const a = ADDONS.find(a => a.id === id)
    return sum + (a?.price ?? 0)
  }, 0)
  const numberOfPeople   = adults + children
  const peopleSubtotal   = adultsCost + childrenCost
  const hasGroupDiscount = numberOfPeople >= DISCOUNT_MIN_PEOPLE
  const discount         = hasGroupDiscount ? Math.round(peopleSubtotal * DISCOUNT_RATE) : 0
  const total            = peopleSubtotal + addonsTotal - discount

  // Active step (for step rail)
  const activeStep = !watchedPkg ? 1 : (!watchedDate || !watchedTime) ? 2 : (!watch('contactName')) ? 3 : 4

  const toggleAddon = (id: AddonId) => {
    setSelectedAddons(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const onSubmit = async (values: ReservationFormValues) => {
    setServerError(null)
    const addonStr = [...selectedAddons]
      .map(id => ADDONS.find(a => a.id === id)?.label)
      .filter(Boolean).join(', ')
    const notesWithAddons = [values.notes, addonStr].filter(Boolean).join(' | ')
    try {
      const reservation = await createReservation({
        ...values,
        serviceType: numberOfPeople >= DISCOUNT_MIN_PEOPLE ? 'grupal' : 'individual',
        notes: notesWithAddons || undefined,
      })
      setPendingReservation(reservation)
      receiptService.send(reservation.id, values.contactEmail).catch(console.warn)
      navigate('/reservar/confirmacion')
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('reservation.errors.generic')
      if (/capacidad excedida/i.test(msg))          setServerError(t('reservation.errors.capacity'))
      else if (/horario .* no disponible/i.test(msg)) setServerError(t('reservation.errors.invalidSlot'))
      else setServerError(msg)
    }
  }

  // ── Visible time slots ────────────────────────────────────────────────────
  const KNOWN_SLOTS = Object.fromEntries(TIME_SLOTS.map(s => [s.time, s]))
  const visibleSlots = [...activeTimeSlots].sort().map(t => KNOWN_SLOTS[t] ?? { time: t, label: t, icon: '🌊', description: '' })
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const nowHHMM  = format(new Date(), 'HH:mm')

  // ── Conditions data ───────────────────────────────────────────────────────
  const condViento = condData?.clima?.velocidadViento ?? null
  const condOlas   = condData?.marina?.alturaOlas ?? null
  const condTMax   = condData?.clima?.temperaturaMax ?? null
  const condTMin   = condData?.clima?.temperaturaMin ?? null
  const condDir    = condData?.marina?.direccionOlasGrados ?? null
  const condFav    = condData ? (condViento === null || condViento <= 40) && (condOlas === null || condOlas <= 2) : true

  // ── Steps config ──────────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: 'Paseo' },
    { n: 2, label: 'Fecha y hora' },
    { n: 3, label: 'Tripulación' },
    { n: 4, label: 'Datos y pago' },
  ]

  return (
    <>
      {/* ── Hero strip ─────────────────────────────────────────────────────── */}
      <section className="rv-hero">
        <div className="relative z-10 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2 text-sm mb-4" style={{ color: 'rgba(243,234,208,.6)' }}>
            <Link to="/" className="text-gold-300 hover:underline">← Volver al inicio</Link>
            <span style={{ opacity: .4 }}>/</span>
            <span>Reservar paseo</span>
          </div>
          <h1 className="font-pirata font-normal text-gold-300 leading-none m-0"
              style={{ fontSize: 'clamp(38px,5vw,62px)', letterSpacing: '.01em' }}>
            Reserva tu Aventura
          </h1>
          <p className="mt-3 font-display font-semibold uppercase tracking-widest text-sm"
             style={{ color: 'rgba(243,234,208,.8)', letterSpacing: '.25em' }}>
            Puerto Peñasco · Sonora · México
          </p>
        </div>
        <svg className="rv-hero-wave" viewBox="0 0 1600 52" preserveAspectRatio="none" aria-hidden>
          <path d="M0,30 C200,52 400,10 600,30 C800,52 1000,10 1200,30 C1400,52 1600,10 1600,30 L1600,52 L0,52 Z" fill="#eff5fb"/>
        </svg>
      </section>

      {/* ── Main form ──────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Hidden inputs so react-hook-form valida los campos manejados por state */}
        <input type="hidden" {...register('packageId')} />
        <input type="hidden" {...register('numberOfPeople', { valueAsNumber: true })} />
        <input type="hidden" {...register('serviceType')} />
        <div className="rv-shell">

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          <div className="min-w-0">

            {/* Step Rail */}
            <div className="bg-white border border-navy-100 rounded-2xl px-5 py-4 flex items-center gap-1.5 shadow-card mb-4 overflow-x-auto">
              {steps.map((step, idx) => {
                const isDone   = step.n < activeStep
                const isActive = step.n === activeStep
                return (
                  <div key={step.n} className="contents">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className={clsx(
                        'w-7 h-7 rounded-full flex items-center justify-center font-bold text-[13px] border-2 transition-all',
                        isDone   && 'bg-green-600 border-green-600 text-white',
                        isActive && 'bg-navy-900 border-gold-400 text-gold-300 shadow-[0_0_0_4px_rgba(244,197,66,.2)]',
                        !isDone && !isActive && 'bg-navy-50 border-navy-200 text-navy-400',
                      )}>
                        {isDone ? <Check size={13} /> : step.n}
                      </div>
                      <span className={clsx(
                        'text-[13px] font-semibold whitespace-nowrap',
                        isActive ? 'text-navy-900' : isDone ? 'text-navy-700' : 'text-navy-400',
                      )}>{step.label}</span>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className={clsx('rv-step-line', isDone && 'done')} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Card I: Tour picker ─────────────────────────────────────── */}
            <div className="bg-white border border-navy-100 rounded-2xl shadow-card overflow-hidden mb-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-navy-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-navy-900 text-gold-300 flex items-center justify-center font-display font-bold text-sm">I</div>
                  <h2 className="text-[17px] font-bold m-0">Elige tu paseo</h2>
                </div>
                <span className="text-[13px] text-navy-400 font-medium">3 experiencias disponibles</span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Object.entries(PACKAGES).map(([key, pkg]) => {
                    const meta = TOUR_META[key]
                    if (!meta) return null
                    const isSel = watchedPkg === key
                    return (
                      <div
                        key={key}
                        role="radio"
                        aria-checked={isSel}
                        tabIndex={0}
                        onClick={() => setValue('packageId', key as PackageId, { shouldValidate: true })}
                        onKeyDown={(e) => e.key === 'Enter' && setValue('packageId', key as PackageId, { shouldValidate: true })}
                        className={clsx('rv-tour cursor-pointer', isSel && 'rv-tour-sel')}
                      >
                        {/* Tag badge */}
                        {!isSel && (
                          <span className={clsx('absolute top-3 right-3 text-[10.5px] font-bold uppercase tracking-wider px-2 py-1 rounded-md', meta.tagStyle)}>
                            {meta.tag}
                          </span>
                        )}
                        {/* Checkmark when selected */}
                        {isSel && (
                          <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gold-400 text-navy-900 flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}

                        <div className="w-11 h-11 rounded-xl bg-navy-900 text-gold-400 flex items-center justify-center mb-3">
                          {meta.icon}
                        </div>
                        <h3 className="font-display font-bold text-[15px] tracking-tight mb-1 m-0">{pkg.label}</h3>
                        <p className="text-[12px] text-navy-400 mb-3">{meta.duration}</p>
                        <ul className="list-none p-0 m-0 mb-3 flex flex-col gap-1.5">
                          {meta.features.map(f => (
                            <li key={f} className="text-[12.5px] flex gap-2 items-start text-navy-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-[6px] flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <div className="flex items-baseline gap-1.5 pt-3 border-t border-dashed border-navy-100">
                          <span className="font-display font-bold text-[22px] text-navy-900">${pkg.pricePerPerson}</span>
                          <span className="text-[12px] text-navy-400">MXN / persona</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {errors.packageId && <p className="error-message mt-2">{errors.packageId.message}</p>}
              </div>
            </div>

            {/* ── Card II: Date + Time ────────────────────────────────────── */}
            <div className="bg-white border border-navy-100 rounded-2xl shadow-card overflow-hidden mb-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-navy-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-navy-900 text-gold-300 flex items-center justify-center font-display font-bold text-sm">II</div>
                  <h2 className="text-[17px] font-bold m-0">Fecha y horario</h2>
                </div>
                <span className="text-[13px] text-navy-400 font-medium">Hasta 90 días de anticipación</span>
              </div>
              <div className="p-5">

                {/* Date row */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-navy-400 mr-auto">
                    <Calendar size={16} className="text-gold-600" />
                    Fecha del paseo
                  </div>
                  <span className="text-[13px] font-semibold text-navy-800 px-2">
                    {format(windowStart, 'MMMM yyyy', { locale: es }).replace(/^./, c => c.toUpperCase())}
                  </span>
                  <button type="button" onClick={() => setWindowStart(s => addDays(s, -7))}
                    className="w-8 h-8 rounded-lg border border-navy-200 flex items-center justify-center text-navy-500 hover:border-gold-500 hover:text-navy-900 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <button type="button" onClick={() => setWindowStart(s => addDays(s, 7))}
                    className="w-8 h-8 rounded-lg border border-navy-200 flex items-center justify-center text-navy-500 hover:border-gold-500 hover:text-navy-900 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* 7-day grid */}
                <div className="grid grid-cols-7 gap-2">
                  {days.map(d => {
                    const iso      = format(d, 'yyyy-MM-dd')
                    const isClosed = isDateClosed(iso, closedWeekday, closedDates)
                    const isSel    = watchedDate === iso
                    const isToday  = dfIsToday(d)
                    const isTom    = isTomorrow(d)
                    const dayLabel = isToday ? 'HOY' : isTom ? 'MAÑ' : format(d, 'EEE', { locale: es }).toUpperCase().slice(0, 3)
                    const monthLabel = format(d, 'MMM', { locale: es }).toUpperCase()
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={isClosed}
                        onClick={() => { setValue('date', iso, { shouldValidate: true }); setValue('time', '', { shouldValidate: false }) }}
                        className={clsx('rv-day', isSel && 'rv-day-sel', isClosed && 'rv-day-closed')}
                      >
                        <div className={clsx('text-[10px] font-bold uppercase tracking-wider',
                          isSel ? 'text-gold-400' : isToday ? 'text-pirate-500' : 'text-navy-400')}>
                          {dayLabel}
                        </div>
                        <div className={clsx('font-display font-bold text-[22px] leading-tight',
                          isSel ? 'text-white' : 'text-navy-900')}>
                          {format(d, 'd')}
                        </div>
                        <div className={clsx('text-[10px] font-semibold mt-0.5',
                          isSel ? 'text-navy-300' : 'text-navy-400')}>
                          {monthLabel}
                        </div>
                        {!isClosed && (
                          <span className={clsx('absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full',
                            isSel ? 'bg-gold-300' : 'bg-green-500')} />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="flex gap-4 flex-wrap mt-3 text-[12px] text-navy-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Disponible</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gold-400 inline-block" /> Pocos lugares</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-navy-200 inline-block" /> Cerrado</span>
                </div>
                {errors.date && <p className="error-message mt-2">{errors.date.message}</p>}

                {/* Time slots */}
                {watchedDate && (
                  <div className="mt-5 pt-4 border-t border-dashed border-navy-100">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-navy-400 mb-3">
                      <Clock size={16} className="text-gold-600" />
                      Horario de salida
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {visibleSlots.map(slot => {
                        const available  = availableInSlot(availability, slot.time)
                        const isPast     = watchedDate === todayIso && slot.time <= nowHHMM
                        const isFull     = !isPast && !availLoading && !!availability && available <= 0
                        const fewLeft    = !isPast && !isFull && !availLoading && !!availability && available <= 5
                        const notEnough  = !isPast && !isFull && !availLoading && !!availability && available < numberOfPeople
                        const disabled   = isPast || isFull || notEnough
                        const isSel      = watchedTime === slot.time
                        const occupancy  = Math.min(100, Math.round(((BOAT_CAPACITY - available) / BOAT_CAPACITY) * 100))
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={disabled}
                            onClick={() => setValue('time', slot.time, { shouldValidate: true })}
                            className={clsx(
                              'rv-slot',
                              isSel && 'rv-slot-sel',
                              disabled && 'rv-slot-disabled',
                              isFull && 'rv-slot-full',
                            )}
                          >
                            {fewLeft && !isSel && (
                              <span className="absolute top-2.5 right-2.5 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                Últimos
                              </span>
                            )}
                            <span className={clsx('font-display font-bold text-[20px]', isSel ? 'text-navy-900' : 'text-navy-900')}>{slot.time}</span>
                            <span className={clsx('text-[13px] font-semibold', isSel ? 'text-navy-700' : 'text-navy-600')}>{slot.label}</span>
                            <span className="text-[12px] text-navy-400">
                              {availLoading ? 'Consultando...' : isFull ? 'Sin cupo' : isPast ? 'Horario pasado' : notEnough ? `Solo ${available} lugares` : `${available} lugares`}
                            </span>
                            {!availLoading && !isPast && availability && (
                              <div className="rv-avail-bar">
                                <span className={clsx('rv-avail-fill', fewLeft && 'few')} style={{ width: `${occupancy}%` }} />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {errors.time && <p className="error-message mt-2">{errors.time.message}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* ── Conditions widget ───────────────────────────────────────── */}
            {watchedDate && condData && (
              <div className="border border-navy-100 rounded-2xl overflow-hidden mb-4 bg-white">
                <div className={clsx(
                  'flex items-center gap-2 px-4 py-3 border-b text-[13px] font-bold',
                  condFav
                    ? 'bg-green-50 text-green-700 border-green-100'
                    : 'bg-red-50 text-pirate-700 border-red-100'
                )}>
                  {condFav ? <Check size={16} /> : <AlertCircle size={16} />}
                  {condFav ? 'Condiciones favorables para zarpar' : 'Condiciones adversas — consultar antes de reservar'}
                  <span className="ml-auto font-medium text-[12px]">
                    {format(new Date(watchedDate + 'T12:00:00'), 'EEE d MMM', { locale: es })}
                    {watchedTime && ` · ${watchedTime}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 text-[12.5px]">
                  {condTMax !== null && condTMin !== null && (
                    <div className="flex items-center gap-2 text-navy-700">
                      <Thermometer size={14} className="text-navy-400 flex-shrink-0" />
                      Temperatura <b className="ml-auto text-navy-900">{condTMax}° / {condTMin}°C</b>
                    </div>
                  )}
                  {condViento !== null && (
                    <div className="flex items-center gap-2 text-navy-700">
                      <Wind size={14} className="text-navy-400 flex-shrink-0" />
                      Viento <b className="ml-auto text-navy-900">{condViento} km/h</b>
                    </div>
                  )}
                  {condOlas !== null && (
                    <div className="flex items-center gap-2 text-navy-700">
                      <Waves size={14} className="text-navy-400 flex-shrink-0" />
                      Olas <b className="ml-auto text-navy-900">{condOlas} m</b>
                    </div>
                  )}
                  {condDir !== null && (
                    <div className="flex items-center gap-2 text-navy-700">
                      <Compass size={14} className="text-navy-400 flex-shrink-0" />
                      Dirección <b className="ml-auto text-navy-900">{condDir}° (S)</b>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Card III: Passengers ────────────────────────────────────── */}
            <div className="bg-white border border-navy-100 rounded-2xl shadow-card overflow-hidden mb-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-navy-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-navy-900 text-gold-300 flex items-center justify-center font-display font-bold text-sm">III</div>
                  <h2 className="text-[17px] font-bold m-0">Tripulación</h2>
                </div>
                <span className="text-[13px] text-navy-400 font-medium">
                  {numberOfPeople} {numberOfPeople === 1 ? 'persona' : 'personas'}
                  {pkg && ` · ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(peopleSubtotal)} MXN`}
                </span>
              </div>
              <div className="p-5">
                {/* Counters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Adultos',  desc: '13 años en adelante', val: adults,   set: setAdults,   min: 1, maxDisabled: numberOfPeople >= BOAT_CAPACITY, priceTag: pkg ? `$${ppp} MXN c/u` : '—' },
                    { label: 'Niños',    desc: '3 a 12 años',         val: children, set: setChildren, min: 0, maxDisabled: numberOfPeople >= BOAT_CAPACITY, priceTag: pkg ? `$${Math.round(ppp * 0.5)} MXN c/u (50%)` : '—' },
                    { label: 'Bebés',    desc: '0 a 2 años',          val: babies,   set: setBabies,   min: 0, maxDisabled: babies >= 10,                   priceTag: 'Gratis · sin asiento' },
                  ].map(({ label, desc, val, set, min, maxDisabled, priceTag }) => (
                    <div key={label} className="border border-navy-100 rounded-xl p-4 bg-white flex flex-col gap-1">
                      <p className="font-bold text-[14px] m-0">{label}</p>
                      <p className="text-[12px] text-navy-400 m-0 mb-2">{desc}</p>
                      <div className="flex items-center gap-3">
                        <button type="button"
                          disabled={val <= min}
                          onClick={() => set(v => Math.max(min, v - 1))}
                          className="w-9 h-9 rounded-full border border-navy-200 bg-white text-navy-800 text-lg font-semibold flex items-center justify-center hover:bg-navy-900 hover:text-gold-300 hover:border-navy-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <Minus size={16} />
                        </button>
                        <span className="font-display font-bold text-[22px] min-w-[24px] text-center">{val}</span>
                        <button type="button"
                          disabled={maxDisabled}
                          onClick={() => set(v => v + 1)}
                          className="w-9 h-9 rounded-full border border-navy-200 bg-white text-navy-800 text-lg font-semibold flex items-center justify-center hover:bg-navy-900 hover:text-gold-300 hover:border-navy-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                      <p className="text-[11px] text-navy-400 mt-auto pt-2 border-t border-dashed border-navy-100 m-0">
                        <b className="text-navy-700 font-bold">{priceTag.split('·')[0]}</b>
                        {priceTag.includes('·') && '· ' + priceTag.split('·')[1]}
                      </p>
                    </div>
                  ))}
                </div>

                {errors.numberOfPeople && <p className="error-message mb-3">{errors.numberOfPeople.message}</p>}

                {/* Addons */}
                <p className="font-bold text-[14px] tracking-wide mb-2">Extras opcionales</p>
                <div className="flex flex-col gap-2">
                  {ADDONS.map(addon => {
                    const checked = selectedAddons.has(addon.id)
                    return (
                      <label
                        key={addon.id}
                        onClick={() => toggleAddon(addon.id)}
                        className={clsx(
                          'flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-all',
                          checked
                            ? 'border-gold-400 bg-gradient-to-b from-amber-50 to-white'
                            : 'border-navy-100 hover:border-gold-400 bg-white',
                        )}
                      >
                        <span className={clsx(
                          'w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                          checked ? 'bg-gold-400 border-gold-400 text-navy-900' : 'border-navy-200',
                        )}>
                          {checked && <Check size={14} strokeWidth={3} />}
                        </span>
                        <span className="w-10 h-10 rounded-lg bg-navy-50 flex items-center justify-center flex-shrink-0 text-navy-700">
                          <Anchor size={18} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-bold text-[14px]">{addon.label}</span>
                          <span className="block text-[12px] text-navy-400">{addon.desc}</span>
                        </span>
                        <span className="font-display font-bold text-[15px] text-navy-900 whitespace-nowrap">+${addon.price}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── Card IV: Contact info ───────────────────────────────────── */}
            <div className="bg-white border border-navy-100 rounded-2xl shadow-card overflow-hidden mb-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-navy-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-navy-900 text-gold-300 flex items-center justify-center font-display font-bold text-sm">IV</div>
                  <h2 className="text-[17px] font-bold m-0">Datos y contacto</h2>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="label flex items-center gap-1.5"><User size={14} />Nombre completo *</label>
                  <input
                    {...register('contactName')}
                    placeholder="Tu nombre completo"
                    className={clsx('input-field', errors.contactName && 'border-pirate-500')}
                  />
                  {errors.contactName && <p className="error-message">{errors.contactName.message}</p>}
                </div>
                {/* Phone */}
                <div>
                  <label className="label flex items-center gap-1.5"><Phone size={14} />Teléfono *</label>
                  <input
                    {...register('contactPhone')}
                    placeholder="+52 638 000 0000"
                    className={clsx('input-field', errors.contactPhone && 'border-pirate-500')}
                  />
                  {errors.contactPhone && <p className="error-message">{errors.contactPhone.message}</p>}
                </div>
                {/* Email */}
                <div>
                  <label className="label flex items-center gap-1.5"><Mail size={14} />Correo electrónico *</label>
                  <input
                    {...register('contactEmail')}
                    type="email"
                    placeholder="tu@correo.com"
                    className={clsx('input-field', errors.contactEmail && 'border-pirate-500')}
                  />
                  {errors.contactEmail && <p className="error-message">{errors.contactEmail.message}</p>}
                </div>
                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="label flex items-center gap-1.5"><MessageSquare size={14} />Notas adicionales</label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    placeholder="Alergias, celebraciones, solicitudes especiales…"
                    className="input-field resize-none"
                  />
                  {errors.notes && <p className="error-message">{errors.notes.message}</p>}
                </div>
              </div>
            </div>

            {/* ── Bottom info ─────────────────────────────────────────────── */}
            <div className="border border-navy-100 rounded-2xl bg-white p-5 flex flex-col gap-3 text-[13px] text-navy-500">
              <div className="flex items-start gap-3">
                <Shield size={16} className="text-gold-500 flex-shrink-0 mt-0.5" />
                <span><b className="text-navy-800">Cancelación gratuita</b> hasta 24 h antes del paseo. Reembolso completo sin preguntas.</span>
              </div>
              <div className="flex items-start gap-3">
                <Info size={16} className="text-gold-500 flex-shrink-0 mt-0.5" />
                <span>Llegar <b className="text-navy-800">30 minutos antes</b> de zarpar al muelle Recinto Portuario.</span>
              </div>
            </div>

            {/* Server error */}
            {serverError && (
              <div className="panel-danger flex items-start gap-3 mt-4">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm mb-1">{t('reservation.errors.title')}</p>
                  <p className="text-sm">{serverError}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Summary ──────────────────────────────────────── */}
          <aside className="rv-summary-col rv-summary-sticky">
            <div className="bg-white border border-navy-100 rounded-2xl shadow-[0_12px_40px_-16px_rgba(6,18,31,.22)] overflow-hidden">

              {/* Summary hero */}
              <div className="relative bg-gradient-to-b from-navy-900 to-navy-800 text-white px-5 py-5 overflow-hidden">
                <div className="absolute right-0 bottom-0 w-32 h-32 pointer-events-none"
                     style={{ background: 'radial-gradient(circle, rgba(244,197,66,.15), transparent 70%)' }} />
                <p className="text-[11px] font-bold uppercase tracking-[.2em] text-gold-300 mb-1">Tu reserva</p>
                <h3 className="font-display font-bold text-[18px] text-bone m-0" style={{ color: '#f3ead0' }}>
                  {pkg?.label ?? 'Selecciona un paseo'}
                </h3>
              </div>

              <div className="p-5">
                {/* Info rows */}
                <div className="space-y-0">
                  {[
                    {
                      k: 'Fecha',
                      v: watchedDate ? format(new Date(watchedDate + 'T12:00:00'), "EEE d MMMM", { locale: es }) : '—',
                      sub: watchedTime ? `${watchedTime} · ${pkg ? TOUR_META[watchedPkg!]?.duration : '—'}` : '—',
                    },
                    {
                      k: 'Tripulación',
                      v: `${numberOfPeople} ${numberOfPeople === 1 ? 'persona' : 'personas'}`,
                      sub: `${adults} ${adults === 1 ? 'adulto' : 'adultos'}${children > 0 ? ` · ${children} ${children === 1 ? 'niño' : 'niños'}` : ''}${babies > 0 ? ` · ${babies} bebé${babies > 1 ? 's' : ''}` : ''}`,
                    },
                    {
                      k: 'Duración',
                      v: pkg ? TOUR_META[watchedPkg!]?.duration ?? '—' : '—',
                      sub: 'Muelle Recinto Portuario',
                    },
                  ].map(row => (
                    <div key={row.k} className="flex justify-between items-start gap-4 py-2.5 border-b border-dashed border-navy-100 last:border-0 text-[13.5px]">
                      <span className="text-navy-400 font-medium">{row.k}</span>
                      <div className="text-right">
                        <span className="font-semibold text-navy-800 block">{row.v}</span>
                        <span className="text-[11.5px] text-navy-400 block mt-0.5">{row.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price lines */}
                {pkg && (
                  <div className="mt-4 space-y-1.5 text-[13px]">
                    {adults > 0 && (
                      <div className="flex justify-between">
                        <span className="text-navy-400">{adults} × Adultos</span>
                        <span className="font-semibold">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(adultsCost)}</span>
                      </div>
                    )}
                    {children > 0 && (
                      <div className="flex justify-between">
                        <span className="text-navy-400">{children} × Niño (50%)</span>
                        <span className="font-semibold">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(childrenCost)}</span>
                      </div>
                    )}
                    {[...selectedAddons].map(id => {
                      const a = ADDONS.find(x => x.id === id)!
                      return (
                        <div key={id} className="flex justify-between">
                          <span className="text-navy-400">{a.label}</span>
                          <span className="font-semibold">${a.price}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between">
                      <span className="text-navy-400">Subtotal</span>
                      <span className="font-semibold">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(peopleSubtotal + addonsTotal)}</span>
                    </div>
                    {hasGroupDiscount && (
                      <div className="flex justify-between text-green-700">
                        <span>Descuento grupal</span>
                        <span className="font-semibold">−{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(discount)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Promo code */}
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value)}
                    placeholder="Código promocional"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-navy-200 text-[13px] font-sans focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-200"
                  />
                  <button type="button" className="btn-ghost text-[13px] px-3 py-2 rounded-xl border border-navy-200">
                    Aplicar
                  </button>
                </div>

                {/* Total */}
                <div className="flex justify-between items-baseline pt-4 mt-3 border-t-2 border-navy-900">
                  <span className="text-[13px] font-bold uppercase tracking-wider text-navy-400">Total</span>
                  <div className="text-right">
                    <span className="font-display font-black text-[30px] text-navy-900">
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(pkg ? total : 0)}
                    </span>
                    <span className="text-[12px] text-navy-400 ml-1">MXN</span>
                  </div>
                </div>

                {/* CTA */}
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full mt-4 px-5 py-4 rounded-xl font-display font-black text-[15px] tracking-wider uppercase text-navy-900 flex items-center justify-center gap-2.5 transition-all"
                  style={{
                    background: 'linear-gradient(180deg,#ffe07a,#e0a82e)',
                    boxShadow: '0 12px 30px -8px rgba(244,197,66,.45), inset 0 1px 0 rgba(255,255,255,.5)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = '')}
                >
                  {isPending ? 'Procesando…' : 'Reservar y pagar'}
                  {!isPending && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                  )}
                </button>
              </div>

              {/* Trust signals */}
              <div className="bg-navy-50 border-t border-navy-100 px-5 py-4 space-y-2 text-[12px] text-navy-500">
                {[
                  'Pago 100% seguro · Stripe / MercadoPago',
                  'Confirmación inmediata por correo',
                  'Cancelación gratis hasta 24 h antes',
                ].map(line => (
                  <div key={line} className="flex items-center gap-2">
                    <Check size={13} className="text-green-600 flex-shrink-0" />
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center mt-3 text-[12px] text-navy-400">
              ¿Necesitas ayuda?{' '}
              <a href={`tel:${COMPANY.phone}`} className="text-navy-900 font-semibold underline">{COMPANY.phone}</a>
            </p>
          </aside>
        </div>
      </form>
    </>
  )
}
