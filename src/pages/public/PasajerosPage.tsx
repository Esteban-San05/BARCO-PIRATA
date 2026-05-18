import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react'
import { useReservation } from '@features/reservations/hooks/useReservations'
import { PassengerListEditor } from '@components/admin/PassengerListEditor'
import { Button } from '@components/ui/Button'

export default function PasajerosPage() {
  const { t } = useTranslation()
  const { reservationId } = useParams<{ reservationId: string }>()
  const { data: reservation, isLoading, isError } = useReservation(reservationId ?? '')

  if (isLoading) {
    return (
      <div className="container-app py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
      </div>
    )
  }

  if (isError || !reservation) {
    return (
      <div className="container-app py-16 max-w-lg text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">{t('passengers.notFound', 'Reservación no encontrada')}</h2>
        <p className="text-navy-500 mb-6">
          {t('passengers.notFoundHint', 'Verifica que el enlace sea correcto o contacta al negocio.')}
        </p>
        <Link to="/"><Button variant="outline">{t('confirmation.back', 'Volver al inicio')}</Button></Link>
      </div>
    )
  }

  if (reservation.status === 'cancelada') {
    return (
      <div className="container-app py-16 max-w-lg text-center">
        <p className="text-navy-500 mb-6">
          {t('passengers.cancelled', 'Esta reservación está cancelada y no requiere manifiesto de pasajeros.')}
        </p>
        <Link to="/"><Button variant="outline">{t('confirmation.back', 'Volver al inicio')}</Button></Link>
      </div>
    )
  }

  return (
    <div className="container-app py-10 max-w-lg">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        {t('confirmation.back', 'Volver al inicio')}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display mb-1" style={{ color: 'var(--text-title)' }}>
          {t('passengers.title', 'Lista de pasajeros')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('passengers.subtitle', 'Requerida por Capitanía del Puerto. Completa nombre y edad de todos los pasajeros.')}
        </p>
      </div>

      <PassengerListEditor
        reservationId={reservation.id}
        counts={{
          adults:   reservation.adults,
          youth:    reservation.youth,
          children: reservation.children,
          babies:   reservation.babies,
        }}
      />
    </div>
  )
}
