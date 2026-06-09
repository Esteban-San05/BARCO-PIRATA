import { useState, useEffect, useCallback, useRef } from 'react'
import { Clock, CalendarOff, Ship, Save, Check, Plus, X, CloudLightning, Minus, AlertOctagon, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { useBusinessSettings, useUpdateBusinessSettings } from '@features/settings/hooks/useBusinessSettings'
import { usePortClosureNotify } from '@features/settings/hooks/usePortClosureNotify'
import { useAdminHeaderSlot } from '@lib/AdminHeaderSlot'
import { fetchPronostico14Dias } from '@services/weatherService'
import { TIME_SLOTS } from '@constants/index'
import { Button } from '@components/ui/Button'
import { CalendarPicker } from '@components/ui/CalendarPicker'
import type { CapacityFullSlot } from '@app-types/index'

const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

const UMBRAL_VIENTO = 40
const UMBRAL_OLAS   = 2

interface DiaPronostico {
  fecha: string
  clima: { velocidadViento: number | null; codigoClima: number | null }
  marina: { alturaOlas: number | null }
}

function Section({
  icon: Icon, title, description, children, className = '',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={clsx('rounded-xl p-4 sm:p-6', className)}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <header className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-gold-100 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-gold-600" />
        </div>
        <div>
          <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>{title}</h2>
          {description && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

function ClimaDesfavorable({
  closedDates,
  onToggle,
}: {
  closedDates: string[]
  onToggle: (iso: string) => void
}) {
  const [dias, setDias]         = useState<DiaPronostico[] | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    fetchPronostico14Dias()
      .then((data) => setDias(data as DiaPronostico[]))
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  if (cargando) return (
    <p className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>Cargando pronóstico de 14 días…</p>
  )
  if (error) return (
    <p className="text-sm text-pirate-600">Error al cargar el clima: {error}</p>
  )
  if (!dias || dias.length === 0) return null

  const malos = dias.filter(d =>
    (d.clima.velocidadViento !== null && d.clima.velocidadViento > UMBRAL_VIENTO) ||
    (d.marina.alturaOlas     !== null && d.marina.alturaOlas     > UMBRAL_OLAS)
  )

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {malos.length === 0
          ? '✅ No hay días con condiciones desfavorables en los próximos 14 días.'
          : `⛔ ${malos.length} día${malos.length > 1 ? 's' : ''} con condiciones no favorables para zarpar.`
        }
      </p>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {dias.map((dia) => {
          const vientoMal  = dia.clima.velocidadViento !== null && dia.clima.velocidadViento > UMBRAL_VIENTO
          const olasMal    = dia.marina.alturaOlas     !== null && dia.marina.alturaOlas     > UMBRAL_OLAS
          const malo       = vientoMal || olasMal
          const isClosed   = closedDates.includes(dia.fecha)

          return (
            <div
              key={dia.fecha}
              className={clsx(
                'bp-forecast-row',
                isClosed ? 'closed' : malo ? 'bad' : '',
              )}
            >
              <span className="text-base shrink-0">
                {isClosed ? '🔒' : malo ? '⛔' : '✅'}
              </span>

              <span className="font-semibold w-36 shrink-0 capitalize text-sm" style={{ color: 'var(--text-body)' }}>
                {format(parse(dia.fecha, 'yyyy-MM-dd', new Date()), "EEE d 'de' MMM", { locale: es })}
              </span>

              <div className="flex gap-4 text-xs flex-wrap flex-1" style={{ color: 'var(--text-muted)' }}>
                {dia.clima.velocidadViento !== null && (
                  <span className={clsx('flex items-center gap-1', vientoMal && 'text-pirate-600 font-bold')}>
                    💨 {dia.clima.velocidadViento} km/h
                    {vientoMal && <span className="text-[10px]">(lím. {UMBRAL_VIENTO})</span>}
                  </span>
                )}
                {dia.marina.alturaOlas !== null && (
                  <span className={clsx('flex items-center gap-1', olasMal && 'text-pirate-600 font-bold')}>
                    🌊 {dia.marina.alturaOlas} m
                    {olasMal && <span className="text-[10px]">(lím. {UMBRAL_OLAS} m)</span>}
                  </span>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2 shrink-0">
                <span className={clsx(
                  'text-xs font-bold px-2.5 py-1 rounded-full',
                  isClosed
                    ? 'bg-pirate-200 text-pirate-800'
                    : malo
                    ? 'bg-pirate-100 text-pirate-700'
                    : 'bg-green-100 text-green-700',
                )}>
                  {isClosed ? 'Cerrado' : malo ? 'No zarpar' : 'Favorable'}
                </span>

                <button
                  type="button"
                  onClick={() => onToggle(dia.fecha)}
                  className={clsx(
                    'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                    isClosed
                      ? 'border-green-400 text-green-700 hover:bg-green-50'
                      : 'border-pirate-300 text-pirate-700 hover:bg-pirate-50',
                  )}
                >
                  {isClosed ? 'Reabrir' : 'Cerrar día'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Umbrales: viento &gt; {UMBRAL_VIENTO} km/h · olas &gt; {UMBRAL_OLAS} m.
        Los cambios se guardan al presionar <strong>Guardar cambios</strong>.
      </p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//   Acciones de emergencia (cierre de puerto + notificación WhatsApp)
// ════════════════════════════════════════════════════════════════════════
function EmergencySection({
  portClosed,
  onToggle,
}: {
  portClosed: boolean
  onToggle: (v: boolean) => void
}) {
  const { mutateAsync: prepare, isPending: preparing } = usePortClosureNotify()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [contacts, setContacts] = useState<import('@features/settings/hooks/usePortClosureNotify').PortClosureContact[] | null>(null)
  const [contactsDate, setContactsDate] = useState<string | null>(null)
  const [opened, setOpened] = useState<Record<string, boolean>>({})
  const [notifyError, setNotifyError] = useState<string | null>(null)

  const handleConfirmClose = () => {
    onToggle(true)
    setConfirmOpen(false)
  }

  const handlePrepare = async () => {
    setNotifyError(null)
    setContacts(null)
    setOpened({})
    try {
      const res = await prepare()
      setContacts(res.contacts)
      setContactsDate(res.date)
    } catch (err) {
      setNotifyError(err instanceof Error ? err.message : 'No se pudo preparar la lista')
    }
  }

  const handleOpenChat = (contact: import('@features/settings/hooks/usePortClosureNotify').PortClosureContact) => {
    if (!contact.valid) return
    window.open(contact.waLink, '_blank', 'noopener,noreferrer')
    setOpened((prev) => ({ ...prev, [contact.id]: true }))
  }

  const handleOpenAll = () => {
    if (!contacts) return
    setNotifyError(null)
    const newOpened: Record<string, boolean> = {}
    let blocked = 0
    let openedCount = 0
    for (const c of contacts) {
      if (!c.valid) continue
      const w = window.open(c.waLink, '_blank', 'noopener,noreferrer')
      if (!w) {
        blocked++
      } else {
        newOpened[c.id] = true
        openedCount++
      }
    }
    setOpened((prev) => ({ ...prev, ...newOpened }))
    if (blocked > 0) {
      setNotifyError(
        `${openedCount} chat${openedCount !== 1 ? 's' : ''} abierto${openedCount !== 1 ? 's' : ''}. ` +
        `${blocked} fueron bloqueados por el navegador. ` +
        `Autoriza ventanas emergentes para este sitio (icono junto a la barra de URL) y vuelve a presionar el botón.`,
      )
    }
  }

  return (
    <section
      className="rounded-xl p-4 sm:p-6 border-2"
      style={{
        background: portClosed ? 'rgba(220,38,38,0.08)' : 'var(--bg-surface)',
        borderColor: portClosed ? 'rgb(220,38,38)' : 'var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <header className="flex items-start gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: portClosed ? 'rgba(220,38,38,0.2)' : 'rgba(220,38,38,0.1)' }}
        >
          <AlertOctagon className="w-5 h-5 text-pirate-600" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>
            Acciones de emergencia
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Úsalo cuando el puerto cierre repentinamente (mal clima, autoridad portuaria, etc.).
            Bloquea nuevas reservaciones y muestra un aviso en la página principal.
          </p>
        </div>
      </header>

      {portClosed ? (
        <div className="space-y-4">
          <div className="rounded-lg p-4 bg-pirate-50 border border-pirate-200">
            <p className="text-sm font-bold text-pirate-800 mb-1">
              🚫 El puerto está CERRADO actualmente
            </p>
            <p className="text-xs text-pirate-700">
              Las reservaciones nuevas están bloqueadas y los clientes ven un mensaje en la página principal.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="accent"
              size="md"
              onClick={() => onToggle(false)}
            >
              <Check className="w-4 h-4" /> Reabrir puerto
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handlePrepare}
              isLoading={preparing}
              disabled={preparing}
            >
              📱 Preparar mensajes de WhatsApp para hoy
            </Button>
          </div>

          {contacts && (
            <div className="rounded-lg p-4 bg-navy-50 border border-navy-200 space-y-3">
              {contacts.length === 0 ? (
                <p className="text-sm text-navy-700">
                  No hay reservaciones activas para hoy ({contactsDate}). Nada que notificar.
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-navy-800">
                    {contacts.length} reservación{contacts.length !== 1 ? 'es' : ''} para hoy ({contactsDate}).
                    Toca cada botón para abrir WhatsApp con el mensaje listo — solo presiona <strong>Enviar</strong>.
                  </p>

                  {contacts.some((c) => c.valid) && (
                    <button
                      type="button"
                      onClick={handleOpenAll}
                      className="w-full px-4 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-gold-300 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      🚀 Abrir todos los chats ({contacts.filter((c) => c.valid).length})
                    </button>
                  )}

                  <div className="space-y-2">
                    {contacts.map((c) => {
                      const isOpened = !!opened[c.id]
                      return (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border border-navy-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-navy-900 truncate">
                              {c.name || '(sin nombre)'} · {c.time}
                            </p>
                            <p className="text-xs text-navy-500 font-mono">
                              {c.valid ? c.phone : `${c.rawPhone} ⚠ teléfono inválido`}
                            </p>
                          </div>
                          {c.valid ? (
                            <button
                              type="button"
                              onClick={() => handleOpenChat(c)}
                              className={clsx(
                                'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5',
                                isOpened
                                  ? 'bg-green-100 text-green-700 border border-green-300'
                                  : 'bg-gold-400 text-navy-900 hover:bg-gold-500',
                              )}
                            >
                              {isOpened ? <><Check className="w-3.5 h-3.5" /> Abierto</> : <>💬 Abrir chat</>}
                            </button>
                          ) : (
                            <span className="text-xs text-pirate-600 font-semibold">No se puede contactar</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-navy-500 pt-1">
                    Los chats se abren en pestañas nuevas. Si el navegador bloquea las ventanas emergentes, autorízalo o abre una por una.
                  </p>
                </>
              )}
            </div>
          )}
          {notifyError && (
            <div className="rounded-lg p-3 bg-pirate-50 border border-pirate-200 text-sm text-pirate-700">
              ✕ {notifyError}
            </div>
          )}

          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Recuerda presionar <strong>Guardar</strong> arriba para que el cambio surta efecto.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={() => setConfirmOpen(true)}
            className="!border-pirate-400 !text-pirate-700 hover:!bg-pirate-50"
          >
            <AlertOctagon className="w-4 h-4" /> Cerrar puerto (emergencia)
          </Button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            El barco operará con normalidad mientras esto esté desactivado.
          </span>
        </div>
      )}

      {/* Modal de confirmación */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-pirate-100 flex items-center justify-center">
                <AlertOctagon className="w-6 h-6 text-pirate-600" />
              </div>
              <h3 className="font-display font-bold text-lg">¿Cerrar el puerto?</h3>
            </div>
            <p className="text-sm text-gray-700 mb-2">Esta acción:</p>
            <ul className="text-sm text-gray-700 space-y-1 mb-4 list-disc pl-5">
              <li>Bloquea nuevas reservaciones desde la página pública.</li>
              <li>Muestra un mensaje amable a los visitantes en la página de inicio.</li>
              <li>No envía mensajes automáticamente — después podrás preparar una lista de chats de WhatsApp con el mensaje listo, y los abres tú para enviar.</li>
            </ul>
            <p className="text-xs text-gray-500 mb-5">
              Tendrás que presionar <strong>Guardar</strong> arriba para que el cierre quede registrado.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={handleConfirmClose}
                className="!bg-pirate-600 hover:!bg-pirate-700"
              >
                Sí, cerrar puerto
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════
//   Slots con cupo lleno (fecha + horario específico)
// ════════════════════════════════════════════════════════════════════════
function FullSlotsSection({
  slots,
  activeSlots,
  onAdd,
  onRemove,
  pickingDate,
  setPickingDate,
  newDate,
  setNewDate,
  newTime,
  setNewTime,
}: {
  slots: CapacityFullSlot[]
  activeSlots: string[]
  onAdd: (date: string, time: string) => void
  onRemove: (date: string, time: string) => void
  pickingDate: boolean
  setPickingDate: (v: boolean) => void
  newDate: string | null
  setNewDate: (v: string | null) => void
  newTime: string
  setNewTime: (v: string) => void
}) {
  const canAdd = !!newDate && !!newTime
  const sorted = [...slots].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
  )

  const handleAdd = () => {
    if (!canAdd || !newDate) return
    onAdd(newDate, newTime)
    setNewDate(null)
    setNewTime('')
  }

  return (
    <section
      className="rounded-xl p-4 sm:p-6"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <header className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-gold-100 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-gold-600" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>
            Slots con cupo lleno
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Marca fecha + horario que ya están al límite. No se aceptarán nuevas reservaciones en ese slot,
            pero el resto del calendario sigue normal.
          </p>
        </div>
      </header>

      {sorted.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Sin slots marcados como llenos.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {sorted.map(({ date, time }) => (
            <div
              key={`${date}-${time}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-50 border border-gold-200 text-sm"
            >
              <Users className="w-3.5 h-3.5 text-gold-600 shrink-0" />
              <span className="font-medium text-gold-800 capitalize">
                {format(parse(date, 'yyyy-MM-dd', new Date()), "EEE d 'de' MMM", { locale: es })} · {time}
              </span>
              <button
                type="button"
                onClick={() => onRemove(date, time)}
                className="ml-1 text-gold-500 hover:text-gold-800 transition-colors"
                aria-label="Quitar slot"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario agregar */}
      <div className="rounded-xl border-2 border-dashed p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Marcar slot lleno
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setPickingDate(true)}>
            <CalendarOff className="w-4 h-4" />
            {newDate
              ? format(parse(newDate, 'yyyy-MM-dd', new Date()), "EEE d 'de' MMM", { locale: es })
              : 'Elegir fecha'}
          </Button>
          <select
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm font-mono"
            style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border)', color: 'var(--text-body)' }}
          >
            <option value="">Elegir horario…</option>
            {[...activeSlots].sort().map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <Button variant="accent" size="sm" onClick={handleAdd} disabled={!canAdd}>
            <Plus className="w-4 h-4" /> Marcar lleno
          </Button>
        </div>
        <CalendarPicker
          value={null}
          onChange={(iso) => { setNewDate(iso); setPickingDate(false) }}
          isOpen={pickingDate}
          onClose={() => setPickingDate(false)}
          adminMode
        />
      </div>
    </section>
  )
}

export default function SchedulePage() {
  const { data: settings, isLoading, isPlaceholderData } = useBusinessSettings()
  const { mutateAsync: save, isPending: saving } = useUpdateBusinessSettings()
  const { setSlot } = useAdminHeaderSlot()
  const [saved,      setSaved]      = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const initializedRef = useRef(false)

  const [closedWeekdays,    setClosedWeekdays]    = useState<number[]>([1])
  const [activeSlots,       setActiveSlots]       = useState<string[]>(TIME_SLOTS.map(s => s.time))
  const [boatCapacity,      setBoatCapacity]      = useState(40)
  const [closedDates,       setClosedDates]       = useState<string[]>([])
  const [portClosed,        setPortClosed]        = useState(false)
  const [capacityFullSlots, setCapacityFullSlots] = useState<CapacityFullSlot[]>([])
  const [pickingDate,       setPickingDate]       = useState(false)
  const [pickingFullDate,   setPickingFullDate]   = useState(false)
  const [newFullDate,       setNewFullDate]       = useState<string | null>(null)
  const [newFullTime,       setNewFullTime]       = useState<string>('')
  const [newHour,        setNewHour]        = useState('')
  const [newMinute,      setNewMinute]      = useState('')
  const [newPeriod,      setNewPeriod]      = useState<'AM' | 'PM'>('AM')
  const [newTimeError,   setNewTimeError]   = useState<string | null>(null)
  const [use12h,         setUse12h]         = useState(false)

  const slotMeta = (time: string) => {
    const h = parseInt(time.split(':')[0], 10)
    const label = h < 11 ? 'Mañana' : h < 14 ? 'Mediodía' : h < 18 ? 'Tarde' : 'Atardecer'
    const icon  = h < 11 ? '🌅'     : h < 14 ? '🌞'       : h < 18 ? '🌤️'    : '🌇'
    return { label, icon }
  }

  // Inicializa el estado local solo una vez con datos reales del servidor.
  // No re-sincroniza después (evita perder cambios locales por re-fetches o foco de ventana).
  useEffect(() => {
    if (!settings || isPlaceholderData || initializedRef.current) return
    setClosedWeekdays(settings.closedWeekdays)
    setActiveSlots(settings.activeTimeSlots ?? TIME_SLOTS.map(s => s.time))
    setBoatCapacity(settings.boatCapacity)
    setClosedDates(settings.closedDates)
    setPortClosed(settings.portClosed)
    setCapacityFullSlots(settings.capacityFullSlots ?? [])
    initializedRef.current = true
  }, [settings, isPlaceholderData])

  const handleHourChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 2)
    setNewHour(digits)
    setNewTimeError(null)
    const max = use12h ? 1 : 2
    if (digits.length === 2 || (digits.length === 1 && parseInt(digits, 10) > max)) {
      document.getElementById('admin-slot-min')?.focus()
    }
  }

  const handleMinuteChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 2)
    setNewMinute(digits)
    setNewTimeError(null)
  }

  const addSlot = () => {
    const h = parseInt(newHour, 10)
    const m = parseInt(newMinute, 10)
    if (newHour === '' || newMinute === '') { setNewTimeError('Ingresa hora y minutos'); return }
    if (isNaN(m) || m < 0 || m > 59) { setNewTimeError('Minutos inválidos (0–59)'); return }

    let hour24: number
    if (use12h) {
      if (isNaN(h) || h < 1 || h > 12) { setNewTimeError('Hora inválida (1–12)'); return }
      hour24 = newPeriod === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12)
    } else {
      if (isNaN(h) || h < 0 || h > 23) { setNewTimeError('Hora inválida (0–23)'); return }
      hour24 = h
    }

    const time = `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    if (activeSlots.includes(time)) { setNewTimeError('Este horario ya está en la lista'); return }
    setActiveSlots(prev => [...prev, time].sort())
    setNewHour('')
    setNewMinute('')
    setNewPeriod('AM')
    setNewTimeError(null)
  }

  const removeSlot = (time: string) => {
    if (activeSlots.length <= 1) return
    setActiveSlots(prev => prev.filter(t => t !== time))
  }

  const addClosedDate = (iso: string) => {
    setPickingDate(false)
    setClosedDates(prev => prev.includes(iso) ? prev : [...prev, iso].sort())
  }

  const removeClosedDate = (iso: string) => {
    setClosedDates(prev => prev.filter(d => d !== iso))
  }

  const toggleWeekday = (day: number) => {
    setClosedWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const formatTime = (time: string) => {
    if (!use12h) return time
    const [hStr, mStr] = time.split(':')
    const h = parseInt(hStr, 10)
    return `${h % 12 || 12}:${mStr} ${h >= 12 ? 'PM' : 'AM'}`
  }

  const handleSave = useCallback(async () => {
    setSaveError(null)
    try {
      await save({
        closedWeekdays,
        activeTimeSlots: activeSlots,
        boatCapacity,
        closedDates,
        portClosed,
        capacityFullSlots,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }, [save, closedWeekdays, activeSlots, boatCapacity, closedDates, portClosed, capacityFullSlots])

  // Enviar botón de guardar al header
  useEffect(() => {
    setSlot(
      <div className="flex items-center gap-4">
        {saveError && (
          <span className="text-sm text-red-500 font-semibold max-w-xs truncate" title={saveError}>
            ✕ {saveError}
          </span>
        )}
        {saved && (
          <span className="text-sm text-green-600 font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Guardado
          </span>
        )}
        <Button variant="accent" size="lg" onClick={handleSave} isLoading={saving}>
          <Save className="w-5 h-5" />
          Guardar
        </Button>
      </div>
    )
    return () => setSlot(null)
  }, [saving, saved, saveError, setSlot, handleSave])

  if (isLoading) return (
    <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
      Cargando configuración…
    </div>
  )

  return (
    <div className="space-y-6">
      {/* ── Encabezado ── */}
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Configura los días y horarios en que opera el barco.
      </p>

      {/* ── Acciones de emergencia ── */}
      <EmergencySection
        portClosed={portClosed}
        onToggle={setPortClosed}
      />

      {/* ── Slots con cupo lleno ── */}
      <FullSlotsSection
        slots={capacityFullSlots}
        activeSlots={activeSlots}
        onAdd={(date, time) => {
          setCapacityFullSlots(prev =>
            prev.some(s => s.date === date && s.time === time) ? prev : [...prev, { date, time }],
          )
        }}
        onRemove={(date, time) => {
          setCapacityFullSlots(prev => prev.filter(s => !(s.date === date && s.time === time)))
        }}
        pickingDate={pickingFullDate}
        setPickingDate={setPickingFullDate}
        newDate={newFullDate}
        setNewDate={setNewFullDate}
        newTime={newFullTime}
        setNewTime={setNewFullTime}
      />

      {/* ── Fila 1: Día de cierre + Capacidad (2 columnas) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section
          icon={CalendarOff}
          title="Días de cierre semanal"
          description="El barco no opera estos días cada semana. Puedes seleccionar varios."
          className="h-full"
        >
          <div className="bp-weekday-grid">
            {WEEKDAYS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleWeekday(value)}
                className={clsx('bp-weekday-btn', closedWeekdays.includes(value) && 'closed')}
              >
                {label.slice(0, 3)}
              </button>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            {closedWeekdays.length === 0
              ? 'Sin días de cierre semanal.'
              : <>
                  Días cerrados:{' '}
                  <strong style={{ color: 'var(--text-body)' }}>
                    {closedWeekdays
                      .map(d => WEEKDAYS.find(w => w.value === d)?.label)
                      .filter(Boolean)
                      .join(', ')}
                  </strong>
                </>
            }
          </p>
        </Section>

        <Section
          icon={Ship}
          title="Capacidad del barco"
          description="Número máximo de personas por salida."
          className="h-full"
        >
          <div className="flex items-center gap-5 mb-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBoatCapacity(c => Math.max(1, c - 1))}
                className="w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-colors hover:border-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-body)' }}
              >
                <Minus size={16} />
              </button>
              <span
                className="w-16 text-center text-3xl font-black font-display tabular-nums"
                style={{ color: 'var(--text-title)' }}
              >
                {boatCapacity}
              </span>
              <button
                type="button"
                onClick={() => setBoatCapacity(c => Math.min(200, c + 1))}
                className="w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-colors hover:border-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-body)' }}
              >
                <Plus size={16} />
              </button>
            </div>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>personas<br />por salida</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-alt)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(boatCapacity / 200) * 100}%`,
                background: 'linear-gradient(90deg, #F7C948, #F0B429)',
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {boatCapacity} de 200 máx. · {Math.round((boatCapacity / 200) * 100)}% de capacidad
          </p>
        </Section>
      </div>

      {/* ── Fila 2: Horarios activos (ancho completo) ── */}
      <Section
        icon={Clock}
        title="Horarios activos"
        description="Agrega y elimina los horarios en que opera el barco. Debe quedar al menos uno."
      >
        {/* Toggle 12 / 24 h */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Formato:</span>
          <div
            className="flex rounded-lg overflow-hidden border"
            style={{ borderColor: 'var(--border)' }}
          >
            {(['24h', '12h'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setUse12h(fmt === '12h')}
                className="px-3 py-1 text-xs font-bold transition-colors"
                style={{
                  background: (fmt === '12h') === use12h ? 'var(--accent)' : 'var(--bg-surface-alt)',
                  color:      (fmt === '12h') === use12h ? '#fff' : 'var(--text-muted)',
                }}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
          {[...activeSlots].sort().map((time) => {
            const meta = slotMeta(time)
            return (
              <div
                key={time}
                className="group relative flex flex-col items-center text-center gap-1 py-5 px-3 rounded-xl border-2 transition-all duration-150"
                style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border)' }}
                onMouseEnter={e => { if (activeSlots.length > 1) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.35)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
              >
                <span className="text-2xl mb-1 select-none">{meta.icon}</span>
                <span className="font-mono font-black text-xl tracking-tight" style={{ color: 'var(--text-title)' }}>
                  {formatTime(time)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {meta.label}
                </span>
                {activeSlots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSlot(time)}
                    className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-pirate-500 hover:bg-pirate-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    aria-label="Eliminar horario"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Panel agregar */}
        <div className="rounded-xl border-2 border-dashed p-4" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            Nuevo horario
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className={clsx(
                'flex items-center rounded-xl border-2 overflow-hidden transition-colors',
                newTimeError ? 'border-pirate-400' : 'border-[var(--border)] focus-within:border-[var(--accent)]',
              )}
              style={{ background: 'var(--bg-surface-alt)' }}
            >
              <input
                id="admin-slot-hour"
                type="text"
                inputMode="numeric"
                placeholder="HH"
                maxLength={2}
                value={newHour}
                onChange={e => handleHourChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSlot()}
                className="w-14 text-center font-mono font-black text-xl py-2.5 outline-none bg-transparent placeholder:font-normal placeholder:text-base"
                style={{ color: newHour ? 'var(--text-title)' : 'var(--text-subtle)' }}
              />
              <span className="font-mono font-black text-xl select-none -mt-0.5 px-0.5" style={{ color: 'var(--text-muted)' }}>:</span>
              <input
                id="admin-slot-min"
                type="text"
                inputMode="numeric"
                placeholder="MM"
                maxLength={2}
                value={newMinute}
                onChange={e => handleMinuteChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSlot()}
                className="w-14 text-center font-mono font-black text-xl py-2.5 outline-none bg-transparent placeholder:font-normal placeholder:text-base"
                style={{ color: newMinute ? 'var(--text-title)' : 'var(--text-subtle)' }}
              />
            </div>
            {use12h && (
              <div
                className="flex rounded-xl overflow-hidden border-2"
                style={{ borderColor: 'var(--border)' }}
              >
                {(['AM', 'PM'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setNewPeriod(p); setNewTimeError(null) }}
                    className="px-3 py-2 text-sm font-bold transition-colors"
                    style={{
                      background: newPeriod === p ? 'var(--accent)' : 'var(--bg-surface-alt)',
                      color:      newPeriod === p ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <Button variant="accent" size="sm" onClick={addSlot}>
              <Plus className="w-4 h-4" />
              Agregar
            </Button>
            {newTimeError && <span className="text-xs font-medium text-pirate-600">{newTimeError}</span>}
          </div>
        </div>

        <p className="text-[11px] mt-3" style={{ color: 'var(--text-subtle)' }}>
          {activeSlots.length} horario{activeSlots.length !== 1 ? 's' : ''} configurado{activeSlots.length !== 1 ? 's' : ''} · Pasa el cursor sobre una tarjeta para eliminarla.
        </p>
      </Section>

      {/* ── Nota explicativa ── */}
      <div
        className="px-6 py-3 rounded-xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Los cambios se aplican de inmediato al presionar el botón <strong>Guardar</strong> en la parte superior.
        </p>
      </div>

      {/* ── Fila 3: Fechas específicas + Pronóstico (2 columnas en pantallas grandes) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          icon={CalendarOff}
          title="Días específicos cerrados"
          description="Feriados, mantenimiento, mal clima u otras fechas puntuales."
          className="h-full"
        >
          {closedDates.length === 0 ? (
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Sin fechas adicionales cerradas.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {closedDates.map((iso) => (
                <div
                  key={iso}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pirate-50 border border-pirate-200 text-sm"
                >
                  <CalendarOff className="w-3.5 h-3.5 text-pirate-500 shrink-0" />
                  <span className="font-medium text-pirate-700 capitalize">
                    {format(parse(iso, 'yyyy-MM-dd', new Date()), "EEE d 'de' MMM yyyy", { locale: es })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeClosedDate(iso)}
                    className="ml-1 text-pirate-400 hover:text-pirate-700 transition-colors"
                    aria-label="Quitar fecha"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setPickingDate(true)}>
            <Plus className="w-4 h-4" />
            Agregar fecha cerrada
          </Button>
          <CalendarPicker
            value={null}
            onChange={addClosedDate}
            isOpen={pickingDate}
            onClose={() => setPickingDate(false)}
            adminMode
          />
        </Section>

        <Section
          icon={CloudLightning}
          title="Pronóstico — próximos 14 días"
          description={`Viento > ${UMBRAL_VIENTO} km/h u olas > ${UMBRAL_OLAS} m se consideran desfavorables.`}
          className="h-full"
        >
          <ClimaDesfavorable
            closedDates={closedDates}
            onToggle={(iso) =>
              setClosedDates(prev =>
                prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso].sort()
              )
            }
          />
        </Section>
      </div>
    </div>
  )
}
