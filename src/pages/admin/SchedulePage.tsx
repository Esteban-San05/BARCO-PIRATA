import { useState, useEffect } from 'react'
import { Clock, CalendarOff, Ship, Save, Check, Plus, X, CloudLightning, Minus } from 'lucide-react'
import { clsx } from 'clsx'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { useBusinessSettings, useUpdateBusinessSettings } from '@features/settings/hooks/useBusinessSettings'
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
  icon: Icon, title, description, children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-xl p-6"
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
  const [saved, setSaved] = useState(false)

  const [closedWeekday, setClosedWeekday] = useState(settings?.closedWeekday   ?? 1)
  const [activeSlots,   setActiveSlots]   = useState(settings?.activeTimeSlots ?? TIME_SLOTS.map(s => s.time))
  const [boatCapacity,  setBoatCapacity]  = useState(settings?.boatCapacity    ?? 40)
  const [closedDates,   setClosedDates]   = useState<string[]>(settings?.closedDates ?? [])
  const [pickingDate,   setPickingDate]   = useState(false)

  useEffect(() => {
    if (!settings) return
    setClosedWeekday(settings.closedWeekday)
    setActiveSlots(settings.activeTimeSlots)
    setBoatCapacity(settings.boatCapacity)
    setClosedDates(settings.closedDates)
  }, [settings])

  const toggleSlot = (time: string) => {
    setActiveSlots(prev => {
      if (prev.includes(time)) {
        if (prev.length <= 1) return prev
        return prev.filter(t => t !== time)
      }
      return [...prev, time].sort()
    })
  }

  const addClosedDate = (iso: string) => {
    setPickingDate(false)
    setClosedDates(prev => prev.includes(iso) ? prev : [...prev, iso].sort())
  }

  const removeClosedDate = (iso: string) => {
    setClosedDates(prev => prev.filter(d => d !== iso))
  }

  const handleSave = async () => {
    await save({ closedWeekday, activeTimeSlots: activeSlots, boatCapacity, closedDates })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
      Cargando configuración…
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Configura los días y horarios en que opera el barco.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {saved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Guardado
            </span>
          )}
          <Button variant="accent" size="sm" onClick={handleSave} isLoading={saving}>
            <Save className="w-4 h-4" />
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* ── Día de cierre semanal ── */}
      <Section
        icon={CalendarOff}
        title="Día de cierre semanal"
        description="El barco no opera este día cada semana."
      >
        <div className="bp-weekday-grid">
          {WEEKDAYS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setClosedWeekday(value)}
              className={clsx('bp-weekday-btn', closedWeekday === value && 'closed')}
            >
              {label.slice(0, 3)}
            </button>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          Día seleccionado: <strong style={{ color: 'var(--text-body)' }}>{WEEKDAYS.find(d => d.value === closedWeekday)?.label}</strong>
        </p>
      </Section>

      {/* ── Fechas específicas cerradas ── */}
      <Section
        icon={CalendarOff}
        title="Días específicos cerrados"
        description="Cierra fechas puntuales además del día semanal: feriados, mantenimiento, mal clima, etc."
      >
        {closedDates.length === 0 ? (
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Sin fechas adicionales cerradas.</p>
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

      {/* ── Horarios activos ── */}
      <Section
        icon={Clock}
        title="Horarios activos"
        description="Desactiva los slots que no se ofrezcan esta temporada. Debe quedar al menos uno activo."
      >
        <div className="space-y-2">
          {TIME_SLOTS.map((slot) => {
            const isActive = activeSlots.includes(slot.time)
            return (
              <label
                key={slot.time}
                className={clsx('bp-slot-row', isActive ? 'active' : 'inactive')}
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-xl shrink-0">{slot.icon}</span>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-body)' }}>{slot.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{slot.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-title)' }}>{slot.time}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => toggleSlot(slot.time)}
                    className={clsx(
                      'relative inline-flex items-center w-11 h-6 rounded-full transition-colors',
                      isActive ? 'bg-gold-400' : 'bg-navy-100 border border-navy-200',
                    )}
                  >
                    <span className={clsx(
                      'inline-block w-4 h-4 rounded-full bg-white shadow transition-transform',
                      isActive ? 'translate-x-6' : 'translate-x-1',
                    )} />
                  </button>
                </div>
              </label>
            )
          })}
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          {activeSlots.length} de {TIME_SLOTS.length} horarios activos.
        </p>
      </Section>

      {/* ── Capacidad del barco ── */}
      <Section
        icon={Ship}
        title="Capacidad del barco"
        description="Número máximo de personas por salida. Afecta la disponibilidad en tiempo real."
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBoatCapacity(c => Math.max(1, c - 1))}
              className="w-10 h-10 rounded-lg border flex items-center justify-center transition-colors hover:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-body)' }}
            >
              <Minus size={16} />
            </button>
            <span
              className="w-16 text-center text-2xl font-bold font-display tabular-nums"
              style={{ color: 'var(--text-title)' }}
            >
              {boatCapacity}
            </span>
            <button
              type="button"
              onClick={() => setBoatCapacity(c => Math.min(200, c + 1))}
              className="w-10 h-10 rounded-lg border flex items-center justify-center transition-colors hover:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-body)' }}
            >
              <Plus size={16} />
            </button>
          </div>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>personas por salida</span>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-alt)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(boatCapacity / 200) * 100}%`,
                background: 'linear-gradient(90deg, #F7C948, #F0B429)',
              }}
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            {boatCapacity} de 200 personas máx. ({Math.round((boatCapacity / 200) * 100)}%)
          </p>
        </div>
      </Section>

      {/* ── Pronóstico de clima ── */}
      <Section
        icon={CloudLightning}
        title="Pronóstico de clima — próximos 14 días"
        description={`Días con viento > ${UMBRAL_VIENTO} km/h u olas > ${UMBRAL_OLAS} m se consideran no favorables para zarpar.`}
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
  )
}
