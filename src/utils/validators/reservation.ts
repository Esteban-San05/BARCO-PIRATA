import { z } from 'zod'
import { format, addDays } from 'date-fns'
import i18n from '@lib/i18n'
import { TIME_SLOTS, MAX_ADVANCE_DAYS } from '@constants/index'

const todayStr   = () => format(new Date(), 'yyyy-MM-dd')
const maxDateStr = () => format(addDays(new Date(), MAX_ADVANCE_DAYS), 'yyyy-MM-dd')

// Valores permitidos para la hora: únicamente los slots predefinidos
const VALID_TIMES = TIME_SLOTS.map(s => s.time) as [string, ...string[]]

// Helper: traduce con i18n. Se evalúa al construir el schema.
const tt = (key: string, opts?: Record<string, unknown>) =>
  i18n.t(key, opts as never) as unknown as string

/**
 * Construye el schema de reservación con los mensajes de validación
 * en el idioma activo de i18n. Como puede cambiar el idioma en runtime,
 * se invoca cada vez que el formulario se monta (vía `reservationSchema` getter).
 */
function buildReservationSchema() {
  return z.object({
    contactName: z
      .string()
      .min(3, tt('validation.nameMin'))
      .max(100, tt('validation.nameMax'))
      .regex(/^[a-zA-ZÀ-ÿ\s]+$/, tt('validation.nameLetters')),

    contactPhone: z
      .string()
      .regex(/^(\+52)?[\s-]?(\d{3})[\s-]?(\d{3})[\s-]?(\d{4})$/, tt('validation.phoneInvalid')),

    date: z
      .string({ required_error: tt('validation.dateRequired') })
      .min(1, tt('validation.dateRequired'))
      .refine((d) => d >= todayStr(),   { message: tt('validation.datePast') })
      .refine((d) => d <= maxDateStr(), { message: tt('validation.dateFuture', { days: MAX_ADVANCE_DAYS }) }),

    // Solo aceptamos los horarios predefinidos (coinciden con valid_time_slots() en DB)
    time: z
      .enum(VALID_TIMES, {
        required_error:     tt('validation.timeRequired'),
        invalid_type_error: tt('validation.timeInvalid'),
      }),

    numberOfPeople: z
      .number({ invalid_type_error: tt('validation.peopleNumber') })
      .int()
      .min(1,  tt('validation.peopleMin'))
      .max(40, tt('validation.peopleMax', { max: 40 })),

    packageId: z.enum(['CON_COMIDA', 'SOLO_BEBIDAS', 'SOLO_PASEO'], {
      required_error: tt('validation.packageRequired'),
    }),

    serviceType: z.enum(['individual', 'grupal']),

    contactEmail: z
      .string()
      .min(1, 'El correo electrónico es requerido')
      .email('Ingresa un correo electrónico válido')
      .max(254, 'Correo demasiado largo'),

    notes: z.string().max(500, tt('validation.notesMax')).optional(),
  })
}

/**
 * Tipo derivado del schema. Usamos una instancia base solo para inferencia de tipos
 * — los mensajes correctos vienen de `getReservationSchema()` que se llama en cada uso.
 */
export type ReservationFormValues = z.infer<ReturnType<typeof buildReservationSchema>>

/** Devuelve un schema con los mensajes en el idioma activo. */
export const getReservationSchema = () => buildReservationSchema()

/** Schema por defecto (compatibilidad con imports existentes). */
export const reservationSchema = buildReservationSchema()
