import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { AlertCircle, Info, ChevronLeft, ChevronRight, Calendar, Clock, Shield, Check, Minus, Plus, Wind, Waves, Thermometer, Compass, User, Phone, Mail, MessageSquare } from 'lucide-react'
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
import { PACKAGES, CHILDREN_PRICE, BOAT_CAPACITY, MAX_ADVANCE_DAYS, TIME_SLOTS, COMPANY } from '@constants/index'
import type { PackageId } from '@constants/index'

import '../../styles/reservation.css'

// ─── Tipos ───────────────────────────────────────────────────────────────────
// adults y youth se distribuyen por paquete; children tienen paquete único fijo
type AgeGroup = 'adults' | 'youth'
type PkgCounts = Record<PackageId, Record<AgeGroup, number>>

const PKG_IDS = Object.keys(PACKAGES) as PackageId[]

const EMPTY_COUNTS = (): PkgCounts =>
  Object.fromEntries(PKG_IDS.map(id => [id, { adults: 0, youth: 0 }])) as PkgCounts

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

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n)

// ─── Sub-componente: contador pequeño ────────────────────────────────────────
function Counter({
  value, onDec, onInc, disableDec, disableInc,
}: {
  value: number
  onDec: () => void
  onInc: () => void
  disableDec: boolean
  disableInc: boolean
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={onDec}
        disabled={disableDec}
        className="w-7 h-7 rounded-full border border-navy-200 bg-white text-navy-700 flex items-center justify-center hover:bg-navy-900 hover:text-gold-300 hover:border-navy-900 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={13} />
      </button>
      <span className="font-display font-bold text-[18px] w-5 text-center leading-none">{value}</span>
      <button
        type="button"
        onClick={onInc}
        disabled={disableInc}
        className="w-7 h-7 rounded-full border border-navy-200 bg-white text-navy-700 flex items-center justify-center hover:bg-navy-900 hover:text-gold-300 hover:border-navy-900 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
      >
        <Plus size={13} />
      </button>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ReservationPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()
  const { mutateAsync: createReservation, isPending } = useCreateReservation()
  const setPendingReservation = useReservationStore((s) => s.setPendingReservation)
  const setPkgBreakdown       = useReservationStore((s) => s.setPkgBreakdown)
  const { data: bizSettings } = useBusinessSettings()
  const [serverError, setServerError] = useState<string | null>(null)
  const qc = useQueryClient()

  // ── Estado de tripulación
  // adults y youth: distribuidos por paquete
  // children: paquete único fijo (agua, sodas y pizza $300)
  // babies: gratis
  const [counts, setCounts] = useState<PkgCounts>(EMPTY_COUNTS)
  const [children, setChildren] = useState(0)
  const [babies, setBabies] = useState(0)

  const inc = (pkg: PackageId, group: AgeGroup) =>
    setCounts(prev => ({ ...prev, [pkg]: { ...prev[pkg], [group]: prev[pkg][group] + 1 } }))

  const dec = (pkg: PackageId, group: AgeGroup) =>
    setCounts(prev => ({ ...prev, [pkg]: { ...prev[pkg], [group]: Math.max(0, prev[pkg][group] - 1) } }))

  // Date window
  const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()))

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
    defaultValues: { serviceType: 'individual', numberOfPeople: 0, date: initialDate },
  })

  useEffect(() => { setValue('date', initialDate) }, [initialDate, setValue])

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

  // ── Totales derivados ─────────────────────────────────────────────────────
  const totalAdults   = PKG_IDS.reduce((s, id) => s + counts[id].adults, 0)
  const totalYouth    = PKG_IDS.reduce((s, id) => s + counts[id].youth,  0)
  const numberOfPeople  = totalAdults + totalYouth + children  // sin bebés (capacidad)
  const totalPassengers = numberOfPeople + babies

  // Paquete dominante derivado (el que tiene más personas; fallback al primero con alguien)
  const dominantPkg: PackageId = useMemo(() =>
    PKG_IDS.reduce((best, id) => {
      const n    = counts[id].adults + counts[id].youth
      const bestN = counts[best].adults + counts[best].youth
      return n > bestN ? id : best
    }, PKG_IDS[0])
  , [counts])

  // Sync form fields
  useEffect(() => {
    setValue('numberOfPeople', numberOfPeople)
  }, [numberOfPeople, setValue])

  useEffect(() => {
    setValue('packageId', dominantPkg as any)
  }, [dominantPkg, setValue])

  // Pricing por paquete (adults + youth) + niños tarifa fija
  const pkgCosts = useMemo(() =>
    Object.fromEntries(PKG_IDS.map(id => {
      const p = PACKAGES[id]
      const cost = p.adultPrice * counts[id].adults
               + p.youthPrice  * counts[id].youth
      return [id, cost]
    })) as Record<PackageId, number>
  , [counts])

  const childrenCost = children * CHILDREN_PRICE
  const total = Object.values(pkgCosts).reduce((s, c) => s + c, 0) + childrenCost

  const watchedDate = watch('date')
  const watchedTime = watch('time') ?? null

  const closedWeekday   = bizSettings?.closedWeekday   ?? 1
  const closedDates     = bizSettings?.closedDates     ?? []
  const activeTimeSlots = bizSettings?.activeTimeSlots ?? TIME_SLOTS.map(s => s.time)

  const { datos: condData } = useMarinaForecast(watchedDate || null) as any
  const { data: availability, isLoading: availLoading } = useAvailability(watchedDate)

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(windowStart, i)),
    [windowStart]
  )

  // Active step
  const hasPassengers = numberOfPeople > 0
  const activeStep = !hasPassengers ? 1 : (!watchedDate || !watchedTime) ? 2 : (!watch('contactName')) ? 3 : 4

  const steps = [
    { n: 1, label: t('reservation.steps.crew') },
    { n: 2, label: t('reservation.steps.datetime') },
    { n: 3, label: t('reservation.steps.contact') },
  ]

  const onSubmit = async (values: ReservationFormValues) => {
    setServerError(null)
    if (totalAdults === 0) {
      setServerError('Se requiere al menos 1 adulto para realizar la reservación y abordar el barco.')
      return
    }
    try {
      const pkgBreakdownItems: import('@app-types/index').PackageBreakdownItem[] = PKG_IDS
        .filter(id => id !== 'NINOS')
        .map(id => {
          const p = PACKAGES[id]
          const c = counts[id]
          const total = c.adults * p.adultPrice + c.youth * p.youthPrice
          if (c.adults === 0 && c.youth === 0) return null
          return { packageId: id, adults: c.adults, adultPrice: p.adultPrice, youth: c.youth, youthPrice: p.youthPrice, total }
        })
        .filter(Boolean) as import('@app-types/index').PackageBreakdownItem[]

      if (children > 0) {
        pkgBreakdownItems.push({
          packageId: 'NINOS',
          adults: 0, adultPrice: 0,
          youth: 0,  youthPrice: 0,
          children,  childrenPrice: CHILDREN_PRICE,
          total: childrenCost,
        })
      }

      const reservation = await createReservation({
        ...values,
        packageId:        dominantPkg,
        packageBreakdown: pkgBreakdownItems,
        serviceType:      numberOfPeople >= 10 ? 'grupal' : 'individual',
        notes:            values.notes || undefined,
        adults:           totalAdults,
        youth:            totalYouth,
        children,
        babies,
        adultsCost:   PKG_IDS.reduce((s, id) => s + PACKAGES[id].adultPrice * counts[id].adults, 0),
        youthCost:    PKG_IDS.reduce((s, id) => s + PACKAGES[id].youthPrice  * counts[id].youth,  0),
        childrenCost,
      })
      setPendingReservation(reservation)
      setPkgBreakdown({
        packages: PKG_IDS
          .map(id => {
            const p = PACKAGES[id]
            const c = counts[id]
            const total = c.adults * p.adultPrice + c.youth * p.youthPrice
            if (total === 0 && c.adults === 0 && c.youth === 0) return null
            return { packageId: id, label: p.label, icon: p.icon, adults: c.adults, adultPrice: p.adultPrice, youth: c.youth, youthPrice: p.youthPrice, total }
          })
          .filter(Boolean) as import('@app/store/reservationStore').PkgBreakdownItem[],
        children,
        childrenCost,
        babies,
      })
      navigate('/reservar/confirmacion')
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('reservation.errors.generic')
      if (/capacidad excedida/i.test(msg))             setServerError(t('reservation.errors.capacity'))
      else if (/horario .* no disponible/i.test(msg))  setServerError(t('reservation.errors.invalidSlot'))
      else setServerError(msg)
    }
  }

  // Visible time slots
  const KNOWN_SLOTS = Object.fromEntries(TIME_SLOTS.map(s => [s.time, s]))
  const visibleSlots = [...activeTimeSlots].sort().map(ts => {
    if (KNOWN_SLOTS[ts]) return KNOWN_SLOTS[ts]
    const h = parseInt(ts.split(':')[0], 10)
    const slotKey = h < 11 ? 'morning' : h < 14 ? 'noon' : h < 18 ? 'afternoon' : 'sunset'
    return { time: ts, slotKey, label: ts, icon: '🌊', description: '' }
  })
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const nowHHMM  = format(new Date(), 'HH:mm')

  // Conditions
  const condViento = condData?.clima?.velocidadViento ?? null
  const condOlas   = condData?.marina?.alturaOlas ?? null
  const condTMax   = condData?.clima?.temperaturaMax ?? null
  const condTMin   = condData?.clima?.temperaturaMin ?? null
  const condDir    = condData?.marina?.direccionOlasGrados ?? null
  const condFav    = condData ? (condViento === null || condViento <= 40) && (condOlas === null || condOlas <= 2) : true

  // Solo adults y youth se distribuyen por paquete
  const AGE_GROUPS: { key: AgeGroup; label: string; desc: string; priceKey: 'adultPrice' | 'youthPrice' }[] = [
    { key: 'adults', label: 'Adultos',      desc: '18 años en adelante', priceKey: 'adultPrice' },
    { key: 'youth',  label: 'Adolescentes', desc: '12 a 17 años',        priceKey: 'youthPrice' },
  ]

  return (
    <>
      {/* ── Hero strip ─────────────────────────────────────────────────────── */}
      <section className="rv-hero">
        <div className="relative z-10 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2 text-sm mb-4" style={{ color: 'rgba(243,234,208,.6)' }}>
            <Link to="/" className="text-gold-300 hover:underline">{t('reservation.backHome')}</Link>
            <span style={{ opacity: .4 }}>/</span>
            <span>{t('reservation.bookTour')}</span>
          </div>
          <h1 className="font-pirata font-normal text-gold-300 leading-none m-0"
              style={{ fontSize: 'clamp(38px,5vw,62px)', letterSpacing: '.01em' }}>
            {t('reservation.heroTitle')}
          </h1>
          <p className="mt-3 font-display font-semibold uppercase tracking-widest text-sm"
             style={{ color: 'rgba(243,234,208,.8)', letterSpacing: '.25em' }}>
            {t('reservation.location')}
          </p>
        </div>
        <svg className="rv-hero-wave" viewBox="0 0 1600 52" preserveAspectRatio="none" aria-hidden>
          <path d="M0,30 C200,52 400,10 600,30 C800,52 1000,10 1200,30 C1400,52 1600,10 1600,30 L1600,52 L0,52 Z" fill="#eff5fb"/>
        </svg>
      </section>

      {/* ── Main form ──────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
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

            {/* ── Card I: Tripulación + Paquete ───────────────────────────── */}
            <div className="bg-white border border-navy-100 rounded-2xl shadow-card overflow-hidden mb-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-navy-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-navy-900 text-gold-300 flex items-center justify-center font-display font-bold text-sm">I</div>
                  <h2 className="text-[17px] font-bold m-0">Tripulación y paquetes</h2>
                </div>
                <span className="text-[13px] text-navy-400 font-medium">
                  {totalPassengers > 0
                    ? `${totalPassengers} ${totalPassengers === 1 ? 'persona' : 'personas'} · ${fmt(total)}`
                    : 'Elige quién viene y qué incluye'}
                </span>
              </div>

              <div className="p-4 sm:p-5">
                {/* Intro explicativo */}
                <p className="text-[13px] text-navy-500 mb-4">
                  Indica <b className="text-navy-700">cuántas personas</b> quieren cada paquete. Puedes mezclar paquetes en el mismo paseo.
                </p>

                {/* Tabla paquete × grupo de edad */}
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full min-w-[480px] border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left pb-3 pl-1 text-[12px] font-semibold text-navy-400 uppercase tracking-wider w-32">
                          Grupo
                        </th>
                        {PKG_IDS.map(id => {
                          const p = PACKAGES[id]
                          return (
                            <th key={id} className="pb-3 px-2 text-center">
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <span className="text-[18px]">{p.icon}</span>
                                <span className="text-[12px] font-bold text-navy-800 leading-tight">{p.label}</span>
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {AGE_GROUPS.map(({ key, label, desc, priceKey }) => (
                        <tr key={key} className="border-t border-navy-50">
                          <td className="py-3 pl-1 pr-2">
                            <p className="font-semibold text-[13px] text-navy-800 m-0 leading-tight">{label}</p>
                            <p className="text-[11px] text-navy-400 m-0">{desc}</p>
                          </td>
                          {PKG_IDS.map(id => {
                            if (id === 'NINOS') {
                              return (
                                <td key={id} className="py-3 px-2 text-center">
                                  <span className="inline-block text-[11px] text-navy-300 bg-navy-50 border border-navy-100 rounded-lg px-2 py-1 leading-tight select-none">
                                    Solo niños
                                  </span>
                                </td>
                              )
                            }
                            const price = PACKAGES[id][priceKey]
                            const val   = counts[id][key]
                            const atCapacity = numberOfPeople >= BOAT_CAPACITY
                            return (
                              <td key={id} className="py-3 px-2">
                                <div className="flex flex-col items-center gap-1">
                                  <Counter
                                    value={val}
                                    onDec={() => dec(id, key)}
                                    onInc={() => inc(id, key)}
                                    disableDec={val <= 0}
                                    disableInc={atCapacity && val === 0}
                                  />
                                  <span className="text-[11px] text-navy-400 font-medium">${price} c/u</span>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}

                      {/* Fila niños — paquete único fijo */}
                      <tr className="border-t border-navy-50 bg-navy-50/30">
                        <td className="py-3 pl-1 pr-2">
                          <p className="font-semibold text-[13px] text-navy-800 m-0 leading-tight">Niños</p>
                          <p className="text-[11px] text-navy-400 m-0">3 a 11 años</p>
                        </td>
                        {/* Primera columna: contador centrado */}
                        <td className="py-3 px-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Counter
                              value={children}
                              onDec={() => setChildren(v => Math.max(0, v - 1))}
                              onInc={() => setChildren(v => v + 1)}
                              disableDec={children <= 0}
                              disableInc={numberOfPeople >= BOAT_CAPACITY}
                            />
                            <span className="text-[11px] text-navy-400 font-medium">${CHILDREN_PRICE} c/u</span>
                          </div>
                        </td>
                        {/* Segunda columna: descripción del paquete único */}
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-navy-500 bg-white border border-navy-100 rounded-lg px-2.5 py-1.5 leading-tight">
                            🍕 agua, sodas y pizza
                          </span>
                        </td>
                      </tr>

                      {/* Fila bebés */}
                      <tr className="border-t border-navy-50 bg-green-50/30">
                        <td className="py-3 pl-1 pr-2">
                          <p className="font-semibold text-[13px] text-navy-800 m-0 leading-tight">Bebés</p>
                          <p className="text-[11px] text-navy-400 m-0">1 a 3 años · sin asiento</p>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Counter
                              value={babies}
                              onDec={() => setBabies(v => Math.max(0, v - 1))}
                              onInc={() => setBabies(v => v + 1)}
                              disableDec={babies <= 0}
                              disableInc={babies >= 10}
                            />
                            <span className="text-[11px] font-semibold text-green-600">Gratis</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-navy-500 bg-white border border-navy-100 rounded-lg px-2.5 py-1.5 leading-tight">
                            🍼 sin asiento asignado
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Advertencia adultos */}
                <div className={clsx(
                  'flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] transition-colors mt-4',
                  totalAdults === 0
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-green-50 border border-green-100 text-green-700',
                )}>
                  {totalAdults === 0
                    ? <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-amber-500" />
                    : <Check size={15} className="flex-shrink-0 mt-0.5 text-green-600" />
                  }
                  <span>
                    {totalAdults === 0
                      ? <><b>Se requiere al menos 1 adulto</b> para poder realizar la reservación y abordar el barco.</>
                      : <><b>{totalAdults} adulto{totalAdults !== 1 ? 's' : ''}</b> incluido{totalAdults !== 1 ? 's' : ''} en la tripulación.</>
                    }
                  </span>
                </div>

                {errors.numberOfPeople && <p className="error-message mt-2">{errors.numberOfPeople.message}</p>}
              </div>
            </div>

            {/* ── Card II: Fecha + Hora ────────────────────────────────────── */}
            <div className="bg-white border border-navy-100 rounded-2xl shadow-card overflow-hidden mb-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-navy-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-navy-900 text-gold-300 flex items-center justify-center font-display font-bold text-sm">II</div>
                  <h2 className="text-[17px] font-bold m-0">{t('reservation.card2.title')}</h2>
                </div>
                <span className="text-[13px] text-navy-400 font-medium">{t('reservation.card2.subtitle')}</span>
              </div>
              <div className="p-5">

                {/* Date row */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-navy-400 mr-auto">
                    <Calendar size={16} className="text-gold-600" />
                    {t('reservation.card2.dateLabel')}
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
                    const dayLabel = isToday ? t('datePicker.today') : isTom ? t('datePicker.tomorrow').slice(0, 3) : format(d, 'EEE', { locale: es }).toUpperCase().slice(0, 3)
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
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> {t('reservation.legend.available')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gold-400 inline-block" /> {t('reservation.legend.fewLeft')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-navy-200 inline-block" /> {t('reservation.legend.closed')}</span>
                </div>
                {errors.date && <p className="error-message mt-2">{errors.date.message}</p>}

                {/* Time slots */}
                {watchedDate && (
                  <div className="mt-5 pt-4 border-t border-dashed border-navy-100">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-navy-400 mb-3">
                      <Clock size={16} className="text-gold-600" />
                      {t('reservation.card2.timeLabel')}
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
                                {t('reservation.slot.last')}
                              </span>
                            )}
                            <span className={clsx('font-display font-bold text-[20px]', isSel ? 'text-navy-900' : 'text-navy-900')}>{slot.time}</span>
                            <span className={clsx('text-[13px] font-semibold', isSel ? 'text-navy-700' : 'text-navy-600')}>{t(`timePicker.slots.${slot.slotKey}`)}</span>
                            <span className="text-[12px] text-navy-400">
                              {availLoading ? t('reservation.slot.loading') : isFull ? t('reservation.slot.full') : isPast ? t('reservation.slot.past') : notEnough ? t('reservation.slot.onlyN', { count: available }) : t('reservation.slot.places', { count: available })}
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
                  {condFav ? t('reservation.conditions.favorable') : t('reservation.conditions.adverse')}
                  <span className="ml-auto font-medium text-[12px]">
                    {format(new Date(watchedDate + 'T12:00:00'), 'EEE d MMM', { locale: es })}
                    {watchedTime && ` · ${watchedTime}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 text-[12.5px]">
                  {condTMax !== null && condTMin !== null && (
                    <div className="flex items-center gap-2 text-navy-700">
                      <Thermometer size={14} className="text-navy-400 flex-shrink-0" />
                      {t('reservation.conditions.temp')} <b className="ml-auto text-navy-900">{condTMax}° / {condTMin}°C</b>
                    </div>
                  )}
                  {condViento !== null && (
                    <div className="flex items-center gap-2 text-navy-700">
                      <Wind size={14} className="text-navy-400 flex-shrink-0" />
                      {t('reservation.conditions.wind')} <b className="ml-auto text-navy-900">{condViento} km/h</b>
                    </div>
                  )}
                  {condOlas !== null && (
                    <div className="flex items-center gap-2 text-navy-700">
                      <Waves size={14} className="text-navy-400 flex-shrink-0" />
                      {t('reservation.conditions.waves')} <b className="ml-auto text-navy-900">{condOlas} m</b>
                    </div>
                  )}
                  {condDir !== null && (
                    <div className="flex items-center gap-2 text-navy-700">
                      <Compass size={14} className="text-navy-400 flex-shrink-0" />
                      {t('reservation.conditions.direction')} <b className="ml-auto text-navy-900">{condDir}° (S)</b>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Card III: Datos de contacto ──────────────────────────────── */}
            <div className="bg-white border border-navy-100 rounded-2xl shadow-card overflow-hidden mb-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-navy-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-navy-900 text-gold-300 flex items-center justify-center font-display font-bold text-sm">III</div>
                  <h2 className="text-[17px] font-bold m-0">{t('reservation.card4.title')}</h2>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label flex items-center gap-1.5"><User size={14} />{t('reservation.contact.name')}</label>
                  <input
                    {...register('contactName')}
                    placeholder={t('reservation.contact.namePlaceholder')}
                    className={clsx('input-field', errors.contactName && 'border-pirate-500')}
                  />
                  {errors.contactName && <p className="error-message">{errors.contactName.message}</p>}
                </div>
                <div>
                  <label className="label flex items-center gap-1.5"><Phone size={14} />{t('reservation.contact.phone')}</label>
                  <input
                    {...register('contactPhone')}
                    placeholder={t('reservation.contact.phonePlaceholder')}
                    className={clsx('input-field', errors.contactPhone && 'border-pirate-500')}
                  />
                  {errors.contactPhone && <p className="error-message">{errors.contactPhone.message}</p>}
                </div>
                <div>
                  <label className="label flex items-center gap-1.5"><Mail size={14} />{t('reservation.contact.email')}</label>
                  <input
                    {...register('contactEmail')}
                    type="email"
                    placeholder={t('reservation.contact.emailPlaceholder')}
                    className={clsx('input-field', errors.contactEmail && 'border-pirate-500')}
                  />
                  {errors.contactEmail && <p className="error-message">{errors.contactEmail.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="label flex items-center gap-1.5"><MessageSquare size={14} />{t('reservation.notes')}</label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    placeholder={t('reservation.contact.notesPlaceholder2')}
                    className="input-field resize-none"
                  />
                  {errors.notes && <p className="error-message">{errors.notes.message}</p>}
                </div>
              </div>
            </div>

            {/* ── Info ────────────────────────────────────────────────────── */}
            <div className="border border-navy-100 rounded-2xl bg-white p-5 flex flex-col gap-3 text-[13px] text-navy-500">
              <div className="flex items-start gap-3">
                <Shield size={16} className="text-gold-500 flex-shrink-0 mt-0.5" />
                <span><b className="text-navy-800">{t('reservation.info.cancellationTitle')}</b> {t('reservation.info.cancellationDetail')}</span>
              </div>
              <div className="flex items-start gap-3">
                <Info size={16} className="text-gold-500 flex-shrink-0 mt-0.5" />
                <span><b className="text-navy-800">{t('reservation.info.arrival30')}</b> {t('reservation.info.arrivalDetail')}</span>
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
                <p className="text-[11px] font-bold uppercase tracking-[.2em] text-gold-300 mb-1">{t('reservation.sum.yourReservation')}</p>
                <h3 className="font-display font-bold text-[18px] m-0" style={{ color: '#f3ead0' }}>
                  {totalPassengers > 0 ? `${totalPassengers} personas · ${fmt(total)}` : t('reservation.sum.selectTour')}
                </h3>
              </div>

              <div className="p-5">
                {/* Fecha y hora */}
                <div className="space-y-0 mb-4">
                  <div className="flex justify-between items-start gap-4 py-2.5 border-b border-dashed border-navy-100 text-[13.5px]">
                    <span className="text-navy-400 font-medium">{t('reservation.sum.date')}</span>
                    <div className="text-right">
                      <span className="font-semibold text-navy-800 block">
                        {watchedDate ? format(new Date(watchedDate + 'T12:00:00'), "EEE d MMMM", { locale: i18n.language === 'es' ? es : undefined }) : '—'}
                      </span>
                      <span className="text-[11.5px] text-navy-400 block mt-0.5">{watchedTime || '—'}</span>
                    </div>
                  </div>
                  {babies > 0 && (
                    <div className="flex justify-between items-center py-2.5 border-b border-dashed border-navy-100 text-[13.5px]">
                      <span className="text-navy-400 font-medium">{babies} bebé{babies !== 1 ? 's' : ''}</span>
                      <span className="text-green-700 font-semibold text-sm">Gratis</span>
                    </div>
                  )}
                </div>

                {/* Desglose por paquete */}
                {totalPassengers > 0 && (
                  <div className="space-y-3 text-[13px]">
                    {PKG_IDS.map(id => {
                      const p = PACKAGES[id]
                      const c = counts[id]
                      const pkgTotal = c.adults * p.adultPrice + c.youth * p.youthPrice
                      if (pkgTotal === 0) return null
                      return (
                        <div key={id} className="rounded-xl border border-navy-100 overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 bg-navy-50 border-b border-navy-100">
                            <span>{p.icon}</span>
                            <span className="font-semibold text-navy-800 text-[12.5px]">{p.label}</span>
                            <span className="ml-auto font-bold text-navy-900">{fmt(pkgTotal)}</span>
                          </div>
                          <div className="px-3 py-2 space-y-1">
                            {c.adults > 0 && <div className="flex justify-between text-navy-500"><span>{c.adults} adulto{c.adults !== 1 ? 's' : ''}</span><span>{fmt(c.adults * p.adultPrice)}</span></div>}
                            {c.youth  > 0 && <div className="flex justify-between text-navy-500"><span>{c.youth} adolescente{c.youth !== 1 ? 's' : ''}</span><span>{fmt(c.youth * p.youthPrice)}</span></div>}
                          </div>
                        </div>
                      )
                    })}

                    {/* Niños — paquete único */}
                    {children > 0 && (
                      <div className="rounded-xl border border-navy-100 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-navy-50 border-b border-navy-100">
                          <span>🍕</span>
                          <span className="font-semibold text-navy-800 text-[12.5px]">Niños · agua, sodas y pizza</span>
                          <span className="ml-auto font-bold text-navy-900">{fmt(childrenCost)}</span>
                        </div>
                        <div className="px-3 py-2">
                          <div className="flex justify-between text-navy-500">
                            <span>{children} niño{children !== 1 ? 's' : ''}</span>
                            <span>{fmt(childrenCost)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-baseline pt-4 mt-3 border-t-2 border-navy-900">
                  <span className="text-[13px] font-bold uppercase tracking-wider text-navy-400">{t('reservation.sum.total')}</span>
                  <div className="text-right">
                    <span className="font-display font-black text-[30px] text-navy-900">{fmt(total)}</span>
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
                  {isPending ? t('reservation.sum.processing') : t('reservation.sum.bookAndPay')}
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
                  t('reservation.trust.secure'),
                  t('reservation.trust.confirmation'),
                  t('reservation.trust.cancellation'),
                ].map(line => (
                  <div key={line} className="flex items-center gap-2">
                    <Check size={13} className="text-green-600 flex-shrink-0" />
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center mt-3 text-[12px] text-navy-400">
              {t('reservation.help')}{' '}
              <a href={`tel:${COMPANY.phone}`} className="text-navy-900 font-semibold underline">{COMPANY.phone}</a>
            </p>
          </aside>
        </div>
      </form>
    </>
  )
}
