import { useState, useEffect } from 'react'
import {
  Sun, Moon, Monitor, LayoutGrid, Palette, RotateCcw,
  Eye, Check,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  useAdminTheme,
  type ThemeMode, type Density,
} from '@app/providers/AdminThemeProvider'
import { Button } from '@components/ui/Button'

// ════════════════════════════════════════════════════════════════════════
//   Tile reutilizable — usa bp-option-tile del handoff
// ════════════════════════════════════════════════════════════════════════
function OptionTile({
  active, icon: Icon, label, hint, onClick,
}: {
  active: boolean
  icon: React.ComponentType<{ className?: string }>
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('bp-option-tile', active && 'active')}
    >
      <Icon className="w-6 h-6" />
      <span className="font-semibold text-sm">{label}</span>
      {hint && <span className="text-[11px] opacity-70">{hint}</span>}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════
//   Switch
// ════════════════════════════════════════════════════════════════════════
function ToggleSwitch({
  checked, onChange, label, description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 cursor-pointer">
      <div className="min-w-0">
        <p className="font-semibold text-sm" style={{ color: 'var(--text-body)' }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative shrink-0 inline-flex items-center w-11 h-6 rounded-full transition-colors',
          checked ? 'bg-gold-400' : 'bg-navy-100 border border-navy-200',
        )}
      >
        <span className={clsx(
          'inline-block w-4 h-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )} />
      </button>
    </label>
  )
}

// ════════════════════════════════════════════════════════════════════════
//   Sección
// ════════════════════════════════════════════════════════════════════════
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
      className="rounded-xl p-4 sm:p-6"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <header className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-gold-100 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-gold-600" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>{title}</h2>
          {description && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════
//   Página
// ════════════════════════════════════════════════════════════════════════
export default function AdminSettingsPage() {
  const { settings, resolvedTheme, update, reset } = useAdminTheme()
  const [justSaved, setJustSaved] = useState(false)

  const handleReset = () => {
    if (confirm('¿Restablecer todos los ajustes a sus valores predeterminados?')) {
      reset()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    }
  }

  const themeOptions: Array<{ value: ThemeMode; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = [
    { value: 'light',  label: 'Claro',   hint: 'Fondo blanco con detalles navy', icon: Sun     },
    { value: 'dark',   label: 'Oscuro',  hint: 'Ideal para uso nocturno',        icon: Moon    },
    { value: 'system', label: 'Sistema', hint: 'Se adapta a tu dispositivo',     icon: Monitor },
  ]

  const densityOptions: Array<{ value: Density; label: string; hint: string }> = [
    { value: 'compact',     label: 'Compacto', hint: 'Más información en pantalla' },
    { value: 'normal',      label: 'Normal',   hint: 'Balance recomendado'         },
    { value: 'comfortable', label: 'Cómodo',   hint: 'Mayor respiración visual'    },
  ]

  // Forzar acento dorado de forma permanente
  useEffect(() => {
    if (settings.accent !== 'gold') update({ accent: 'gold' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Personaliza la apariencia y comportamiento del panel administrador.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {justSaved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Restablecido
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" /> Restablecer
          </Button>
        </div>
      </div>

      {/* Tema */}
      <Section
        icon={Palette}
        title="Apariencia"
        description={`Tema resuelto actualmente: ${resolvedTheme === 'dark' ? 'Oscuro' : 'Claro'}.`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map((opt) => (
            <OptionTile
              key={opt.value}
              active={settings.theme === opt.value}
              icon={opt.icon}
              label={opt.label}
              hint={opt.hint}
              onClick={() => update({ theme: opt.value })}
            />
          ))}
        </div>
      </Section>

      {/* Densidad */}
      <Section
        icon={LayoutGrid}
        title="Densidad"
        description="Controla el espaciado general de tablas, tarjetas y formularios."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {densityOptions.map((opt) => (
            <OptionTile
              key={opt.value}
              active={settings.density === opt.value}
              icon={LayoutGrid}
              label={opt.label}
              hint={opt.hint}
              onClick={() => update({ density: opt.value })}
            />
          ))}
        </div>
      </Section>

      {/* Preferencias generales */}
      <Section
        icon={Eye}
        title="Preferencias generales"
        description="Ajusta elementos del panel a tu flujo de trabajo."
      >
        <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
          <ToggleSwitch
            checked={settings.showWelcomeBanner}
            onChange={(v) => update({ showWelcomeBanner: v })}
            label="Mostrar banner de bienvenida en el Dashboard"
            description="Oculta el saludo y las métricas principales para una vista más directa."
          />
          <ToggleSwitch
            checked={settings.animations}
            onChange={(v) => update({ animations: v })}
            label="Animaciones suaves"
            description="Deshabilita transiciones para un rendimiento máximo o entornos con poca memoria."
          />
        </div>
      </Section>

      {/* Info */}
      <div
        className="rounded-xl p-4 text-xs border"
        style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <p>
          Los ajustes se guardan localmente en tu navegador
          (<code style={{ color: 'var(--text-body)' }} className="font-mono">localStorage</code>).
          No afectan la sesión de otros usuarios administradores.
        </p>
      </div>
    </div>
  )
}
