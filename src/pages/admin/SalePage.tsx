import { useParams, useNavigate } from 'react-router-dom'
import { Printer, CheckCircle, CreditCard, Banknote, ArrowLeft } from 'lucide-react'
import { useReservation } from '@features/reservations/hooks/useReservations'
import { useProcessPayment } from '@features/payments/hooks/usePayments'
import { formatCurrency, formatDate, formatTime } from '@utils/formatters'
import { PACKAGES } from '@constants/index'
import type { PackageId } from '@constants/index'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { StatusBadge } from '@components/ui/Badge'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { COMPANY } from '@constants/index'
import { useState } from 'react'

export default function SalePage() {
  const { reservationId } = useParams<{ reservationId: string }>()
  const navigate = useNavigate()
  const { data: reservation, isLoading } = useReservation(reservationId ?? '')
  const { mutateAsync: processPayment, isPending } = useProcessPayment()
  const [paid, setPaid] = useState(false)

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (!reservation) return <div className="text-center py-20 text-navy-500">Reservación no encontrada.</div>

  const pkg = PACKAGES[reservation.packageId as PackageId]
  const isPagada = reservation.status === 'pagada' || paid

  const handleConfirmCash = async () => {
    await processPayment({ reservationId: reservation.id, method: 'efectivo' })
    setPaid(true)
  }

  const handlePrint = () => window.print()

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-navy-500 hover:text-navy-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display font-bold text-navy-900">Comprobante de Venta</h1>
          {isPagada && (
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
          )}
        </div>

        {/* Comprobante */}
        <Card id="receipt" className="print:shadow-none border border-navy-100">
          {/* Encabezado comprobante */}
          <div className="text-center border-b border-navy-100 pb-5 mb-5">
            <p className="font-display font-bold text-xl text-navy-900">{COMPANY.name}</p>
            <p className="text-sm text-navy-500">{COMPANY.location}</p>
            <p className="text-sm text-navy-500">{COMPANY.phone}</p>
          </div>

          {isPagada && (
            <div className="flex items-center gap-2 bg-gold-50 border border-gold-300 rounded-lg p-3 mb-5 shadow-gold">
              <CheckCircle className="w-5 h-5 text-gold-600 shrink-0" />
              <p className="text-navy-900 font-semibold text-sm">Pago confirmado</p>
            </div>
          )}

          <div className="space-y-2 text-sm mb-6">
            <Row label="Nombre" value={reservation.contactName} />
            <Row label="Teléfono" value={reservation.contactPhone} />
            <Row label="Fecha del paseo" value={formatDate(reservation.date)} />
            <Row label="Hora" value={formatTime(reservation.time)} />
            <Row label="No. Personas" value={`${reservation.numberOfPeople}`} />
            <Row label="Paquete" value={`${pkg?.icon} ${pkg?.label}`} />
            <Row label="Tipo de servicio" value={reservation.serviceType} />
            <Row label="Estado" value={<StatusBadge status={reservation.status} />} />
            {reservation.paymentMethod && (
              <Row
                label="Método de pago"
                value={
                  <span className="flex items-center gap-1.5 capitalize">
                    {reservation.paymentMethod === 'tarjeta'
                      ? <CreditCard className="w-4 h-4" />
                      : <Banknote className="w-4 h-4" />}
                    {reservation.paymentMethod}
                  </span>
                }
              />
            )}
          </div>

          <div className="rope-divider pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-navy-600">
              <span>Subtotal</span><span>{formatCurrency(reservation.subtotal)}</span>
            </div>
            {reservation.discount > 0 && (
              <div className="flex justify-between text-gold-700 font-semibold">
                <span>Descuento grupal (10%)</span>
                <span>-{formatCurrency(reservation.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t border-navy-200 pt-2 mt-2">
              <span className="text-navy-900">TOTAL</span>
              <span className="text-gold-600">{formatCurrency(reservation.total)}</span>
            </div>
          </div>

          <p className="text-center text-xs text-navy-400 mt-6">
            Folio: <span className="font-mono text-navy-600">{reservation.id.slice(0, 8).toUpperCase()}</span>
          </p>
        </Card>

        {/* Acción de cobro (solo si pendiente) */}
        {!isPagada && (
          <Card className="mt-4 border border-navy-100">
            <p className="text-navy-600 text-sm mb-4">
              Confirma el pago en efectivo una vez que el cliente haya liquidado el monto total.
            </p>
            <div className="flex gap-3">
              <Button variant="accent" onClick={handleConfirmCash} isLoading={isPending} className="flex-1">
                <Banknote className="w-4 h-4" /> Confirmar Pago en Efectivo
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/pago/${reservation.id}`)}
                className="flex-1"
              >
                <CreditCard className="w-4 h-4" /> Cobrar con Tarjeta
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-navy-500">{label}</span>
      <span className="font-medium text-navy-900">{value}</span>
    </div>
  )
}
