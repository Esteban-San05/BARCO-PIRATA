// Funciones puras del bot de WhatsApp, extraídas para poder testearlas con Vitest.
// bot-logic.ts mantiene sus propias copias (Deno no puede importar desde src/).

export function detectLang(text: string): 'es' | 'en' {
  const lower = text.toLowerCase()
  // Palabras completas solamente — evita falsos positivos como "cancelar" ⊃ "cancel"
  const tokens = new Set(lower.split(/\W+/).filter(Boolean))
  const enWords = ['hello', 'hi', 'book', 'reservation', 'cancel', 'help', 'info', 'status', 'what', 'how', 'when', 'where', 'price', 'cost', 'ticket', 'reschedule']
  const enScore = enWords.filter((w) => tokens.has(w)).length
  return enScore >= 1 ? 'en' : 'es'
}

export function formatTime(timeStr: string): string {
  // Acepta "09:00:00" o "09:00"
  const normalized = timeStr.length === 5 ? `${timeStr}:00` : timeStr
  const [h, min] = normalized.split(':').map(Number)
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${String(min).padStart(2, '0')} ${suffix}`
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('521')) return `52${digits.slice(3)}`
  if (digits.startsWith('52')) return digits
  if (digits.length === 10) return `52${digits}`
  return digits
}

export const WEEKDAY_NAMES: Record<'es' | 'en', string[]> = {
  es: ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'],
  en: ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'],
}

export function joinList(items: string[], lang: 'es' | 'en'): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  const conj = lang === 'es' ? ' y ' : ' and '
  return items.slice(0, -1).join(', ') + conj + items[items.length - 1]
}

export function formatClosedDays(closed: number[], lang: 'es' | 'en'): string {
  if (closed.length === 0) {
    return lang === 'es' ? 'Operamos *todos los días*.' : 'We operate *every day*.'
  }
  const names = [...closed].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[lang][d] ?? '')
  if (lang === 'es') return `Cerrado los *${joinList(names, 'es')}*.`
  return `Closed on *${joinList(names, 'en')}*.`
}

export function isPromotionActive(
  p: { active: boolean; startDate: string | null; endDate: string | null },
  today: string,
): boolean {
  if (!p.active) return false
  if (p.startDate && today < p.startDate) return false
  if (p.endDate   && today > p.endDate)   return false
  return true
}
