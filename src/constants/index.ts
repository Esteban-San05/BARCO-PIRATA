// ─── Paquetes y precios ────────────────────────────────────────────────────
// Precios por grupo de edad:
//   adultPrice    → adultos (18+)
//   youthPrice    → adolescentes (12-17)
//   childrenPrice → niños (3-11)
//   babies        → siempre gratis
// pricePerPerson se mantiene = adultPrice para compatibilidad con pricing.ts
export const PACKAGES = {
  CON_COMIDA: {
    id: 'con_comida',
    label: 'Cena y Barra Libre',
    description: 'Cena buffet + barra libre a bordo',
    pricePerPerson: 700,
    adultPrice:    700,
    youthPrice:    500,  // 12-17: cena, soda y agua
    icon: '🍽️',
  },
  SOLO_BEBIDAS: {
    id: 'solo_bebidas',
    label: 'Cena o Barra Libre',
    description: 'Elige entre cena o barra de bebidas a bordo',
    pricePerPerson: 600,
    adultPrice:    600,
    youthPrice:    400,  // 12-17: sodas y agua
    icon: '🍹',
  },
} as const

// Niños (3-11): paquete único fijo — agua, sodas y pizza
export const CHILDREN_PRICE = 300

export type PackageId = keyof typeof PACKAGES

// ─── Capacidad del barco (debe coincidir con boat_capacity() en SQL) ─────
export const BOAT_CAPACITY = 40

// ─── Horarios disponibles (slots fijos, coinciden con valid_time_slots()) ─
export const TIME_SLOTS = [
  { time: '09:00', slotKey: 'morning',    label: 'Mañana',       icon: '🌅', description: 'Temprano con aire fresco'    },
  { time: '11:00', slotKey: 'midMorning', label: 'Media mañana', icon: '☀️', description: 'Ideal para familias'          },
  { time: '13:00', slotKey: 'noon',       label: 'Mediodía',     icon: '🌞', description: 'Sol pleno y mejor vista'       },
  { time: '15:00', slotKey: 'afternoon',  label: 'Tarde',        icon: '🌤️', description: 'Clásico de la tarde'         },
  { time: '17:00', slotKey: 'sunset',     label: 'Atardecer',    icon: '🌇', description: 'Puesta de sol en el mar'     },
] as const

export type TimeSlotValue = typeof TIME_SLOTS[number]['time']

// Días que se muestran de un vistazo en el selector de fecha
export const DATE_PICKER_DAYS = 14

// Días máximos de anticipación
export const MAX_ADVANCE_DAYS = 90

// ─── Tipos de pago ────────────────────────────────────────────────────────
export const PAYMENT_METHODS = {
  EFECTIVO: 'efectivo',
  TARJETA: 'tarjeta',
} as const

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS]

// ─── Estados de reservación ───────────────────────────────────────────────
export const RESERVATION_STATUS = {
  PENDIENTE: 'pendiente',
  CONFIRMADA: 'confirmada',
  PAGADA: 'pagada',
  CANCELADA: 'cancelada',
} as const

export type ReservationStatus = typeof RESERVATION_STATUS[keyof typeof RESERVATION_STATUS]

// ─── Rutas de la app ──────────────────────────────────────────────────────
export const ROUTES = {
  HOME: '/',
  RESERVAR: '/reservar',
  CONFIRMACION: '/reservar/confirmacion',
  PAGO: '/pago/:reservationId',
  LOGIN: '/admin/login',
  ADMIN: {
    DASHBOARD: '/admin',
    RESERVACIONES: '/admin/reservaciones',
    REPORTES: '/admin/reportes',
    VENTA: '/admin/venta/:reservationId',
  },
} as const

// ─── Empresa ──────────────────────────────────────────────────────────────
export const COMPANY = {
  name: 'Barco Pirata de Puerto Peñasco',
  shortName: 'Barco Pirata',
  location: 'Recinto Portuario, Puerto Peñasco, Sonora',
  phone: '638 112 3686',
  email: 'reydelmar_2004@hotmail.com',
  schedule: 'Jue – Dom: 11:00 AM – 2:00 PM y 4:00 PM – 6:00 PM',
} as const

// ─── Paginación ───────────────────────────────────────────────────────────
export const PAGE_SIZE = 20
