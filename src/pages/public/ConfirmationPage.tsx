import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, Calendar, Users, Package, Phone, MessageCircle, Download, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useReservationStore } from '@app/store/reservationStore'
import { PACKAGES } from '@constants/index'
import { formatDate, formatTime, formatCurrency } from '@utils/formatters'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { useWhatsAppRedirect } from '@features/reservations/hooks/useWhatsAppRedirect'

export default function ConfirmationPage() {
  const { t } = useTranslation()
  const reservation = useReservationStore((s) => s.pendingReservation)
  const { redirectToWhatsApp } = useWhatsAppRedirect()
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  if (!reservation) {
    return (
      <div className="container-app py-16 text-center">
        <p className="text-navy-500 mb-4">{t('confirmation.noReservation')}</p>
        <Link to="/reservar"><Button>{t('confirmation.makeReservation')}</Button></Link>
      </div>
    )
  }

  const pkg = PACKAGES[reservation.packageId]

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      // Import dinámico para no aumentar el bundle principal
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,           // 2x para pantallas retina
        useCORS: true,
        logging: false,
      })
      const link = document.createElement('a')
      link.download = `comprobante-barco-pirata-${reservation.id.slice(0, 8)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Error generando comprobante:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="container-app py-12 max-w-lg">
      <div className="text-center mb-8 animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-100 border-4 border-gold-300 mb-4 shadow-gold">
          <CheckCircle className="w-12 h-12 text-gold-600" />
        </div>
        <h1 className="text-3xl font-display font-bold text-navy-900 mb-2">
          {t('confirmation.title')}
        </h1>
        <p className="text-navy-600">
          {t('confirmation.subtitle')}
        </p>
      </div>

      {/* ref en la Card para capturar solo ella */}
      <div ref={cardRef}>
        <Card className="animate-slide-up">
          {/* Encabezado del comprobante (visible en la imagen descargada) */}
          <div className="text-center mb-5 pb-4 border-b border-navy-100">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-gold-600 mb-0.5">Barco Pirata · Puerto Peñasco</p>
            <h2 className="font-semibold text-lg text-navy-900 m-0">{t('confirmation.detailTitle')}</h2>
          </div>

          <dl className="space-y-3">
            <InfoRow icon={<Phone className="w-4 h-4" />}    label={t('confirmation.fields.name')}    value={reservation.contactName} />
            <InfoRow icon={<Phone className="w-4 h-4" />}    label={t('confirmation.fields.phone')}   value={reservation.contactPhone} />
            <InfoRow icon={<Calendar className="w-4 h-4" />} label={t('confirmation.fields.date')}    value={formatDate(reservation.date)} />
            <InfoRow icon={<Calendar className="w-4 h-4" />} label={t('confirmation.fields.time')}    value={formatTime(reservation.time)} />
            <InfoRow icon={<Package className="w-4 h-4" />}  label={t('confirmation.fields.package')} value={`${pkg.icon} ${t(`packages.${pkg.id}.label`)}`} />
            <InfoRow
              icon={<Users className="w-4 h-4" />}
              label={t('confirmation.fields.people')}
              value={[
                reservation.adults   > 0 ? `${reservation.adults} adulto${reservation.adults !== 1 ? 's' : ''}`         : '',
                reservation.youth    > 0 ? `${reservation.youth} adolescente${reservation.youth !== 1 ? 's' : ''}`      : '',
                reservation.children > 0 ? `${reservation.children} niño${reservation.children !== 1 ? 's' : ''}`       : '',
                reservation.babies   > 0 ? `${reservation.babies} bebe${reservation.babies !== 1 ? 's' : ''}`           : '',
              ].filter(Boolean).join(' · ')}
            />
          </dl>

          <div className="mt-5 pt-4 border-t border-navy-100">
            <div className="flex justify-between font-bold text-lg">
              <span className="text-navy-900">{t('confirmation.totalPay')}</span>
              <span className="text-gold-600">{formatCurrency(reservation.total)}</span>
            </div>
          </div>

          {/* Aviso de pago */}
          <div className="mt-4 bg-gold-50 border border-gold-200 rounded-xl px-4 py-3 text-sm text-navy-700">
            El pago puede realizarse por <strong>transferencia bancaria</strong> o <strong>en la oficina</strong> el dia del paseo. Confirma tu reservacion por WhatsApp para recibir los datos.
          </div>

          <p className="text-xs text-center text-navy-400 mt-4">
            {t('confirmation.reservationId')} <code className="font-mono text-navy-600">{reservation.id}</code>
          </p>
        </Card>
      </div>

      {/* Botón guardar comprobante */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-navy-200 text-navy-500 text-[14px] font-semibold hover:border-navy-400 hover:text-navy-700 transition-colors disabled:opacity-50"
      >
        {downloading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando imagen…</>
          : <><Download className="w-4 h-4" /> Guardar comprobante como imagen</>
        }
      </button>

      <div className="mt-3 flex gap-3">
        <Link to="/" className="flex-1">
          <Button variant="outline" className="w-full">{t('confirmation.back')}</Button>
        </Link>
        <Button
          variant="accent"
          className="flex-1 w-full flex items-center justify-center gap-2"
          onClick={() => redirectToWhatsApp(reservation)}
        >
          <MessageCircle className="w-5 h-5" />
          {t('confirmation.whatsapp', 'Confirmar por WhatsApp')}
        </Button>
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
