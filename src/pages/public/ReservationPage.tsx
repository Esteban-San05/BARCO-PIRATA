import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { addDays, format } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { getReservationSchema, type ReservationFormValues } from '@utils/validators/reservation'
import { useCreateReservation } from '@features/reservations/hooks/useReservations'
import { useReservationStore } from '@app/store/reservationStore'
import { useBusinessSettings } from '@features/settings/hooks/useBusinessSettings'
import { supabase } from '@lib/supabase'
import { receiptService } from '@features/payments/services/receiptService'
import { calculatePrice } from '@utils/pricing'
import { formatCurrency } from '@utils/formatters'
import { PACKAGES, DISCOUNT_MIN_PEOPLE, BOAT_CAPACITY, MAX_ADVANCE_DAYS } from '@constants/index'
import type { PackageId } from '@constants/index'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Card, CardHeader, CardTitle } from '@components/ui/Card'
import { DateSlotPicker } from '@components/ui/DateSlotPicker'
import { TimeSlotPicker } from '@components/ui/TimeSlotPicker'
import { ClimaResumen } from '@components/ClimaResumen'

/** Devuelve true si la fecha ISO está cerrada por día de semana o fecha específica */
function isDateClosed(iso: string, closedWeekday: number, closedDates: string[]): boolean {
  const d = new Date(iso + 'T00:00:00')
  return d.getDay() === closedWeekday || closedDates.includes(iso)
}

/** Busca la próxima fecha disponible a partir de (pero sin incluir) `fromIso` */
function getNextAvailableDate(
  fromIso: string,
  closedWeekday: number,
  closedDates: string[],
  maxDays: number,
): string {
  const base = new Date(fromIso + 'T00:00:00')
  for (let i = 1; i <= maxDays; i++) {
    const d = addDays(base, i)
    const iso = format(d, 'yyyy-MM-dd')
    if (!isDateClosed(iso, closedWeekday, closedDates)) return iso
  }
  return fromIso // fallback extremo
}

export default function ReservationPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { mutateAsync: createReservation, isPending } = useCreateReservation()
  const setPendingReservation = useReservationStore((s) => s.setPendingReservation)
  const { data: bizSettings } = useBusinessSettings()
  const [serverError, setServerError] = useState<string | null>(null)
  const qc = useQueryClient()

  // Sincronización en tiempo real: cuando el admin guarda cambios en horarios,
  // esta página se actualiza automáticamente sin refrescar.
  useEffect(() => {
    const channel = supabase
      .channel('reservation-page-settings-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'business_settings', filter: 'id=eq.1' },
        () => { qc.invalidateQueries({ queryKey: ['business-settings'] }) },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [qc])

  const schema = useMemo(() => getReservationSchema(), [i18n.language])

  const initialDate = useMemo(() => {
    const raw = searchParams.get('date')
    const today = format(new Date(), 'yyyy-MM-dd')
    const maxIso = format(new Date(Date.now() + MAX_ADVANCE_DAYS * 86400_000), 'yyyy-MM-dd')
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw >= today && raw <= maxIso) {
      return raw
    }
    return today
  }, [searchParams])

  const [todayClosed, setTodayClosed] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceType:    'individual',
      numberOfPeople: 1,
      date:           initialDate,
    },
  })

  useEffect(() => {
    setValue('date', initialDate)
  }, [initialDate, setValue])

  // Cuando carga la configuración del negocio, verificar si el día actual
  // está cerrado y avanzar automáticamente al próximo día disponible.
  useEffect(() => {
    if (!bizSettings) return
    const cw = bizSettings.closedWeekday ?? 1
    const cd = bizSettings.closedDates ?? []

    const todayIso = format(new Date(), 'yyyy-MM-dd')
    const todayIsActuallyClosed = isDateClosed(todayIso, cw, cd)
    setTodayClosed(todayIsActuallyClosed)

    // Solo auto-avanzar si la fecha actualmente seleccionada está cerrada
    const currentDate = getValues('date') || todayIso
    if (isDateClosed(currentDate, cw, cd)) {
      const next = getNextAvailableDate(currentDate, cw, cd, MAX_ADVANCE_DAYS)
      setValue('date', next)
    }
  }, [bizSettings, getValues, setValue])

  const watchedPkg    = watch('packageId') as PackageId | undefined
  const watchedPeople = watch('numberOfPeople') ?? 1
  const watchedDate   = watch('date')
  const watchedTime   = watch('time') ?? null
  const pricing       = watchedPkg ? calculatePrice(watchedPkg, watchedPeople) : null

  const onSubmit = async (values: ReservationFormValues) => {
    setServerError(null)
    try {
      const reservation = await createReservation({
        ...values,
        serviceType: values.numberOfPeople >= DISCOUNT_MIN_PEOPLE ? 'grupal' : 'individual',
      })
      setPendingReservation(reservation)

      // Envío de confirmación de reserva (no bloquea la navegación si falla)
      receiptService.send(reservation.id, values.contactEmail).catch((e) =>
        console.warn('[ReservationPage] receipt send failed:', e)
      )

      navigate('/reservar/confirmacion')
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('reservation.errors.generic')
      if (/capacidad excedida/i.test(msg)) {
        setServerError(t('reservation.errors.capacity'))
      } else if (/horario .* no disponible/i.test(msg)) {
        setServerError(t('reservation.errors.invalidSlot'))
      } else {
        setServerError(msg)
      }
    }
  }

  const closedWeekday   = bizSettings?.closedWeekday   ?? 1
  const closedDates     = bizSettings?.closedDates     ?? []
  const activeTimeSlots = bizSettings?.activeTimeSlots ?? undefined

  return (
    <div className="container-app py-12 max-w-3xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-navy-900 tracking-wide uppercase">
          {t('reservation.pageTitle')}
        </h1>
        <p className="text-navy-500 mt-2">
          {t('reservation.pageSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ─── Clima del día seleccionado ──────────────────────────── */}
        <ClimaResumen fecha={watchedDate || null} />

        {/* ─── Aviso: hoy está cerrado ─────────────────────────────── */}
        {todayClosed && (
          <div className="panel-warning flex items-start gap-3 text-sm">
            <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold mb-0.5">Hoy no hay servicio</p>
              <p>El día de hoy está cerrado. Puedes reservar para los próximos días disponibles que se muestran a continuación.</p>
            </div>
          </div>
        )}

        {/* ─── Paso 1: Fecha y horario ─────────────────────────────── */}
        <Card className="border border-navy-100">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gold-400 text-navy-900 font-bold text-xs flex items-center justify-center">1</span>
                {t('reservation.step1')}
              </span>
            </CardTitle>
          </CardHeader>

          <div className="space-y-5">
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <DateSlotPicker
                  value={field.value || null}
                  onChange={(iso) => {
                    field.onChange(iso)
                    setValue('time', '') // Limpia la hora al cambiar fecha para forzar nueva selección
                  }}
                  closedWeekday={closedWeekday}
                  closedDates={closedDates}
                  error={errors.date?.message}
                />
              )}
            />

            <Controller
              name="time"
              control={control}
              render={({ field }) => (
                <TimeSlotPicker
                  date={watchedDate || null}
                  value={watchedTime}
                  onChange={field.onChange}
                  numberOfPeople={watchedPeople}
                  activeTimeSlots={activeTimeSlots}
                  error={errors.time?.message}
                />
              )}
            />
          </div>
        </Card>

        {/* ─── Paso 2: Paquete y personas ──────────────────────────── */}
        <Card className="border border-navy-100">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gold-400 text-navy-900 font-bold text-xs flex items-center justify-center">2</span>
                {t('reservation.step2')}
              </span>
            </CardTitle>
          </CardHeader>

          <div className="space-y-5">
            <div>
              <label className="label">
                {t('reservation.package')} <span className="text-pirate-500">*</span>
              </label>
              <div className="grid gap-3">
                {Object.values(PACKAGES).map((pkg) => (
                  <label
                    key={pkg.id}
                    className="flex items-center gap-3 p-3 border border-navy-200 rounded-lg cursor-pointer hover:border-gold-400 has-[:checked]:border-gold-500 has-[:checked]:bg-gold-50 transition-colors"
                  >
                    <input
                      type="radio"
                      value={pkg.id.toUpperCase().replace(/ /g, '_')}
                      {...register('packageId')}
                      className="accent-gold-500"
                    />
                    <span className="text-xl">{pkg.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-navy-900">{t(`packages.${pkg.id}.label`)}</p>
                      <p className="text-xs text-navy-500">{t(`packages.${pkg.id}.description`)}</p>
                    </div>
                    <span className="font-bold text-gold-700">{formatCurrency(pkg.pricePerPerson)}{t('reservation.perPerson')}</span>
                  </label>
                ))}
              </div>
              {errors.packageId && <p className="error-message">{errors.packageId.message}</p>}
            </div>

            <Input
              label={t('reservation.numberOfPeople')}
              type="number"
              required
              min={1}
              max={BOAT_CAPACITY}
              hint={t('reservation.peopleHint', { min: DISCOUNT_MIN_PEOPLE, capacity: BOAT_CAPACITY })}
              {...register('numberOfPeople', { valueAsNumber: true })}
              error={errors.numberOfPeople?.message}
            />
          </div>
        </Card>

        {/* ─── Paso 3: Datos de contacto ───────────────────────────── */}
        <Card className="border border-navy-100">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gold-400 text-navy-900 font-bold text-xs flex items-center justify-center">3</span>
                {t('reservation.step3')}
              </span>
            </CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label={t('reservation.fullName')}
              required
              placeholder={t('reservation.fullNamePlaceholder')}
              {...register('contactName')}
              error={errors.contactName?.message}
            />
            <Input
              label={t('reservation.phone')}
              required
              placeholder={t('reservation.phonePlaceholder')}
              {...register('contactPhone')}
              error={errors.contactPhone?.message}
            />
            <Input
              label="Correo electrónico"
              type="email"
              required
              placeholder="tu@correo.com"
              hint="Te enviaremos la confirmación de tu reserva"
              {...register('contactEmail')}
              error={errors.contactEmail?.message}
            />
            <Input
              label={t('reservation.notes')}
              placeholder={t('reservation.notesPlaceholder')}
              {...register('notes')}
              error={errors.notes?.message}
            />
          </div>
        </Card>

        {/* ─── Resumen de precio ──────────────────────────────────── */}
        {pricing && (
          <Card className="panel-dark">
            <h3 className="font-semibold mb-3 text-gold-400 font-display text-lg tracking-wide uppercase">
              {t('reservation.summary')}
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-navy-200">{t('reservation.subtotal')}</span>
                <span>{formatCurrency(pricing.subtotal)}</span>
              </div>
              {pricing.hasGroupDiscount && (
                <div className="flex justify-between text-gold-300">
                  <span>{t('reservation.groupDiscount')}</span>
                  <span>-{formatCurrency(pricing.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-white/20 pt-2 mt-2">
                <span>{t('reservation.total')}</span>
                <span className="text-gold-400">{formatCurrency(pricing.total)}</span>
              </div>
            </div>
          </Card>
        )}

        {serverError && (
          <div className="panel-danger flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm mb-1">{t('reservation.errors.title')}</p>
              <p className="text-sm">{serverError}</p>
            </div>
          </div>
        )}

        <Button type="submit" variant="accent" isLoading={isPending} className="w-full" size="lg">
          {t('reservation.submit')}
        </Button>
      </form>
    </div>
  )
}
