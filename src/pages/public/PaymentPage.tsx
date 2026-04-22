import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CreditCard, Banknote, CheckCircle, Lock, ShieldCheck,
  CalendarDays, User, Mail,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useReservation } from '@features/reservations/hooks/useReservations'
import { useProcessPayment } from '@features/payments/hooks/usePayments'
import { reservationService } from '@features/reservations/services/reservationService'
import { receiptService } from '@features/payments/services/receiptService'
import { PAYMENT_METHODS } from '@constants/index'
import { formatCurrency } from '@utils/formatters'
import { Button } from '@components/ui/Button'
import { Card, CardHeader, CardTitle } from '@components/ui/Card'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'

// ════════════════════════════════════════════════════════════════════════
//   Helpers tarjeta simulada
// ════════════════════════════════════════════════════════════════════════
function detectBrand(num: string): 'visa' | 'mastercard' | 'amex' | 'unknown' {
  const n = num.replace(/\s/g, '')
  if (/^4/.test(n)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard'
  if (/^3[47]/.test(n)) return 'amex'
  return 'unknown'
}
function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length < 3) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ════════════════════════════════════════════════════════════════════════
//   Página
// ════════════════════════════════════════════════════════════════════════
export default function PaymentPage() {
  const { t } = useTranslation()
  const { reservationId } = useParams<{ reservationId: string }>()
  const { data: reservation, isLoading, refetch } = useReservation(reservationId ?? '')
  const [method, setMethod] = useState<'efectivo' | 'tarjeta'>('efectivo')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const { mutateAsync: processPayment, isPending: processing } = useProcessPayment()
  const navigate = useNavigate()

  // Pre-llena el correo si el cliente ya lo proporcionó al reservar
  useEffect(() => {
    if (reservation?.contactEmail) setEmail(reservation.contactEmail)
  }, [reservation?.contactEmail])

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (!reservation) return <div className="text-center py-20 text-navy-500">{t('payment.notFound')}</div>

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

  const handleEfectivo = async () => {
    if (!(await ensureEmail())) return
    await processPayment({ reservationId: reservation.id, method: PAYMENT_METHODS.EFECTIVO })
    await sendReceiptEmail()
    // ⚠️ Recibo PÚBLICO — jamás a /admin
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
            { value: 'efectivo', icon: Banknote,   label: t('payment.cash') },
            { value: 'tarjeta',  icon: CreditCard, label: t('payment.card') },
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

      {/* Efectivo */}
      {method === 'efectivo' && (
        <Card>
          <p className="text-navy-600 mb-4 text-sm">{t('payment.cashInfo')}</p>
          <Button
            variant="accent"
            onClick={handleEfectivo}
            isLoading={processing}
            className="w-full"
          >
            {t('payment.cashConfirm')}
          </Button>
        </Card>
      )}

      {/* Tarjeta simulada */}
      {method === 'tarjeta' && (
        <SimulatedCardForm
          reservationId={reservation.id}
          total={reservation.total}
          ensureEmail={ensureEmail}
          sendReceiptEmail={sendReceiptEmail}
          onSuccess={() => navigate(`/recibo/${reservation.id}`)}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//   Formulario de tarjeta simulado (no Stripe)
// ════════════════════════════════════════════════════════════════════════
function SimulatedCardForm({
  reservationId, total, ensureEmail, sendReceiptEmail, onSuccess,
}: {
  reservationId: string
  total: number
  ensureEmail: () => Promise<boolean>
  sendReceiptEmail: () => Promise<void>
  onSuccess: () => void
}) {
  const { t } = useTranslation()
  const { mutateAsync: processPayment, isPending } = useProcessPayment()
  const [number, setNumber] = useState('')
  const [holder, setHolder] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)

  const brand = useMemo(() => detectBrand(number), [number])
  const brandLabel = {
    visa: 'VISA', mastercard: 'MASTERCARD', amex: 'AMEX', unknown: 'CARD',
  }[brand]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Valida correo antes que nada
    if (!(await ensureEmail())) {
      setError(t('payment.email.errInvalid'))
      return
    }

    const cleanNumber = number.replace(/\s/g, '')
    if (cleanNumber.length < 13) return setError(t('payment.card_form.errNumber'))
    if (!holder.trim())            return setError(t('payment.card_form.errHolder'))
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return setError(t('payment.card_form.errExpiry'))
    const [mmStr, yyStr] = expiry.split('/')
    const mm = Number(mmStr)
    const yy = Number(yyStr)
    if (mm < 1 || mm > 12) return setError(t('payment.card_form.errExpiry'))
    const now = new Date()
    const thisYY = now.getFullYear() % 100
    const thisMM = now.getMonth() + 1
    if (yy < thisYY || (yy === thisYY && mm < thisMM)) {
      return setError(t('payment.card_form.errExpired'))
    }
    if (!/^\d{3,4}$/.test(cvc)) return setError(t('payment.card_form.errCvc'))

    // Simula la latencia del banco
    setSimulating(true)
    await new Promise((r) => setTimeout(r, 1500))
    setSimulating(false)

    await processPayment({
      reservationId,
      method: 'tarjeta',
      stripePaymentMethodId: `sim_${Date.now()}_${brand}`,
    })
    await sendReceiptEmail()
    onSuccess()
  }

  const busy = isPending || simulating

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tarjeta visual */}
        <div className="relative rounded-2xl p-5 aspect-[1.6/1] bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 text-white shadow-card-lg overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gold-400/20 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-gold-500/10 blur-3xl" />
          <div className="relative flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div className="w-10 h-7 rounded bg-gradient-to-br from-gold-300 to-gold-500" />
              <span className="text-[10px] uppercase tracking-widest text-navy-200">
                {t('payment.card_form.chip')}
              </span>
            </div>
            <span className="text-sm font-bold tracking-wider text-gold-300">{brandLabel}</span>
          </div>
          <p className="relative mt-6 font-mono text-lg tracking-[0.25em] text-white/90">
            {number ? formatCardNumber(number) : '•••• •••• •••• ••••'}
          </p>
          <div className="relative mt-5 flex justify-between text-[11px]">
            <div>
              <p className="uppercase tracking-widest text-navy-300 mb-0.5">
                {t('payment.card_form.holderShort')}
              </p>
              <p className="font-semibold text-white/95 truncate max-w-[180px]">
                {holder || t('payment.card_form.holderPlaceholder').toUpperCase()}
              </p>
            </div>
            <div className="text-right">
              <p className="uppercase tracking-widest text-navy-300 mb-0.5">
                {t('payment.card_form.expShort')}
              </p>
              <p className="font-semibold text-white/95">{expiry || 'MM/AA'}</p>
            </div>
          </div>
        </div>

        {/* Número */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5">
            {t('payment.card_form.number')}
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
            <input
              className="input-field pl-10 font-mono tracking-wider"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              value={number}
              onChange={(e) => setNumber(formatCardNumber(e.target.value))}
              disabled={busy}
            />
          </div>
        </div>

        {/* Titular */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5">
            {t('payment.card_form.holder')}
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
            <input
              className="input-field pl-10"
              autoComplete="cc-name"
              placeholder={t('payment.card_form.holderPlaceholder')}
              value={holder}
              onChange={(e) => setHolder(e.target.value.toUpperCase())}
              disabled={busy}
            />
          </div>
        </div>

        {/* Exp / CVC */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5">
              {t('payment.card_form.expiry')}
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
              <input
                className="input-field pl-10 font-mono"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/AA"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                disabled={busy}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5">
              {t('payment.card_form.cvc')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
              <input
                className="input-field pl-10 font-mono"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                maxLength={4}
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                disabled={busy}
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-pirate-600 bg-pirate-50 border border-pirate-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button variant="accent" type="submit" className="w-full" isLoading={busy}>
          {simulating
            ? t('payment.card_form.processing')
            : t('payment.card_form.payAmount', { amount: formatCurrency(total) })}
        </Button>

        <div className="flex items-center justify-center gap-2 text-[11px] text-navy-400 pt-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{t('payment.card_form.securityNote')}</span>
        </div>
      </form>
    </Card>
  )
}
