import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Printer, CheckCircle, Banknote, ArrowLeftRight,
  ArrowLeft, XCircle, Users, Hash, Pencil,
} from 'lucide-react'
import { useReservation, useCancelReservation } from '@features/reservations/hooks/useReservations'
import { useProcessPayment } from '@features/payments/hooks/usePayments'
import { formatCurrency, formatDate, formatTime } from '@utils/formatters'
import { PACKAGES, COMPANY } from '@constants/index'
import type { PackageId, PaymentMethod } from '@constants/index'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { StatusBadge } from '@components/ui/Badge'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { PassengerListEditor } from '@components/admin/PassengerListEditor'

export default function SalePage() {
  const { reservationId } = useParams<{ reservationId: string }>()
  const navigate = useNavigate()

  const { data: reservation, isLoading } = useReservation(reservationId ?? '')
  const { mutateAsync: processPayment, isPending }       = useProcessPayment()
  const { mutateAsync: cancelReservation, isPending: isCancelling } = useCancelReservation()

  const [paid, setPaid]                 = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelError, setCancelError]   = useState<string | null>(null)
  const [method, setMethod]             = useState<PaymentMethod>('efectivo')
  const [transRef, setTransRef]         = useState('')
  const [transRefError, setTransRefError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (!reservation) return <div className="text-center py-20 text-navy-500">Reservación no encontrada.</div>

  const pkg        = PACKAGES[reservation.packageId as PackageId]
  const isPagada   = reservation.status === 'pagada' || paid
  const isCancelada = reservation.status === 'cancelada'

  const handleConfirm = async () => {
    if (method === 'transferencia' && !transRef.trim()) {
      setTransRefError('Ingresa el número de referencia de la transferencia.')
      return
    }
    setTransRefError(null)
    setPaymentError(null)
    try {
      await processPayment({
        reservationId: reservation.id,
        method,
        adminConfirm: true,
        transferenciaReference: method === 'transferencia' ? transRef.trim() : undefined,
      })
      setPaid(true)
    } catch (e) {
      setPaymentError((e as Error)?.message ?? 'Error al registrar el pago. Intenta de nuevo.')
    }
  }

  const handlePrint = () => window.print()

  // ── Grupos de tripulación por paquete ─────────────────────────────────────
  const breakdown = reservation.packageBreakdown ?? []
  const hasBreakdown = breakdown.length > 0

  type PkgGroup = { packageId: string; icon: string; label: string; total: number; rows: { label: string; amount: number }[] }

  const pkgGroups: PkgGroup[] = []

  if (hasBreakdown) {
    for (const item of breakdown.filter(i => i.packageId !== 'NINOS')) {
      const itemPkg  = PACKAGES[item.packageId as PackageId]
      const adults   = item.adults    ?? 0
      const aPrice   = item.adultPrice ?? 0
      const youth    = item.youth     ?? 0
      const yPrice   = item.youthPrice ?? 0
      const rows: { label: string; amount: number }[] = []
      if (adults > 0) rows.push({ label: `${adults} adulto${adults !== 1 ? 's' : ''}`, amount: adults * aPrice })
      if (youth  > 0) rows.push({ label: `${youth} adolescente${youth !== 1 ? 's' : ''}`, amount: youth * yPrice })
      const groupTotal = adults * aPrice + youth * yPrice
      if (rows.length > 0)
        pkgGroups.push({ packageId: item.packageId, icon: itemPkg?.icon ?? '🎫', label: itemPkg?.label ?? item.packageId, total: groupTotal, rows })
    }
  } else {
    // Paquete único
    const rows: { label: string; amount: number }[] = []
    if (reservation.adults > 0) rows.push({ label: `${reservation.adults} adulto${reservation.adults !== 1 ? 's' : ''}`, amount: reservation.adultsCost })
    if (reservation.youth  > 0) rows.push({ label: `${reservation.youth} adolescente${reservation.youth !== 1 ? 's' : ''}`, amount: reservation.youthCost })
    pkgGroups.push({ packageId: reservation.packageId, icon: pkg?.icon ?? '🎫', label: pkg?.label ?? '', total: reservation.adultsCost + reservation.youthCost, rows })
  }

  // Niños: siempre desde reservation.children — independiente del breakdown
  if (reservation.children > 0) {
    const ninosPkg = PACKAGES['NINOS' as PackageId]
    pkgGroups.push({ packageId: 'NINOS', icon: ninosPkg?.icon ?? '🍕', label: ninosPkg?.label ?? 'Niños',
      total: reservation.childrenCost,
      rows: [{ label: `${reservation.children} niño${reservation.children !== 1 ? 's' : ''}`, amount: reservation.childrenCost }] })
  }

  // Label de paquete para el encabezado del comprobante
  const uniquePkgIds = hasBreakdown
    ? [...new Set(breakdown.filter(i => i.packageId !== 'NINOS').map(i => i.packageId as PackageId))]
    : [reservation.packageId as PackageId]
  const pkgLabel = uniquePkgIds.length > 1
    ? uniquePkgIds.map(id => `${PACKAGES[id]?.icon ?? ''} ${PACKAGES[id]?.label ?? id}`).join(' · ')
    : `${pkg?.icon ?? ''} ${pkg?.label ?? ''}`

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-navy-500 hover:text-navy-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <div className="max-w-2xl mx-auto px-1">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display font-bold text-navy-900">Comprobante de Venta</h1>
          <div className="flex gap-2">
            {!isCancelada && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/admin/editar/${reservation.id}`)}>
                <Pencil className="w-4 h-4" /> Editar
              </Button>
            )}
            {isPagada && (
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4" /> Imprimir
              </Button>
            )}
          </div>
        </div>

        {/* ── Comprobante ───────────────────────────────────────────────── */}
        <Card id="receipt" className="print:shadow-none border border-navy-100">

          {/* Encabezado */}
          <div className="text-center border-b border-navy-100 pb-5 mb-5">
            <p className="font-display font-bold text-xl text-navy-900">{COMPANY.name}</p>
            <p className="text-sm text-navy-500">{COMPANY.location}</p>
            <p className="text-sm text-navy-500">{COMPANY.phone}</p>
          </div>

          {isPagada && (
            <div className="flex items-center gap-2 bg-gold-50 border border-gold-300 rounded-lg p-3 mb-5 shadow-gold">
              <CheckCircle className="w-5 h-5 text-gold-600 shrink-0" />
              <div>
                <p className="text-navy-900 font-semibold text-sm">Pago confirmado</p>
                {reservation.paymentMethod === 'transferencia' && (
                  <p className="text-xs text-navy-500 mt-0.5">Transferencia bancaria</p>
                )}
              </div>
            </div>
          )}

          {/* Datos generales */}
          <div className="space-y-2 text-sm mb-5">
            <Row label="Nombre"         value={reservation.contactName} />
            <Row label="Teléfono"       value={reservation.contactPhone} />
            <Row label="Fecha del paseo" value={formatDate(reservation.date)} />
            <Row label="Hora"           value={formatTime(reservation.time)} />
            <Row label="Paquete"        value={pkgLabel} />
            <Row label="Tipo"           value={reservation.serviceType === 'grupal' ? 'Grupo' : 'Individual'} />
            <Row label="Estado"         value={<StatusBadge status={reservation.status} />} />
            {reservation.paymentMethod && (
              <Row
                label="Método de pago"
                value={
                  <span className="flex items-center gap-1.5 capitalize">
                    {reservation.paymentMethod === 'transferencia'
                      ? <ArrowLeftRight className="w-4 h-4" />
                      : <Banknote className="w-4 h-4" />}
                    {reservation.paymentMethod}
                  </span>
                }
              />
            )}
          </div>

          {/* Desglose de tripulación */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-gold-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-navy-400">Tripulación</span>
            </div>
            <div className="space-y-2">
              {pkgGroups.map(group => (
                <div key={group.packageId} className="rounded-xl border border-navy-100 overflow-hidden">
                  {/* Encabezado del paquete */}
                  <div className="flex items-center justify-between px-3 py-2.5 bg-navy-50">
                    <span className="font-semibold text-sm text-navy-800">
                      {group.icon} {group.label}
                    </span>
                    <span className="font-bold text-sm text-navy-900">{formatCurrency(group.total)}</span>
                  </div>
                  {/* Filas de pasajeros */}
                  {group.rows.map(row => (
                    <div key={row.label} className="flex items-center justify-between px-3 py-2 text-sm border-t border-navy-50">
                      <span className="text-navy-500">{row.label}</span>
                      <span className="font-medium text-navy-700">{formatCurrency(row.amount)}</span>
                    </div>
                  ))}
                </div>
              ))}
              {/* Bebés siempre fuera de grupos */}
              {reservation.babies > 0 && (
                <div className="flex items-center justify-between px-3 py-2.5 text-sm rounded-xl border border-navy-100">
                  <span className="font-medium text-navy-800">
                    🍼 {reservation.babies} bebé{reservation.babies !== 1 ? 's' : ''}
                  </span>
                  <span className="text-green-600 font-semibold">Gratis</span>
                </div>
              )}
            </div>
          </div>

          {/* Totales */}
          <div className="rope-divider pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-navy-600">
              <span>Subtotal</span>
              <span>{formatCurrency(reservation.subtotal)}</span>
            </div>
            {reservation.discount > 0 && (
              <div className="flex justify-between text-gold-700 font-semibold">
                <span>Descuento</span>
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

        {/* ── Manifiesto de pasajeros ───────────────────────────────────── */}
        {!isCancelada && (
          <PassengerListEditor
            reservationId={reservation.id}
            counts={{
              adults:   reservation.adults,
              youth:    reservation.youth,
              children: reservation.children,
              babies:   reservation.babies,
            }}
          />
        )}

        {/* ── Panel de cobro ────────────────────────────────────────────── */}
        {!isPagada && !isCancelada && (
          <Card className="mt-4 border border-navy-100">
            <p className="text-sm font-semibold text-navy-700 mb-4">Registrar pago</p>

            {/* Selector de método */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setMethod('efectivo'); setTransRefError(null) }}
                className={[
                  'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all',
                  method === 'efectivo'
                    ? 'border-gold-500 bg-gold-50 text-navy-900'
                    : 'border-navy-200 text-navy-500 hover:border-navy-300',
                ].join(' ')}
              >
                <Banknote className="w-4 h-4" /> Efectivo
              </button>
              <button
                type="button"
                onClick={() => { setMethod('transferencia'); setTransRefError(null) }}
                className={[
                  'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all',
                  method === 'transferencia'
                    ? 'border-gold-500 bg-gold-50 text-navy-900'
                    : 'border-navy-200 text-navy-500 hover:border-navy-300',
                ].join(' ')}
              >
                <ArrowLeftRight className="w-4 h-4" /> Transferencia
              </button>
            </div>

            {/* Info contextual + campo de referencia */}
            {method === 'efectivo' && (
              <p className="text-xs text-navy-500 mb-4 bg-navy-50 rounded-lg px-3 py-2.5">
                Confirma al recibir el efectivo del cliente en el muelle. Se marcará la reservación como pagada.
              </p>
            )}

            {method === 'transferencia' && (
              <div className="mb-4">
                <p className="text-xs text-navy-500 mb-3 bg-navy-50 rounded-lg px-3 py-2.5">
                  Verifica el comprobante de transferencia del cliente antes de confirmar.
                </p>
                <label className="block text-xs font-semibold text-navy-600 mb-1.5">
                  <Hash className="w-3.5 h-3.5 inline mr-1" />
                  Número de referencia / folio de transferencia
                </label>
                <input
                  type="text"
                  value={transRef}
                  onChange={(e) => { setTransRef(e.target.value); setTransRefError(null) }}
                  placeholder="Ej. 1234567890"
                  className={[
                    'input-field w-full text-sm',
                    transRefError ? 'border-red-400' : '',
                  ].join(' ')}
                />
                {transRefError && (
                  <p className="text-xs text-red-600 mt-1">{transRefError}</p>
                )}
              </div>
            )}

            <Button
              variant="accent"
              onClick={handleConfirm}
              isLoading={isPending}
              className="w-full"
            >
              {method === 'efectivo'
                ? <><Banknote className="w-4 h-4" /> Confirmar pago en efectivo</>
                : <><ArrowLeftRight className="w-4 h-4" /> Confirmar transferencia</>
              }
            </Button>

            {paymentError && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <p className="text-sm text-red-700">{paymentError}</p>
                <button
                  type="button"
                  onClick={() => setPaymentError(null)}
                  className="text-red-400 hover:text-red-600 font-bold shrink-0"
                >✕</button>
              </div>
            )}
          </Card>
        )}

        {/* ── Error de cancelación ──────────────────────────────────────── */}
        {cancelError && (
          <Card className="mt-4 border border-red-200 bg-red-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-700">{cancelError}</p>
              <button
                type="button"
                onClick={() => setCancelError(null)}
                className="text-red-400 hover:text-red-600 ml-3 font-bold"
              >✕</button>
            </div>
          </Card>
        )}

        {/* ── Cancelar reservación ──────────────────────────────────────── */}
        {!isPagada && !isCancelada && (
          <Card className="mt-4 border border-red-100 bg-red-50">
            {!confirmCancel ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">Cancelar reservación</p>
                  <p className="text-xs text-red-500 mt-0.5">Esta acción quedará registrada en la bitácora.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmCancel(true)}
                  className="border-red-300 text-red-600 hover:bg-red-100"
                >
                  <XCircle className="w-4 h-4" /> Cancelar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-red-700">¿Confirmas la cancelación?</p>
                <p className="text-xs text-red-500">Se marcará como cancelada y no podrá revertirse desde aquí.</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmCancel(false)}
                    className="flex-1"
                  >
                    No, volver
                  </Button>
                  <Button
                    size="sm"
                    isLoading={isCancelling}
                    onClick={async () => {
                      try {
                        await cancelReservation(reservation.id)
                        setConfirmCancel(false)
                        navigate(-1)
                      } catch (e) {
                        setCancelError((e as Error)?.message ?? 'Error al cancelar')
                        setConfirmCancel(false)
                      }
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                  >
                    Sí, cancelar
                  </Button>
                </div>
              </div>
            )}
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
