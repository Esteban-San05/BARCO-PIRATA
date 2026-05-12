import { useState, useEffect, useCallback } from 'react'
import { Clock, CalendarOff, Ship, Save, Check, Plus, X, CloudLightning, Minus } from 'lucide-react'
import { clsx } from 'clsx'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { useBusinessSettings, useUpdateBusinessSettings } from '@features/settings/hooks/useBusinessSettings'
import { useAdminHeaderSlot } from '@lib/AdminHeaderSlot'
import { fetchPronostico14Dias } from '@services/weatherService'
import { TIME_SLOTS } from '@constants/index'
import { Button } from '@components/ui/Button'
import { CalendarPicker } from '@components/ui/CalendarPicker'

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

export default function SchedulePage() {
  const { data: settings, isLoading } = useBusinessSettings()
  const { mutateAsync: save, isPending: saving } = useUpdateBusinessSettings()
  const { setSlot } = useAdminHeaderSlot()
  const [saved, setSaved] = useState(false)

  const [closedWeekdays, setClosedWeekdays] = useState<number[]>(settings?.closedWeekdays ?? [1])
  const [activeSlots,    setActiveSlots]    = useState(settings?.activeTimeSlots ?? TIME_SLOTS.map(s => s.time))
  const [boatCapacity,   setBoatCapacity]   = useState(settings?.boatCapacity    ?? 40)
  const [closedDates,    setClosedDates]    = useState<string[]>(settings?.closedDates ?? [])
  const [pickingDate,    setPickingDate]    = useState(false)
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

  useEffect(() => {
    if (!settings) return
    setClosedWeekdays(settings.closedWeekdays)
    setActiveSlots(settings.activeTimeSlots)
    setBoatCapacity(settings.boatCapacity)
    setClosedDates(settings.closedDates)
  }, [settings])

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
    await save({ closedWeekdays, activeTimeSlots: activeSlots, boatCapacity, closedDates })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }, [save, closedWeekdays, activeSlots, boatCapacity, closedDates])

  // Enviar botón de guardar al header
  useEffect(() => {
    setSlot(
      <div className="flex items-center gap-4">
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
  }, [saving, saved, setSlot, handleSave])

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
