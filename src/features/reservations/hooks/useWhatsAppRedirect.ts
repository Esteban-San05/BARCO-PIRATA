// ─── useWhatsAppRedirect.ts ───────────────────────────────────────────────────
// Hook que construye el link de WhatsApp con el mensaje prefabricado y redirige
// al cliente al finalizar el proceso de reservación.
//
// El mensaje usa el prefijo "RESERVA:<id>" que la Edge Function whatsapp-bot
// detecta para identificar la reservación automáticamente sin que el cliente
// tenga que escribir nada.

import { useCallback } from 'react'
import type { Reservation } from '@app-types/index'

// Número de WhatsApp del negocio (sin + ni espacios)
const WHATSAPP_BUSINESS_NUMBER = '526381104342' // TEMPORAL: número de prueba

interface UseWhatsAppRedirectReturn {
  redirectToWhatsApp: (reservation: Reservation) => void
  buildWhatsAppUrl: (reservation: Reservation) => string
}

export function useWhatsAppRedirect(): UseWhatsAppRedirectReturn {
  const buildWhatsAppUrl = useCallback((reservation: Reservation): string => {
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n)

    // Desglose de pasajeros
    const crew = [
      reservation.adults   > 0 ? `${reservation.adults} adulto${reservation.adults !== 1 ? 's' : ''}` : '',
      reservation.youth    > 0 ? `${reservation.youth} adolescente${reservation.youth !== 1 ? 's' : ''}` : '',
      reservation.children > 0 ? `${reservation.children} niño${reservation.children !== 1 ? 's' : ''}` : '',
      reservation.babies   > 0 ? `${reservation.babies} bebé${reservation.babies !== 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(', ')

    const message = [
      `*Nueva reservacion - Barco Pirata*`,
      ``,
      `*ID:* ${reservation.id}`,
      `*Nombre:* ${reservation.contactName}`,
      `*Telefono:* ${reservation.contactPhone}`,
      `*Fecha:* ${reservation.date}`,
      `*Hora:* ${reservation.time}`,
      `*Paquete:* ${reservation.packageId.replace(/_/g, ' ')}`,
      `*Tripulacion:* ${crew}`,
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
