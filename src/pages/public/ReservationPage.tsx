import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { reservationSchema, type ReservationFormValues } from '@utils/validators/reservation'
import { useCreateReservation } from '@features/reservations/hooks/useReservations'
import { useReservationStore } from '@app/store/reservationStore'
import { calculatePrice } from '@utils/pricing'
import { formatCurrency } from '@utils/formatters'
import { PACKAGES, DISCOUNT_MIN_PEOPLE } from '@constants/index'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Card, CardHeader, CardTitle } from '@components/ui/Card'
import type { PackageId } from '@constants/index'

export default function ReservationPage() {
  const navigate = useNavigate()
  const { mutateAsync: createReservation, isPending } = useCreateReservation()
  const setPendingReservation = useReservationStore((s) => s.setPendingReservation)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: { serviceType: 'individual', numberOfPeople: 1 },
  })

  const watchedPkg = watch('packageId') as PackageId | undefined
  const watchedPeople = watch('numberOfPeople') ?? 1
  const pricing = watchedPkg ? calculatePrice(watchedPkg, watchedPeople) : null

  const onSubmit = async (values: ReservationFormValues) => {
    const reservation = await createReservation({
      ...values,
      serviceType: values.numberOfPeople >= DISCOUNT_MIN_PEOPLE ? 'grupal' : 'individual',
    })
    setPendingReservation(reservation)
    navigate('/reservar/confirmacion')
  }

  return (
    <div className="container-app py-12 max-w-2xl">
      <h1 className="text-3xl font-display font-bold text-navy-900 mb-8 text-center">
        Hacer una Reservación
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Datos de contacto */}
        <Card>
          <CardHeader><CardTitle>Datos de Contacto</CardTitle></CardHeader>
          <div className="space-y-4">
            <Input
              label="Nombre completo"
              required
              placeholder="Ej. Juan Pérez"
              {...register('contactName')}
              error={errors.contactName?.message}
            />
            <Input
              label="Número de celular"
              required
              placeholder="638 123 4567"
              {...register('contactPhone')}
              error={errors.contactPhone?.message}
            />
          </div>
        </Card>

        {/* Fecha y hora */}
        <Card>
          <CardHeader><CardTitle>Fecha y Hora del Paseo</CardTitle></CardHeader>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha"
              type="date"
              required
              {...register('date')}
              error={errors.date?.message}
            />
            <Input
              label="Hora"
              type="time"
              required
              min="09:00"
              max="17:00"
              {...register('time')}
              error={errors.time?.message}
            />
          </div>
        </Card>

        {/* Paquete y personas */}
        <Card>
          <CardHeader><CardTitle>Paquete y Personas</CardTitle></CardHeader>
          <div className="space-y-4">
            <div>
              <label className="label">
                Paquete <span className="text-pirate-500">*</span>
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
                      <p className="font-medium text-sm text-navy-900">{pkg.label}</p>
                      <p className="text-xs text-navy-500">{pkg.description}</p>
                    </div>
                    <span className="font-bold text-gold-700">{formatCurrency(pkg.pricePerPerson)}/persona</span>
                  </label>
                ))}
              </div>
              {errors.packageId && <p className="error-message">{errors.packageId.message}</p>}
            </div>

            <Input
              label="Número de personas"
              type="number"
              required
              min={1}
              max={50}
              hint={`Grupos de ${DISCOUNT_MIN_PEOPLE}+ personas obtienen 10% de descuento`}
              {...register('numberOfPeople', { valueAsNumber: true })}
              error={errors.numberOfPeople?.message}
            />

            <Input
              label="Notas adicionales"
              placeholder="Alguna indicación especial..."
              {...register('notes')}
              error={errors.notes?.message}
            />
          </div>
        </Card>

        {/* Resumen de precio */}
        {pricing && (
          <Card className="panel-dark">
            <h3 className="font-semibold mb-3 text-gold-400 font-display text-lg">Resumen</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-navy-200">Subtotal</span>
                <span>{formatCurrency(pricing.subtotal)}</span>
              </div>
              {pricing.hasGroupDiscount && (
                <div className="flex justify-between text-gold-300">
                  <span>Descuento grupal (10%)</span>
                  <span>-{formatCurrency(pricing.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-white/20 pt-2 mt-2">
                <span>Total</span>
                <span className="text-gold-400">{formatCurrency(pricing.total)}</span>
              </div>
            </div>
          </Card>
        )}

        <Button type="submit" variant="accent" isLoading={isPending} className="w-full" size="lg">
          Enviar Reservación
        </Button>
      </form>
    </div>
  )
}
