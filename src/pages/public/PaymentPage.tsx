import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { CreditCard, Banknote, CheckCircle } from 'lucide-react'
import { stripePromise } from '@lib/stripe'
import { useReservation } from '@features/reservations/hooks/useReservations'
import { useProcessPayment, useCreateStripeIntent } from '@features/payments/hooks/usePayments'
import { PAYMENT_METHODS } from '@constants/index'
import { formatCurrency } from '@utils/formatters'
import { Button } from '@components/ui/Button'
import { Card, CardHeader, CardTitle } from '@components/ui/Card'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'

export default function PaymentPage() {
  const { reservationId } = useParams<{ reservationId: string }>()
  const { data: reservation, isLoading } = useReservation(reservationId ?? '')
  const [method, setMethod] = useState<'efectivo' | 'tarjeta'>('efectivo')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const { mutateAsync: createIntent, isPending: creatingIntent } = useCreateStripeIntent()
  const { mutateAsync: processPayment, isPending: processing } = useProcessPayment()
  const navigate = useNavigate()

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (!reservation) return <div className="text-center py-20 text-navy-500">Reservación no encontrada.</div>
  if (reservation.status === 'pagada') {
    return (
      <div className="container-app py-16 max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-100 border-4 border-gold-300 mb-4 shadow-gold">
          <CheckCircle className="w-12 h-12 text-gold-600" />
        </div>
        <h2 className="text-2xl font-display font-bold text-navy-900 mb-2">¡Ya está pagada!</h2>
        <p className="text-navy-500">Esta reservación ya fue procesada.</p>
      </div>
    )
  }

  const handleEfectivo = async () => {
    await processPayment({ reservationId: reservation.id, method: PAYMENT_METHODS.EFECTIVO })
    navigate(`/admin/venta/${reservation.id}`)
  }

  const handleCardSetup = async () => {
    const { clientSecret: cs } = await createIntent(reservation.id)
    setClientSecret(cs)
  }

  return (
    <div className="container-app py-12 max-w-lg">
      <h1 className="text-3xl font-display font-bold text-navy-900 mb-8 text-center">Completar Pago</h1>

      <Card className="mb-6 panel-dark">
        <div className="flex justify-between items-center">
          <span className="text-navy-200">Total a pagar</span>
          <span className="text-3xl font-bold text-gold-400">{formatCurrency(reservation.total)}</span>
        </div>
      </Card>

      {/* Selección de método */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Método de Pago</CardTitle></CardHeader>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'efectivo', icon: Banknote,    label: 'Efectivo' },
            { value: 'tarjeta',  icon: CreditCard,  label: 'Tarjeta' },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setMethod(value as typeof method)}
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-colors ${
                method === value
                  ? 'border-gold-500 bg-gold-50 text-navy-900'
                  : 'border-navy-200 text-navy-500 hover:border-navy-300'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="font-medium text-sm">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Pago efectivo */}
      {method === 'efectivo' && (
        <Card>
          <p className="text-navy-600 mb-4 text-sm">
            El pago se realizará directamente con el vendedor. Al confirmar, se generará el comprobante de venta.
          </p>
          <Button variant="accent" onClick={handleEfectivo} isLoading={processing} className="w-full">
            Confirmar Pago en Efectivo
          </Button>
        </Card>
      )}

      {/* Pago con tarjeta */}
      {method === 'tarjeta' && !clientSecret && (
        <Card>
          <p className="text-navy-600 mb-4 text-sm">
            Procesa el pago de forma segura con tu tarjeta de crédito o débito.
          </p>
          <Button variant="accent" onClick={handleCardSetup} isLoading={creatingIntent} className="w-full">
            Continuar con Tarjeta
          </Button>
        </Card>
      )}

      {method === 'tarjeta' && clientSecret && stripePromise && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <StripeCheckoutForm reservationId={reservation.id} />
        </Elements>
      )}
    </div>
  )
}

function StripeCheckoutForm({ reservationId }: { reservationId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const { mutateAsync: processPayment, isPending } = useProcessPayment()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setError(null)
    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (submitError) {
      setError(submitError.message ?? 'Error al procesar el pago')
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      await processPayment({
        reservationId,
        method: 'tarjeta',
        stripePaymentMethodId: paymentIntent.id,
      })
      navigate(`/admin/venta/${reservationId}`)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement />
        {error && <p className="error-message">{error}</p>}
        <Button variant="accent" type="submit" isLoading={isPending} className="w-full" disabled={!stripe}>
          Pagar ahora
        </Button>
      </form>
    </Card>
  )
}
