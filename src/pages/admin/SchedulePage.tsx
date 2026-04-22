import { useState, useEffect } from 'react'
import { Clock, CalendarOff, Ship, Save, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { useBusinessSettings, useUpdateBusinessSettings } from '@features/settings/hooks/useBusinessSettings'
import { TIME_SLOTS } from '@constants/index'
import { Button } from '@components/ui/Button'

const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

function Section({
  icon: Icon, title, description, children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="admin-surface border admin-border rounded-xl p-6">
      <header className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-gold-100 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-gold-600" />
        </div>
        <div>
          <h2 className="font-display font-bold admin-text-title">{title}</h2>
          {description && <p className="text-sm admin-text-muted mt-0.5">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

export default function SchedulePage() {
  const { data: settings, isLoading } = useBusinessSettings()
  const { mutateAsync: save, isPending: saving } = useUpdateBusinessSettings()
  const [saved, setSaved] = useState(false)

  const [closedWeekday,   setClosedWeekday]   = useState(settings?.closedWeekday   ?? 1)
  const [activeSlots,     setActiveSlots]     = useState(settings?.activeTimeSlots ?? TIME_SLOTS.map(s => s.time))
  const [boatCapacity,    setBoatCapacity]    = useState(settings?.boatCapacity    ?? 40)

  // Sincroniza cuando llegan los datos de DB
  useEffect(() => {
    if (!settings) return
    setClosedWeekday(settings.closedWeekday)
    setActiveSlots(settings.activeTimeSlots)
    setBoatCapacity(settings.boatCapacity)
  }, [settings])

  const toggleSlot = (time: string) => {
    setActiveSlots(prev => {
      if (prev.includes(time)) {
        // Debe quedar al menos 1 horario activo
        if (prev.length <= 1) return prev
        return prev.filter(t => t !== time)
      }
      return [...prev, time].sort()
    })
  }

  const handleSave = async () => {
    await save({ closedWeekday, activeTimeSlots: activeSlots, boatCapacity })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 admin-text-muted">
      Cargando configuración…
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold admin-text-title flex items-center gap-2">
            <Clock className="w-6 h-6 text-gold-500" />
            Horarios y Disponibilidad
          </h1>
          <p className="text-sm admin-text-muted mt-0.5">
            Configura los días y horarios en que opera el barco.
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Día de cierre */}
      <Section
        icon={CalendarOff}
        title="Día de cierre semanal"
        description="El barco no opera este día. Las fechas cerradas se marcan en el calendario de reservas."
      >
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {WEEKDAYS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setClosedWeekday(value)}
              className={clsx(
                'py-2.5 rounded-xl text-sm font-semibold border transition-all',
                closedWeekday === value
                  ? 'bg-pirate-600 text-white border-pirate-600 shadow-pirate'
                  : 'admin-surface admin-border admin-text-body hover:border-pirate-400 hover:text-pirate-600',
              )}
            >
              {label.slice(0, 3)}
            </button>
          ))}
        </div>
        <p className="text-xs admin-text-muted mt-3">
          Día seleccionado: <strong className="admin-text-body">{WEEKDAYS.find(d => d.value === closedWeekday)?.label}</strong>
        </p>
      </Section>

      {/* Horarios activos */}
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
                className={clsx(
                  'flex items-center justify-between gap-4 p-3 rounded-xl border cursor-pointer transition-all',
                  isActive
                    ? 'admin-surface border-gold-400/60 bg-gold-50/30'
                    : 'admin-surface admin-border opacity-50',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{slot.icon}</span>
                  <div>
                    <p className="font-semibold text-sm admin-text-body">{slot.label}</p>
                    <p className="text-xs admin-text-muted">{slot.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-bold admin-text-title">{slot.time}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => toggleSlot(slot.time)}
                    className={clsx(
                      'relative inline-flex items-center w-11 h-6 rounded-full transition-colors',
                      isActive ? 'bg-gold-400' : 'admin-surface-alt border admin-border',
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
        <p className="text-xs admin-text-muted mt-3">
          {activeSlots.length} de {TIME_SLOTS.length} horarios activos.
        </p>
      </Section>

      {/* Capacidad del barco */}
      <Section
        icon={Ship}
        title="Capacidad del barco"
        description="Número máximo de personas por salida. Afecta la disponibilidad en tiempo real."
      >
        <div className="flex items-center gap-4">
          <input
            type="number"
            min={1}
            max={200}
            value={boatCapacity}
            onChange={(e) => setBoatCapacity(Math.max(1, Math.min(200, Number(e.target.value))))}
            className="input-field w-32 text-center text-xl font-bold font-display"
          />
          <span className="text-sm admin-text-muted">personas por salida</span>
        </div>
        <p className="text-xs admin-text-muted mt-2">
          Actualmente el barco admite hasta <strong className="admin-text-body">{boatCapacity}</strong> personas.
          El valor en la base de datos se actualiza al guardar.
        </p>
      </Section>
    </div>
  )
}
