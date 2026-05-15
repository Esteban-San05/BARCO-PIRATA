import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Banknote, CheckCircle, Mail, Building2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useReservation } from '@features/reservations/hooks/useReservations'
import { useProcessPayment } from '@features/payments/hooks/usePayments'
import { reservationService } from '@features/reservations/services/reservationService'
import { receiptService } from '@features/payments/services/receiptService'
import { PAYMENT_METHODS, type PaymentMethod } from '@constants/index'
import { formatCurrency } from '@utils/formatters'
import { Button } from '@components/ui/Button'
import { Card, CardHeader, CardTitle } from '@components/ui/Card'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'

// ════════════════════════════════════════════════════════════════════════
//   Validación de correo
// ════════════════════════════════════════════════════════════════════════
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ════════════════════════════════════════════════════════════════════════
//   Página de pago
//
//   El negocio cobra ÚNICAMENTE en el muelle (efectivo o transferencia).
//   No se procesan tarjetas en línea: cualquier flujo de "tarjeta" en el
//   cliente sería una simulación sin verificación del lado servidor y
//   permitiría marcar una reservación como "pagada" sin haber cobrado.
//
//   Esta página solo registra la INTENCIÓN de pago del cliente
//   (efectivo o transferencia) y queda en estado "confirmada".
//   El cobro real lo registra el staff desde /admin/venta/:id.
// ════════════════════════════════════════════════════════════════════════
export default function PaymentPage() {
  const { t } = useTranslation()
  const { reservationId } = useParams<{ reservationId: string }>()
  const { data: reservation, isLoading, isError, refetch } = useReservation(reservationId ?? '')
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHODS.EFECTIVO)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const { mutateAsync: processPayment, isPending: processing } = useProcessPayment()
  const navigate = useNavigate()

  // Pre-llena el correo si el cliente ya lo proporcionó al reservar
  useEffect(() => {
    if (reservation?.contactEmail) setEmail(reservation.contactEmail)
  }, [reservation?.contactEmail])

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (isError) return (
    <div className="container-app py-20 text-center">
      <p className="text-navy-500 mb-4">{t('payment.errorLoadingReservation')}</p>
      <button
        type="button"
        onClick={() => refetch()}
        className="px-4 py-2 rounded-lg bg-gold-400 text-navy-900 font-semibold text-sm"
      >
        {t('payment.retry')}
      </button>
    </div>
  )
  if (!reservation) return <div className="text-center py-20 text-navy-500">{t('payment.notFound')}</div>

  // Reservación cancelada — no se puede pagar
  if (reservation.status === 'cancelada') {
    return (
      <div className="container-app py-16 max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 border-4 border-red-200 mb-4">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-display font-bold text-navy-900 mb-2">{t('payment.reservationCancelled')}</h2>
        <p className="text-navy-500 mb-6">{t('payment.reservationCancelledDetail')}</p>
        <a href="/reservar" className="inline-block px-6 py-3 rounded-xl bg-gold-400 text-navy-900 font-bold text-sm">
          {t('payment.makeNewReservation')}
        </a>
      </div>
    )
  }

  if (reservation.status === 'pagada') {
    return (
      <div className="container-app py-16 max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-100 border-4 border-gold-300 mb-4 shadow-gold">
          <CheckCircle className="w-12 h-12 text-gold-600" />
        </div>
        <h2 className="text-2xl font-display font-bold text-navy-900 mb-2">{t('payment.paid')}</h2>
        <p className="text-navy-500 mb-6">{t('payment.paidSubtitle')}</p>
        <Button variant="accent" onClick={() => navigate(`/recibo/${reservation.id}`)}>
          {t('payment.viewReceipt')}
        </Button>
      </div>
    )
  }

  /**
   * Valida el correo. Si OK lo persiste en la reservación y devuelve true.
   * Si no, setea emailError y devuelve false.
   */
  const ensureEmail = async (): Promise<boolean> => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setEmailError(t('payment.email.errRequired'))
      return false
    }
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError(t('payment.email.errInvalid'))
      return false
    }
    setEmailError(null)
    try {
      await reservationService.updateEmail(reservation.id, trimmed)
      await refetch()
    } catch (e) {
      console.error('[PaymentPage.updateEmail]', e)
    }
    return true
  }

  /** Lanza la Edge Function. No bloquea navegación en caso de fallo. */
  const sendReceiptEmail = async () => {
    try {
      const result = await receiptService.send(reservation.id, email.trim().toLowerCase())
      if (!result.sent && !result.simulated) {
        console.warn('[PaymentPage] receipt not sent:', result.error)
      }
    } catch (e) {
      console.error('[PaymentPage.sendReceipt]', e)
    }
  }

  const handleConfirm = async () => {
    if (!(await ensureEmail())) return
    // IMPORTANTE: no marcamos como "pagada" — eso lo hace el staff en el muelle.
    // Aquí solo registramos la intención de pago y enviamos el comprobante.
    await processPayment({ reservationId: reservation.id, method })
    await sendReceiptEmail()
    navigate(`/recibo/${reservation.id}`)
  }

  return (
    <div className="container-app py-12 max-w-lg">
      <h1 className="text-3xl font-display font-bold text-navy-900 mb-8 text-center">
        {t('payment.title')}
      </h1>

      {/* Total */}
      <Card className="mb-6 panel-dark">
        <div className="flex justify-between items-center">
          <span className="text-navy-200">{t('payment.totalPay')}</span>
          <span className="text-3xl font-bold text-gold-400">{formatCurrency(reservation.total)}</span>
        </div>
      </Card>

      {/* Aviso: cobro en el muelle */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Pago en el muelle:</strong> el cobro se realiza al abordar.
        Aceptamos efectivo y transferencia. No se procesan tarjetas en línea.
      </div>

      {/* Correo obligatorio para recibo */}
      <Card className="mb-6">
        <CardHeader><CardTitle>{t('payment.email.title')}</CardTitle></CardHeader>
        <p className="text-navy-600 mb-3 text-sm">{t('payment.email.description')}</p>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t('payment.email.placeholder')}
            className="input-field pl-10"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
            aria-invalid={emailError ? 'true' : 'false'}
          />
        </div>
        {emailError && (
          <p className="text-sm text-pirate-600 bg-pirate-50 border border-pirate-200 rounded-lg px-3 py-2 mt-3">
            {emailError}
          </p>
        )}
      </Card>

      {/* Selector de método */}
      <Card className="mb-6">
        <CardHeader><CardTitle>{t('payment.method')}</CardTitle></CardHeader>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: PAYMENT_METHODS.EFECTIVO,      icon: Banknote,  label: t('payment.cash') },
            { value: PAYMENT_METHODS.TRANSFERENCIA, icon: Building2, label: 'Transferencia' },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setMethod(value)}
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

      {/* Confirmar */}
      <Card>
        <p className="text-navy-600 mb-4 text-sm">
          {method === PAYMENT_METHODS.EFECTIVO
            ? t('payment.cashInfo')
            : 'Te enviaremos los datos bancarios al correo registrado.'}
        </p>
        <Button
          variant="accent"
          onClick={handleConfirm}
          isLoading={processing}
          className="w-full"
        >
          {t('payment.cashConfirm')}
        </Button>
      </Card>
    </div>
  )
}
