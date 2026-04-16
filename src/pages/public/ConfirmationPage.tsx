import { Link } from 'react-router-dom'
import { CheckCircle, Calendar, Users, Package, Phone } from 'lucide-react'
import { useReservationStore } from '@app/store/reservationStore'
import { PACKAGES } from '@constants/index'
import { formatDate, formatTime, formatCurrency } from '@utils/formatters'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'

export default function ConfirmationPage() {
  const reservation = useReservationStore((s) => s.pendingReservation)

  if (!reservation) {
    return (
      <div className="container-app py-16 text-center">
        <p className="text-navy-500 mb-4">No hay reservación pendiente.</p>
        <Link to="/reservar"><Button>Hacer una reservación</Button></Link>
      </div>
    )
  }

  const pkg = PACKAGES[reservation.packageId]

  return (
    <div className="container-app py-12 max-w-lg">
      <div className="text-center mb-8 animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-100 border-4 border-gold-300 mb-4 shadow-gold">
          <CheckCircle className="w-12 h-12 text-gold-600" />
        </div>
        <h1 className="text-3xl font-display font-bold text-navy-900 mb-2">
          ¡Reservación Confirmada!
        </h1>
        <p className="text-navy-600">
          Hemos recibido tu solicitud. Un asesor la validará y te contactará para completar el pago.
        </p>
      </div>

      <Card className="animate-slide-up">
        <h2 className="font-semibold text-lg text-navy-900 mb-4">Detalle de tu Reservación</h2>
        <dl className="space-y-3">
          <InfoRow icon={<Phone className="w-4 h-4" />} label="Nombre" value={reservation.contactName} />
          <InfoRow icon={<Phone className="w-4 h-4" />} label="Celular" value={reservation.contactPhone} />
          <InfoRow icon={<Calendar className="w-4 h-4" />} label="Fecha" value={formatDate(reservation.date)} />
          <InfoRow icon={<Calendar className="w-4 h-4" />} label="Hora" value={formatTime(reservation.time)} />
          <InfoRow icon={<Users className="w-4 h-4" />} label="Personas" value={`${reservation.numberOfPeople} persona(s)`} />
          <InfoRow icon={<Package className="w-4 h-4" />} label="Paquete" value={`${pkg.icon} ${pkg.label}`} />
        </dl>

        <div className="mt-5 pt-4 border-t border-navy-100">
          <div className="flex justify-between text-sm text-navy-500 mb-1">
            <span>Subtotal</span><span>{formatCurrency(reservation.subtotal)}</span>
          </div>
          {reservation.discount > 0 && (
            <div className="flex justify-between text-sm text-gold-700 mb-1 font-semibold">
              <span>Descuento grupal</span><span>-{formatCurrency(reservation.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg mt-2">
            <span className="text-navy-900">Total a pagar</span>
            <span className="text-gold-600">{formatCurrency(reservation.total)}</span>
          </div>
        </div>

        <p className="text-xs text-center text-navy-400 mt-4">
          ID de reservación: <code className="font-mono text-navy-600">{reservation.id}</code>
        </p>
      </Card>

      <div className="mt-6 flex gap-3">
        <Link to="/" className="flex-1">
          <Button variant="outline" className="w-full">Volver al inicio</Button>
        </Link>
        <Link to={`/pago/${reservation.id}`} className="flex-1">
          <Button variant="accent" className="w-full">Ir a Pagar</Button>
        </Link>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gold-600">{icon}</span>
      <span className="text-navy-500 text-sm w-20 shrink-0">{label}</span>
      <span className="font-medium text-navy-900">{value}</span>
    </div>
  )
}
