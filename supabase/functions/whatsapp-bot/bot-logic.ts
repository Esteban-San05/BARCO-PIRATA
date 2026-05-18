// ─── bot-logic.ts ─────────────────────────────────────────────────────────────
// Lógica principal del chatbot: detección de idioma, manejo de intenciones,
// construcción de respuestas bilingüe (ES / EN).
// Solo reservaciones — NO procesa pagos.

import { sendTextMessage, sendButtonMessage, sendListMessage, markAsRead } from './meta-api.ts'
import {
  getReservationByPhone,
  confirmReservation,
  requestCancellation,
  getBusinessSettings,
  getManifestStatus,
  getSession,
  getSessionIfExists,
  updateSession,
  type BusinessSettings,
  type PackageOverrideData,
  type PromotionItem,
  type Reservation,
} from './db.ts'

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface IncomingMessage {
  from: string          // número del cliente (ej: 526381234567)
  messageId: string
  text?: string         // texto libre
  buttonReplyId?: string // id del botón pulsado
  listReplyId?: string   // id del ítem de lista seleccionado
  timestamp: string
}

// ─── Nombres de paquetes ──────────────────────────────────────────────────────
const PKG_NAMES: Record<string, { es: string; en: string }> = {
  con_comida:   { es: '🍽️ Cena y Barra Libre',     en: '🍽️ Dinner & Open Bar' },
  solo_bebidas: { es: '🍹 Barra Libre',              en: '🍹 Open Bar' },
  ninos:        { es: '🧒 Paquete Niños',           en: '🧒 Kids Package' },
}

// ─── Defaults de paquetes (espejo de src/constants/index.ts:PACKAGES) ─────────
// Usados cuando business_settings no tiene override o no se puede leer.
// Las claves coinciden con las del JSONB package_overrides (UPPERCASE).
const DEFAULT_PKGS_ORDER = ['CON_COMIDA', 'SOLO_BEBIDAS', 'NINOS'] as const
const DEFAULT_PKGS: Record<string, PackageOverrideData> = {
  CON_COMIDA:   { label: 'Cena y Barra Libre', icon: '🍽️', adultPrice: 700, youthPrice: 500, description: '', active: true, isCustom: false },
  SOLO_BEBIDAS: { label: 'Barra Libre',         icon: '🍹', adultPrice: 600, youthPrice: 400, description: '', active: true, isCustom: false },
  NINOS:        { label: 'Paquete Niños',       icon: '🧒', adultPrice: 300, youthPrice: 300, description: '', active: true, isCustom: false },
}
const DEFAULT_CLOSED_WEEKDAYS = [1] // lunes
const DEFAULT_TIME_SLOTS = ['09:00', '11:00', '13:00', '15:00', '17:00']
const DEFAULT_CAPACITY = 40

const WEEKDAY_NAMES: Record<'es' | 'en', string[]> = {
  es: ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'],
  en: ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'],
}

function joinList(items: string[], lang: 'es' | 'en'): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  const conj = lang === 'es' ? ' y ' : ' and '
  return items.slice(0, -1).join(', ') + conj + items[items.length - 1]
}

function formatClosedDays(closed: number[], lang: 'es' | 'en'): string {
  if (closed.length === 0) {
    return lang === 'es' ? 'Operamos *todos los días*.' : 'We operate *every day*.'
  }
  // ordenar 0..6 y mapear a nombres
  const names = [...closed].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[lang][d] ?? '')
  if (lang === 'es') return `Cerrado los *${joinList(names, 'es')}*.`
  return `Closed on *${joinList(names, 'en')}*.`
}

// ─── Detección de idioma ──────────────────────────────────────────────────────
function detectLang(text: string): 'es' | 'en' {
  const lower = text.toLowerCase()
  // Palabras completas — evita falsos positivos como "cancelar" ⊃ "cancel"
  const tokens = new Set(lower.split(/\W+/).filter(Boolean))
  const enWords = ['hello', 'hi', 'book', 'reservation', 'cancel', 'help', 'info', 'status', 'what', 'how', 'when', 'where', 'price', 'cost', 'ticket', 'reschedule']
  const enScore = enWords.filter((w) => tokens.has(w)).length
  return enScore >= 1 ? 'en' : 'es'
}

// ─── Formateo de fecha / hora ─────────────────────────────────────────────────
function formatDate(dateStr: string, lang: 'es' | 'en'): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatTime(timeStr: string): string {
  // timeStr: "09:00:00" → "9:00 AM"
  const [h, min] = timeStr.split(':').map(Number)
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${min.toString().padStart(2, '0')} ${suffix}`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)
}

// ─── Textos bilingüe ──────────────────────────────────────────────────────────
const T = {
  welcome: {
    es: (name: string) => `¡Hola, *${name}*! 👋 Soy el asistente del *🏴‍☠️ Barco Pirata Puerto Peñasco*.\n\n¿En qué puedo ayudarte hoy?`,
    en: (name: string) => `Hello, *${name}*! 👋 I'm the assistant for *🏴‍☠️ Barco Pirata Puerto Peñasco*.\n\nHow can I help you today?`,
  },
  welcomeNoReservation: {
    es: `¡Hola! 👋 Soy el asistente del *🏴‍☠️ Barco Pirata Puerto Peñasco*.\n\nNo encontré una reservación asociada a tu número. Puedes hacer una reservación en nuestra página web.\n\n¿Puedo ayudarte con algo más?`,
    en: `Hello! 👋 I'm the assistant for *🏴‍☠️ Barco Pirata Puerto Peñasco*.\n\nI couldn't find a reservation linked to your number. You can make a reservation on our website.\n\nIs there anything else I can help you with?`,
  },
  reservationSummary: {
    es: (r: Reservation) =>
      `✅ *Tu reservación está registrada:*\n\n` +
      `📋 *ID:* \`${r.id.slice(0, 8).toUpperCase()}\`\n` +
      `👤 *Nombre:* ${r.contact_name}\n` +
      `📅 *Fecha:* ${formatDate(r.date, 'es')}\n` +
      `⏰ *Hora:* ${formatTime(r.time)}\n` +
      `👥 *Personas:* ${r.number_of_people}\n` +
      `🎟️ *Paquete:* ${PKG_NAMES[r.package_id]?.es ?? r.package_id}\n` +
      `💰 *Total:* ${formatCurrency(r.total)}\n\n` +
      `Estado actual: *${statusLabel(r.status, 'es')}*`,
    en: (r: Reservation) =>
      `✅ *Your reservation is registered:*\n\n` +
      `📋 *ID:* \`${r.id.slice(0, 8).toUpperCase()}\`\n` +
      `👤 *Name:* ${r.contact_name}\n` +
      `📅 *Date:* ${formatDate(r.date, 'en')}\n` +
      `⏰ *Time:* ${formatTime(r.time)}\n` +
      `👥 *People:* ${r.number_of_people}\n` +
      `🎟️ *Package:* ${PKG_NAMES[r.package_id]?.en ?? r.package_id}\n` +
      `💰 *Total:* ${formatCurrency(r.total)}\n\n` +
      `Current status: *${statusLabel(r.status, 'en')}*`,
  },
  menuButtons: {
    es: [
      { id: 'btn_status',   title: '📋 Mi reservación' },
      { id: 'btn_faq',      title: '❓ Preguntas frecuentes' },
      { id: 'btn_cancel',   title: '❌ Cancelar reservación' },
    ],
    en: [
      { id: 'btn_status',   title: '📋 My reservation' },
      { id: 'btn_faq',      title: '❓ FAQ' },
      { id: 'btn_cancel',   title: '❌ Cancel reservation' },
    ],
  },
  menuPrompt: {
    es: '¿Qué deseas hacer?',
    en: 'What would you like to do?',
  },
  faqList: {
    es: {
      header: '❓ Preguntas Frecuentes',
      prompt: 'Elige un tema:',
      button: 'Ver preguntas',
      sections: [
        {
          title: 'Información general',
          rows: [
            { id: 'faq_schedule',  title: '🕒 Horarios',          description: '¿A qué hora salen los tours?' },
            { id: 'faq_location',  title: '📍 Ubicación',          description: '¿Dónde abordo el barco?' },
            { id: 'faq_capacity',  title: '👥 Capacidad',          description: '¿Cuántas personas caben?' },
            { id: 'faq_packages',  title: '🎟️ Paquetes y precios', description: '¿Qué incluye cada paquete?' },
          ],
        },
        {
          title: 'Políticas',
          rows: [
            { id: 'faq_kids',       title: '👶 Niños',        description: '¿Pueden ir menores de edad?' },
            { id: 'faq_weather',    title: '🌧️ Clima',        description: '¿Qué pasa si hay mal tiempo?' },
            { id: 'faq_discount',   title: '💸 Descuentos',   description: '¿Hay descuento por grupo?' },
            { id: 'faq_reschedule', title: '📅 Reagendar',    description: '¿Puedo cambiar mi fecha?' },
          ],
        },
      ],
    },
    en: {
      header: '❓ Frequently Asked Questions',
      prompt: 'Choose a topic:',
      button: 'See questions',
      sections: [
        {
          title: 'General info',
          rows: [
            { id: 'faq_schedule',  title: '🕒 Schedule',        description: 'What time do the tours depart?' },
            { id: 'faq_location',  title: '📍 Location',         description: 'Where do I board the ship?' },
            { id: 'faq_capacity',  title: '👥 Capacity',         description: 'How many people fit on the boat?' },
            { id: 'faq_packages',  title: '🎟️ Packages & prices', description: 'What does each package include?' },
          ],
        },
        {
          title: 'Policies',
          rows: [
            { id: 'faq_kids',       title: '👶 Children',    description: 'Can children attend?' },
            { id: 'faq_weather',    title: '🌧️ Weather',     description: 'What if there is bad weather?' },
            { id: 'faq_discount',   title: '💸 Discounts',   description: 'Are there group discounts?' },
            { id: 'faq_reschedule', title: '📅 Reschedule',  description: 'Can I change my date?' },
          ],
        },
      ],
    },
  },
  faqAnswers: {
    faq_location: {
      es: '📍 *Ubicación:* Recinto Portuario, Puerto Peñasco, Sonora.\n\nNos encontramos en el muelle principal. Llega 15 minutos antes de tu salida.',
      en: '📍 *Location:* Recinto Portuario, Puerto Peñasco, Sonora.\n\nWe are at the main dock. Please arrive 15 minutes before your departure.',
    },
    faq_kids: {
      es: '👥 *Tipos de pasajero y precios:*\n\n👨‍👩‍👧 *Adultos* (18+ años) — precio completo del paquete\n🧑 *Adolescentes* (12–17 años) — precio reducido por paquete\n🧒 *Niños* (3–11 años) — $300 (agua, sodas y pizza)\n👶 *Bebés* (menores de 3 años) — *Gratis* 🎉\n\nTodos los menores deben ir acompañados de un adulto responsable.',
      en: '👥 *Passenger types and pricing:*\n\n👨‍👩‍👧 *Adults* (18+ yrs) — full package price\n🧑 *Teens* (12–17 yrs) — reduced price per package\n🧒 *Children* (3–11 yrs) — $300 (water, sodas & pizza)\n👶 *Babies* (under 3 yrs) — *Free* 🎉\n\nAll minors must be accompanied by a responsible adult.',
    },
    faq_weather: {
      es: '🌧️ *Mal tiempo:* Si las condiciones climáticas no son seguras para navegar, cancelamos el tour y te avisamos con anticipación para reagendar tu reservación sin costo.',
      en: '🌧️ *Bad weather:* If weather conditions are unsafe for sailing, we cancel the tour and notify you in advance so you can reschedule at no extra cost.',
    },
    faq_discount: {
      es: '💸 *Descuento grupal:* Grupos de 5 o más personas reciben un *10% de descuento* automático en el total.\n\nEl descuento se aplica al hacer tu reservación en línea.',
      en: '💸 *Group discount:* Groups of 5 or more people automatically receive a *10% discount* on the total.\n\nThe discount is applied when booking online.',
    },
    faq_reschedule: {
      es: '📅 *Reagendar tu reservación:*\n\nPuedes solicitar un cambio de fecha sin costo adicional, sujeto a disponibilidad.\n\nEscribe *reagendar* aquí y uno de nuestros agentes te contactará para coordinar la nueva fecha.',
      en: '📅 *Reschedule your reservation:*\n\nYou can request a date change at no extra cost, subject to availability.\n\nType *reschedule* here and one of our agents will contact you to arrange the new date.',
    },
  } as Record<string, { es: string; en: string }>,
  cancelConfirm: {
    es: (r: Reservation) =>
      `¿Estás seguro de que deseas cancelar tu reservación del *${formatDate(r.date, 'es')}* a las *${formatTime(r.time)}*?\n\nEsta acción la revisará nuestro equipo.`,
    en: (r: Reservation) =>
      `Are you sure you want to cancel your reservation on *${formatDate(r.date, 'en')}* at *${formatTime(r.time)}*?\n\nOur team will review this request.`,
  },
  cancelButtons: {
    es: [
      { id: 'btn_cancel_yes', title: '✅ Sí, cancelar' },
      { id: 'btn_cancel_no',  title: '❌ No, mantener' },
    ],
    en: [
      { id: 'btn_cancel_yes', title: '✅ Yes, cancel' },
      { id: 'btn_cancel_no',  title: '❌ No, keep it' },
    ],
  },
  cancelDone: {
    es: '✅ Tu solicitud de cancelación ha sido registrada. Nuestro equipo la revisará pronto y te confirmará por este medio.',
    en: '✅ Your cancellation request has been registered. Our team will review it soon and confirm here.',
  },
  cancelAborted: {
    es: '👍 Tu reservación sigue activa. ¡Te esperamos a bordo!',
    en: '👍 Your reservation is still active. We look forward to seeing you on board!',
  },
  noReservationForAction: {
    es: 'No encontré una reservación activa asociada a tu número de WhatsApp. Si crees que es un error, contáctanos directamente.',
    en: "I couldn't find an active reservation linked to your WhatsApp number. If you think this is an error, please contact us directly.",
  },
  alreadyCancelled: {
    es: '❌ Tu reservación ya está cancelada. Si fue un error, contáctanos directamente para reactivarla.',
    en: '❌ Your reservation is already cancelled. If this was a mistake, please contact us directly to reactivate it.',
  },
  rescheduleRequested: {
    es: '📅 Solicitud de reagendado registrada. Nuestro equipo revisará la disponibilidad y te contactará pronto para confirmar tu nueva fecha.',
    en: '📅 Reschedule request registered. Our team will check availability and contact you soon to confirm your new date.',
  },
  rescheduleNoReservation: {
    es: 'No encontré una reservación activa para reagendar. Si crees que es un error, contáctanos directamente.',
    en: "I couldn't find an active reservation to reschedule. If you think this is an error, please contact us directly.",
  },
  fallback: {
    es: 'No entendí tu mensaje 😅. Puedo ayudarte con:\n• Tu reservación\n• Preguntas frecuentes\n• Cancelar una reservación\n\nEscribe *menú* para ver las opciones.',
    en: "I didn't understand your message 😅. I can help you with:\n• Your reservation\n• Frequently asked questions\n• Canceling a reservation\n\nType *menu* to see the options.",
  },
  confirmed: {
    es: '✅ ¡Tu reservación ha sido confirmada! Te esperamos a bordo. ⚓',
    en: '✅ Your reservation has been confirmed! We look forward to seeing you on board. ⚓',
  },
  manifestIncomplete: {
    es: (filled: number, required: number, url: string) =>
      `⚠️ *Lista de pasajeros incompleta* (${filled}/${required})\n\nCapitanía del Puerto requiere nombre y edad de todos los pasajeros antes de zarpar.\n\nComplétala aquí 👇\n${url}`,
    en: (filled: number, required: number, url: string) =>
      `⚠️ *Passenger list incomplete* (${filled}/${required})\n\nPort Authority requires name and age for all passengers before departure.\n\nComplete it here 👇\n${url}`,
  },
}

// ─── Generadores de FAQ dinámicos (leen business_settings) ───────────────────

function buildScheduleAnswer(settings: BusinessSettings | null, lang: 'es' | 'en'): string {
  const slots  = settings?.active_time_slots?.length ? settings.active_time_slots : DEFAULT_TIME_SLOTS
  const closed = settings?.closed_weekdays ?? DEFAULT_CLOSED_WEEKDAYS
  const bullets = slots.map((t) => `• ${formatTime(t.length === 5 ? `${t}:00` : t)}`).join('\n')
  const header = lang === 'es' ? '🕒 *Horarios de salida:*' : '🕒 *Departure times:*'
  return `${header}\n${bullets}\n\n${formatClosedDays(closed, lang)}`
}

function isPromotionActive(p: PromotionItem, today: string): boolean {
  if (!p.active) return false
  if (p.startDate && today < p.startDate) return false
  if (p.endDate   && today > p.endDate)   return false
  return true
}

function buildPackagesAnswer(settings: BusinessSettings | null, lang: 'es' | 'en'): string {
  const overrides = settings?.package_overrides ?? {}
  const promotions = settings?.promotions ?? []

  // Builtins (CON_COMIDA, SOLO_BEBIDAS, NINOS) merge override on top of default
  const builtinKeys = DEFAULT_PKGS_ORDER.filter((k) => (overrides[k]?.active ?? true) !== false)
  const customKeys  = Object.keys(overrides).filter((k) => !(k in DEFAULT_PKGS) && overrides[k].active)

  const renderPkg = (key: string): string => {
    const def = DEFAULT_PKGS[key]
    const ovr = overrides[key]
    const label = ovr?.label      ?? def?.label      ?? key
    const icon  = ovr?.icon       ?? def?.icon       ?? '🎟️'
    const price = ovr?.adultPrice ?? def?.adultPrice ?? 0
    const unit  = lang === 'es' ? '/adulto' : '/adult'
    return `${icon} *${label}* — $${price}${unit}`
  }

  const lines = [...builtinKeys, ...customKeys].map(renderPkg).join('\n\n')

  // Promociones activas hoy
  const today = new Date().toISOString().slice(0, 10)
  const activePromos = promotions.filter((p) => isPromotionActive(p, today))
  const promoBlock = activePromos.length
    ? '\n\n💸 *' + (lang === 'es' ? 'Promociones activas:' : 'Active promotions:') + '*\n' +
      activePromos.map((p) => {
        const value = p.discountType === 'percentage' ? `${p.discountValue}%` : `$${p.discountValue}`
        const min = lang === 'es' ? `desde ${p.minPeople} personas` : `from ${p.minPeople} people`
        return `• ${p.name} — ${value} (${min})`
      }).join('\n')
    : ''

  const header  = lang === 'es' ? '🎟️ *Paquetes disponibles:*' : '🎟️ *Available packages:*'
  const payment = lang === 'es'
    ? '\n\n💳 *Pago:* efectivo o transferencia en el muelle.'
    : '\n\n💳 *Payment:* cash or bank transfer at the dock.'

  return `${header}\n\n${lines}${promoBlock}${payment}`
}

function buildCapacityAnswer(settings: BusinessSettings | null, lang: 'es' | 'en'): string {
  const capacity = settings?.boat_capacity ?? DEFAULT_CAPACITY
  return lang === 'es'
    ? `👥 *Capacidad máxima:* ${capacity} personas por salida.\n\nPor seguridad no podemos exceder ese número.`
    : `👥 *Maximum capacity:* ${capacity} people per tour.\n\nFor safety reasons we cannot exceed that number.`
}

const DYNAMIC_FAQ_IDS = new Set(['faq_schedule', 'faq_packages', 'faq_capacity'])

// ─── Aviso de manifiesto incompleto ──────────────────────────────────────────
// Se envía como mensaje separado después del resumen de la reservación,
// solo cuando required > 0 y el manifiesto no está completo.
async function maybeSendManifestWarning(
  to: string,
  reservationId: string,
  lang: 'es' | 'en',
): Promise<void> {
  const siteUrl = Deno.env.get('SITE_URL') ?? ''
  if (!siteUrl) return

  const status = await getManifestStatus(reservationId)
  if (!status || status.isComplete || status.required === 0) return

  const url = `${siteUrl}/pasajeros/${reservationId}`
  await sendTextMessage(to, T.manifestIncomplete[lang](status.filled, status.required, url))
}

async function buildDynamicFaqAnswer(id: string, lang: 'es' | 'en'): Promise<string> {
  const settings = await getBusinessSettings()
  if (id === 'faq_schedule') return buildScheduleAnswer(settings, lang)
  if (id === 'faq_packages') return buildPackagesAnswer(settings, lang)
  if (id === 'faq_capacity') return buildCapacityAnswer(settings, lang)
  return ''
}

function statusLabel(status: string, lang: 'es' | 'en'): string {
  const labels: Record<string, { es: string; en: string }> = {
    pendiente:  { es: '⏳ Pendiente',  en: '⏳ Pending'   },
    confirmada: { es: '✅ Confirmada', en: '✅ Confirmed'  },
    pagada:     { es: '💰 Pagada',    en: '💰 Paid'       },
    cancelada:  { es: '❌ Cancelada', en: '❌ Cancelled'  },
  }
  return labels[status]?.[lang] ?? status
}

// ─── Handler principal ────────────────────────────────────────────────────────
export async function handleMessage(msg: IncomingMessage): Promise<void> {
  const { from, messageId, text, buttonReplyId, listReplyId } = msg

  await markAsRead(messageId)

  // Solo responder a números que iniciaron desde la app (RESERVA:<uuid>).
  // Proveedores, capitanía y desconocidos quedan en silencio.
  const session = await getSessionIfExists(from)
  if (!session) return
  const rawText = (text ?? '').trim()
  const lower   = rawText.toLowerCase()

  // ─── Comandos explícitos de idioma (/es, /en) ─────────────────────────────
  if (lower === '/es' || lower === 'es') {
    await updateSession(from, { lang: 'es' })
    await sendTextMessage(from, '🇲🇽 Idioma cambiado a *Español*. Escribe *menú* para continuar.')
    return
  }
  if (lower === '/en' || lower === 'en') {
    await updateSession(from, { lang: 'en' })
    await sendTextMessage(from, '🇺🇸 Language switched to *English*. Type *menu* to continue.')
    return
  }

  // Detectar idioma y persistir si cambió
  const detectedLang = rawText ? detectLang(rawText) : session.lang
  if (detectedLang !== session.lang) {
    await updateSession(from, { lang: detectedLang })
  }
  const lang = detectedLang

  // ─── Botones de confirmación de cancelación ────────────────────────────────
  if (buttonReplyId === 'btn_cancel_yes' && session.awaiting_cancel_confirm) {
    await updateSession(from, { awaiting_cancel_confirm: false })
    const reservation = await getReservationByPhone(from)
    if (!reservation) {
      await sendTextMessage(from, T.noReservationForAction[lang])
      return
    }
    await requestCancellation(reservation.id, 'Solicitada por el cliente vía WhatsApp')
    await sendTextMessage(from, T.cancelDone[lang])
    return
  }

  if (buttonReplyId === 'btn_cancel_no' && session.awaiting_cancel_confirm) {
    await updateSession(from, { awaiting_cancel_confirm: false })
    await sendTextMessage(from, T.cancelAborted[lang])
    return
  }

  // ─── Botón: ver estado de reservación ─────────────────────────────────────
  if (buttonReplyId === 'btn_status') {
    const reservation = await getReservationByPhone(from)
    if (!reservation) {
      await sendTextMessage(from, T.noReservationForAction[lang])
      return
    }
    await sendTextMessage(from, T.reservationSummary[lang](reservation))
    await maybeSendManifestWarning(from, reservation.id, lang)
    return
  }

  // ─── Botón: ver FAQ ────────────────────────────────────────────────────────
  if (buttonReplyId === 'btn_faq') {
    const faq = T.faqList[lang]
    await sendListMessage(from, faq.header, faq.prompt, faq.button, faq.sections)
    return
  }

  // ─── Botón: iniciar cancelación ────────────────────────────────────────────
  if (buttonReplyId === 'btn_cancel') {
    const reservation = await getReservationByPhone(from)
    if (!reservation) {
      await sendTextMessage(from, T.noReservationForAction[lang])
      return
    }
    if (reservation.status === 'cancelada') {
      await sendTextMessage(from, T.alreadyCancelled[lang])
      return
    }
    await updateSession(from, { awaiting_cancel_confirm: true })
    await sendButtonMessage(from, T.cancelConfirm[lang](reservation), T.cancelButtons[lang])
    return
  }

  // ─── Respuestas del menú FAQ ───────────────────────────────────────────────
  if (listReplyId) {
    if (DYNAMIC_FAQ_IDS.has(listReplyId)) {
      const answer = await buildDynamicFaqAnswer(listReplyId, lang)
      await sendTextMessage(from, answer)
      await sendButtonMessage(from, T.menuPrompt[lang], T.menuButtons[lang])
      return
    }
    if (T.faqAnswers[listReplyId]) {
      const answer = T.faqAnswers[listReplyId][lang]
      await sendTextMessage(from, answer)
      await sendButtonMessage(from, T.menuPrompt[lang], T.menuButtons[lang])
      return
    }
  }

  // ─── Palabras clave: menú ──────────────────────────────────────────────────
  const menuKeywords = ['menú', 'menu', 'hola', 'hello', 'hi', 'inicio', 'start', 'help', 'ayuda']
  if (menuKeywords.some((k) => lower.includes(k)) || !rawText) {
    const reservation = await getReservationByPhone(from)

    if (!reservation) {
      await sendTextMessage(from, T.welcomeNoReservation[lang])
      return
    }

    if (reservation.status === 'pendiente') {
      await confirmReservation(reservation.id)
      reservation.status = 'confirmada'
      const summary = T.reservationSummary[lang](reservation)
      await sendTextMessage(from, `${T.welcome[lang](reservation.contact_name)}\n\n${summary}\n\n${T.confirmed[lang]}`)
    } else {
      await sendTextMessage(from, T.welcome[lang](reservation.contact_name))
    }

    await sendButtonMessage(from, T.menuPrompt[lang], T.menuButtons[lang])
    await maybeSendManifestWarning(from, reservation.id, lang)
    return
  }

  // ─── Palabras clave: estado ────────────────────────────────────────────────
  const statusKeywords = ['reservación', 'reservacion', 'reservation', 'estado', 'status', 'booking', 'mi reserva']
  if (statusKeywords.some((k) => lower.includes(k))) {
    const reservation = await getReservationByPhone(from)
    if (!reservation) {
      await sendTextMessage(from, T.noReservationForAction[lang])
      return
    }
    await sendTextMessage(from, T.reservationSummary[lang](reservation))
    await sendButtonMessage(from, T.menuPrompt[lang], T.menuButtons[lang])
    await maybeSendManifestWarning(from, reservation.id, lang)
    return
  }

  // ─── Palabras clave: cancelar ──────────────────────────────────────────────
  const cancelKeywords = ['cancelar', 'cancel', 'cancela', 'baja', 'eliminar']
  if (cancelKeywords.some((k) => lower.includes(k))) {
    const reservation = await getReservationByPhone(from)
    if (!reservation) {
      await sendTextMessage(from, T.noReservationForAction[lang])
      return
    }
    if (reservation.status === 'cancelada') {
      await sendTextMessage(from, T.alreadyCancelled[lang])
      return
    }
    await updateSession(from, { awaiting_cancel_confirm: true })
    await sendButtonMessage(from, T.cancelConfirm[lang](reservation), T.cancelButtons[lang])
    return
  }

  // ─── Palabras clave: reagendar ────────────────────────────────────────────
  const rescheduleKeywords = ['reagendar', 'reschedule', 'cambiar fecha', 'cambiar día', 'change date', 'cambiar reserva']
  if (rescheduleKeywords.some((k) => lower.includes(k))) {
    const reservation = await getReservationByPhone(from)
    if (!reservation) {
      await sendTextMessage(from, T.rescheduleNoReservation[lang])
      return
    }
    await requestCancellation(reservation.id, 'Reagendado solicitado por el cliente vía WhatsApp')
    await sendTextMessage(from, T.rescheduleRequested[lang])
    return
  }

  // ─── Palabras clave: FAQ ───────────────────────────────────────────────────
  const faqKeywords = ['precio', 'price', 'horario', 'schedule', 'dónde', 'where', 'ubicacion', 'niños', 'children', 'clima', 'weather', 'descuento', 'discount', 'paquete', 'package']
  if (faqKeywords.some((k) => lower.includes(k))) {
    const faq = T.faqList[lang]
    await sendListMessage(from, faq.header, faq.prompt, faq.button, faq.sections)
    return
  }

  // ─── Fallback ──────────────────────────────────────────────────────────────
  await sendTextMessage(from, T.fallback[lang])
}

// ─── Handler para mensajes entrantes de la app (redirección post-reserva) ─────
export async function handleInitialRedirect(
  from: string,
  messageId: string,
  reservationId: string,
): Promise<void> {
  await markAsRead(messageId)

  const session     = await getSession(from)
  const reservation = await getReservationByPhone(from)

  if (!reservation || reservation.id !== reservationId) {
    await sendTextMessage(from, T.welcomeNoReservation[session.lang])
    return
  }

  if (reservation.status === 'pendiente') {
    await confirmReservation(reservation.id)
    reservation.status = 'confirmada'
  }

  const lang    = session.lang
  const summary = T.reservationSummary[lang](reservation)
  await sendTextMessage(
    from,
    `${T.welcome[lang](reservation.contact_name)}\n\n${summary}\n\n${T.confirmed[lang]}`,
  )
  await sendButtonMessage(from, T.menuPrompt[lang], T.menuButtons[lang])
  await maybeSendManifestWarning(from, reservation.id, lang)
}
