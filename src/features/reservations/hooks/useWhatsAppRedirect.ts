// ─── useWhatsAppRedirect.ts ───────────────────────────────────────────────────
// Hook que construye el link de WhatsApp con el mensaje prefabricado y redirige
// al cliente al finalizar el proceso de reservación.
//
// El mensaje muestra el desglose por paquete (igual que el ticket de
// confirmación): qué paquete, cuántas personas de cada tipo y su importe.

import { useCallback } from 'react'
import type { Reservation } from '@app-types/index'
import { PACKAGES } from '@constants/index'

// Número de WhatsApp del barco (formato internacional, sin + ni espacios)
const WHATSAPP_BUSINESS_NUMBER = '526381123686'

interface UseWhatsAppRedirectReturn {
  redirectToWhatsApp: (reservation: Reservation) => void
  buildWhatsAppUrl: (reservation: Reservation) => string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n)

const plural = (n: number, singular: string) => `${n} ${singular}${n !== 1 ? 's' : ''}`

/** Líneas del desglose por paquete, con el mismo detalle que el ticket de confirmación. */
function buildBreakdownLines(reservation: Reservation): string[] {
  const lines: string[] = []
  const breakdown = reservation.packageBreakdown

  if (breakdown?.length) {
    for (const item of breakdown) {
      const pkg   = PACKAGES[item.packageId]
      const icon  = pkg?.icon  ?? '🎫'
      const label = pkg?.label ?? item.packageId.replace(/_/g, ' ')
      lines.push(`${icon} *${label}* — ${fmt(item.total)}`)
      if (item.adults > 0)
        lines.push(`• ${plural(item.adults, 'adulto')} — ${fmt(item.adults * item.adultPrice)}`)
      if (item.youth > 0)
        lines.push(`• ${plural(item.youth, 'adolescente')} — ${fmt(item.youth * item.youthPrice)}`)
      if ((item.children ?? 0) > 0)
        lines.push(`• ${plural(item.children ?? 0, 'niño')} — ${fmt((item.children ?? 0) * (item.childrenPrice ?? 0))}`)
      lines.push('')
    }
  } else {
    // Fallback sin desglose: lista simple de tripulación
    const crew = [
      reservation.adults   > 0 ? plural(reservation.adults, 'adulto')     : '',
      reservation.youth    > 0 ? plural(reservation.youth, 'adolescente') : '',
      reservation.children > 0 ? plural(reservation.children, 'niño')     : '',
    ].filter(Boolean).join(', ')
    if (crew) lines.push(`${reservation.packageId.replace(/_/g, ' ')}: ${crew}`, '')
  }

  if (reservation.babies > 0) {
    lines.push(`🍼 *${plural(reservation.babies, 'bebé')}* — Gratis`)
  } else if (lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines
}

export function useWhatsAppRedirect(): UseWhatsAppRedirectReturn {
  const buildWhatsAppUrl = useCallback((reservation: Reservation): string => {
    const message = [
      `*Nueva reservacion - Barco Pirata*`,
      ``,
      `*ID:* ${reservation.id}`,
      `*Nombre:* ${reservation.contactName}`,
      `*Telefono:* ${reservation.contactPhone}`,
      `*Fecha:* ${reservation.date}`,
      `*Hora:* ${reservation.time}`,
      ``,
      `*Detalle de paquetes:*`,
      ``,
      ...buildBreakdownLines(reservation),
      ``,
      `*Total a pagar:* ${fmt(reservation.total)}`,
      ``,
      `_El pago puede realizarse por transferencia o en la oficina._`,
    ].join('\n')

    return `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(message)}`
  }, [])

  const redirectToWhatsApp = useCallback((reservation: Reservation): void => {
    const url = buildWhatsAppUrl(reservation)
    // Abre en nueva pestaña para no perder la sesión de la app
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [buildWhatsAppUrl])

  return { redirectToWhatsApp, buildWhatsAppUrl }
}
