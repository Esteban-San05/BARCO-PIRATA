import { useState, useEffect, useCallback } from 'react'
import { Package, Tag, Plus, Pencil, Trash2, Save, Check, X, ToggleLeft, ToggleRight } from 'lucide-react'
import { PACKAGES } from '@constants/index'
import type { PackageOverrideData, PromotionItem } from '@app-types/index'
import { useBusinessSettings, useUpdateBusinessSettings } from '@features/settings/hooks/useBusinessSettings'
import { useAdminHeaderSlot } from '@lib/AdminHeaderSlot'
import { Button } from '@components/ui/Button'
import { formatCurrency } from '@utils/formatters'

const uuid = () => crypto.randomUUID()

// ─── Tipos locales ────────────────────────────────────────────────────────────

type Tab = 'paquetes' | 'promociones'

type EditingPkg = PackageOverrideData & { key: string }

const EMPTY_PKG = (): EditingPkg => ({
  key:         '',
  label:       '',
  icon:        '🎟️',
  adultPrice:  0,
  youthPrice:  0,
  description: '',
  active:      true,
  isCustom:    true,
})

const EMPTY_PROMO = (): PromotionItem => ({
  id:            uuid(),
  name:          '',
  discountType:  'percentage',
  discountValue: 10,
  minPeople:     1,
  active:        true,
  startDate:     null,
  endDate:       null,
})

// ─── Helper: mezcla defaults con overrides ────────────────────────────────────

function buildEffectivePkgs(overrides: Record<string, PackageOverrideData>): Record<string, PackageOverrideData> {
  const defaults: Record<string, PackageOverrideData> = {}
  for (const [key, pkg] of Object.entries(PACKAGES)) {
    const base: PackageOverrideData = {
      label:       pkg.label,
      icon:        pkg.icon,
      adultPrice:  pkg.adultPrice,
      youthPrice:  pkg.youthPrice,
      description: pkg.description,
      active:      true,
      isCustom:    false,
    }
    defaults[key] = { ...base, ...overrides[key] }
  }
  // paquetes custom (no están en PACKAGES)
  for (const [key, data] of Object.entries(overrides)) {
    if (!(key in PACKAGES)) defaults[key] = data
  }
  return defaults
}

// ─── Estilos reutilizables ────────────────────────────────────────────────────

const cardStyle  = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }
const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-surface-alt)', color: 'var(--text-body)' }
const labelStyle = { color: 'var(--text-muted)' }

// ─── Sub: input de precio ─────────────────────────────────────────────────────

function PriceInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1" style={labelStyle}>{label}</label>
      <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-alt)' }}>
        <span className="px-2 text-sm font-bold select-none" style={{ color: 'var(--text-muted)' }}>$</span>
        <input
          type="number" min={0} step={50} value={value}
          onChange={e => onChange(Math.max(0, Number(e.target.value)))}
          className="flex-1 py-2 pr-2 text-sm outline-none bg-transparent tabular-nums"
          style={{ color: 'var(--text-title)' }}
        />
      </div>
    </div>
  )
}

// ─── Sub: modal / form de edición de paquete ─────────────────────────────────

function PkgForm({
  initial, onSave, onCancel,
}: {
  initial: EditingPkg
  onSave:  (pkg: EditingPkg) => void
  onCancel: () => void
}) {
  const [pkg, setPkg] = useState<EditingPkg>(initial)
  const set = <K extends keyof EditingPkg>(k: K, v: EditingPkg[K]) => setPkg(p => ({ ...p, [k]: v }))

  const valid = pkg.label.trim() !== '' && pkg.adultPrice >= 0 && pkg.youthPrice >= 0

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ ...cardStyle, border: '2px solid var(--accent)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nombre */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-semibold mb-1" style={labelStyle}>Nombre del paquete *</label>
          <input
            type="text" value={pkg.label} onChange={e => set('label', e.target.value)}
            placeholder="Ej. Cena + Barra Premium"
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
          />
        </div>

        {/* Icono */}
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={labelStyle}>Emoji / ícono</label>
          <input
            type="text" value={pkg.icon} onChange={e => set('icon', e.target.value)}
            placeholder="🎟️" maxLength={4}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={labelStyle}>Descripción corta</label>
          <input
            type="text" value={pkg.description} onChange={e => set('description', e.target.value)}
            placeholder="Incluye…"
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
          />
        </div>

        {/* Precios */}
        <PriceInput label="Precio adulto (18+)" value={pkg.adultPrice} onChange={v => set('adultPrice', v)} />
        <PriceInput label="Precio adolescente (12-17)" value={pkg.youthPrice} onChange={v => set('youthPrice', v)} />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="accent" size="sm" onClick={() => valid && onSave(pkg)} disabled={!valid}>
          <Check className="w-3.5 h-3.5" /> Guardar
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="w-3.5 h-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  )
}

// ─── Sub: card de paquete ─────────────────────────────────────────────────────

function PkgCard({
  pkgKey: _pkgKey, data, isDefault,
  onEdit, onToggle, onDelete,
}: {
  pkgKey:   string
  data:     PackageOverrideData
  isDefault: boolean
  onEdit:   () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-opacity"
      style={{ ...cardStyle, opacity: data.active ? 1 : 0.55 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{data.icon}</span>
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: 'var(--text-title)' }}>{data.label}</p>
            <p className="text-[11px] mt-0.5" style={labelStyle}>{data.description || '—'}</p>
          </div>
        </div>
        {data.isCustom && (
          <span
            className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}
          >
            Custom
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg p-2 text-center" style={{ background: 'var(--bg-surface-alt)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={labelStyle}>Adulto</p>
          <p className="font-black" style={{ color: 'var(--accent)' }}>{formatCurrency(data.adultPrice)}</p>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: 'var(--bg-surface-alt)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={labelStyle}>Adolesc.</p>
          <p className="font-black" style={{ color: 'var(--accent)' }}>{formatCurrency(data.youthPrice)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button" onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:border-[var(--accent)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <Pencil className="w-3 h-3" /> Editar
        </button>
        <button
          type="button" onClick={onToggle}
          className="p-1.5 rounded-lg border transition-colors hover:border-[var(--accent)]"
          style={{ borderColor: 'var(--border)', color: data.active ? '#10B981' : 'var(--text-subtle)' }}
          title={data.active ? 'Desactivar' : 'Activar'}
        >
          {data.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        </button>
        {!isDefault && (
          <button
            type="button" onClick={onDelete}
            className="p-1.5 rounded-lg border transition-colors hover:border-red-400"
            style={{ borderColor: 'var(--border)', color: '#f87171' }}
            title="Eliminar paquete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sub: fila de promoción ───────────────────────────────────────────────────

function PromoRow({
  promo, onEdit, onToggle, onDelete,
}: {
  promo:    PromotionItem
  onEdit:   () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const discLabel = promo.discountType === 'percentage'
    ? `${promo.discountValue}% off`
    : `${formatCurrency(promo.discountValue)} off`

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl transition-opacity"
      style={{ ...cardStyle, opacity: promo.active ? 1 : 0.55 }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-black"
        style={{ background: promo.active ? 'rgba(var(--accent-rgb),0.12)' : 'var(--bg-surface-alt)', color: 'var(--accent)' }}
      >
        {promo.discountType === 'percentage' ? `${promo.discountValue}%` : '$'}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-title)' }}>{promo.name}</p>
        <p className="text-[11px]" style={labelStyle}>
          {discLabel}
          {promo.minPeople > 1 && ` · mín. ${promo.minPeople} personas`}
          {promo.startDate && ` · desde ${promo.startDate}`}
          {promo.endDate   && ` hasta ${promo.endDate}`}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button type="button" onClick={onEdit}
          className="p-1.5 rounded-lg border transition-colors hover:border-[var(--accent)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onToggle}
          className="p-1.5 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border)', color: promo.active ? '#10B981' : 'var(--text-subtle)' }}>
          {promo.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onDelete}
          className="p-1.5 rounded-lg border transition-colors hover:border-red-400"
          style={{ borderColor: 'var(--border)', color: '#f87171' }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Sub: form de promoción ───────────────────────────────────────────────────

function PromoForm({
  initial, onSave, onCancel,
}: {
  initial:  PromotionItem
  onSave:   (p: PromotionItem) => void
  onCancel: () => void
}) {
  const [p, setP] = useState<PromotionItem>(initial)
  const set = <K extends keyof PromotionItem>(k: K, v: PromotionItem[K]) => setP(prev => ({ ...prev, [k]: v }))

  const valid = p.name.trim() !== '' && p.discountValue > 0

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ ...cardStyle, border: '2px solid var(--accent)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nombre */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-semibold mb-1" style={labelStyle}>Nombre de la promoción *</label>
          <input
            type="text" value={p.name} onChange={e => set('name', e.target.value)}
            placeholder="Ej. Grupo Familiar"
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
          />
        </div>

        {/* Tipo de descuento */}
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={labelStyle}>Tipo de descuento</label>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {(['percentage', 'fixed'] as const).map(t => (
              <button key={t} type="button" onClick={() => set('discountType', t)}
                className="flex-1 py-2 text-xs font-bold transition-colors"
                style={{
                  background: p.discountType === t ? 'var(--accent)' : 'var(--bg-surface-alt)',
                  color:      p.discountType === t ? '#fff' : 'var(--text-muted)',
                }}>
                {t === 'percentage' ? '% Porcentaje' : '$ Fijo'}
              </button>
            ))}
          </div>
        </div>

        {/* Valor */}
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={labelStyle}>
            {p.discountType === 'percentage' ? 'Descuento (%)' : 'Descuento ($)'}
          </label>
          <input
            type="number" min={1} step={p.discountType === 'percentage' ? 1 : 50}
            max={p.discountType === 'percentage' ? 100 : undefined}
            value={p.discountValue} onChange={e => set('discountValue', Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
          />
        </div>

        {/* Mínimo de personas */}
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={labelStyle}>Mínimo de personas</label>
          <input
            type="number" min={1} value={p.minPeople} onChange={e => set('minPeople', Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
          />
        </div>

        {/* Vigencia */}
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={labelStyle}>Válido desde</label>
          <input
            type="date" value={p.startDate ?? ''} onChange={e => set('startDate', e.target.value || null)}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={labelStyle}>Válido hasta</label>
          <input
            type="date" value={p.endDate ?? ''} onChange={e => set('endDate', e.target.value || null)}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="accent" size="sm" onClick={() => valid && onSave(p)} disabled={!valid}>
          <Check className="w-3.5 h-3.5" /> Guardar
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="w-3.5 h-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PaquetesPage() {
  const { data: settings, isLoading } = useBusinessSettings()
  const { mutateAsync: save, isPending: saving } = useUpdateBusinessSettings()
  const { setSlot } = useAdminHeaderSlot()
  const [saved,     setSaved]     = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('paquetes')

  // Estado local de paquetes y promos
  const [overrides,   setOverrides]   = useState<Record<string, PackageOverrideData>>({})
  const [promotions,  setPromotions]  = useState<PromotionItem[]>([])
  const [editingPkg,  setEditingPkg]  = useState<EditingPkg | null>(null)
  const [addingPkg,   setAddingPkg]   = useState(false)
  const [editingPromo, setEditingPromo] = useState<PromotionItem | null>(null)
  const [addingPromo,  setAddingPromo]  = useState(false)

  useEffect(() => {
    if (!settings) return
    setOverrides(settings.packageOverrides)
    setPromotions(settings.promotions)
  }, [settings])

  const effectivePkgs = buildEffectivePkgs(overrides)

  // ── Guardar ────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    await save({ packageOverrides: overrides, promotions })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }, [save, overrides, promotions])

  useEffect(() => {
    setSlot(
      <div className="flex items-center gap-4">
        {saved && (
          <span className="text-sm text-green-600 font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Guardado
          </span>
        )}
        <Button variant="accent" size="lg" onClick={handleSave} isLoading={saving}>
          <Save className="w-5 h-5" /> Guardar
        </Button>
      </div>
    )
    return () => setSlot(null)
  }, [saving, saved, setSlot, handleSave])

  // ── Handlers paquetes ──────────────────────────────────────────────────────

  const savePkg = (pkg: EditingPkg) => {
    const { key, ...data } = pkg
    setOverrides(prev => ({ ...prev, [key]: data }))
    setEditingPkg(null)
    setAddingPkg(false)
  }

  const addPkg = (pkg: EditingPkg) => {
    const key = `CUSTOM_${uuid().slice(0, 8).toUpperCase()}`
    setOverrides(prev => ({ ...prev, [key]: { ...pkg, isCustom: true } }))
    setAddingPkg(false)
  }

  const togglePkg = (key: string) => {
    setOverrides(prev => ({
      ...prev,
      [key]: { ...effectivePkgs[key], active: !effectivePkgs[key].active },
    }))
  }

  const deletePkg = (key: string) => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // ── Handlers promociones ───────────────────────────────────────────────────

  const savePromo = (p: PromotionItem) => {
    setPromotions(prev => {
      const idx = prev.findIndex(x => x.id === p.id)
      return idx >= 0 ? prev.map((x, i) => (i === idx ? p : x)) : [...prev, p]
    })
    setEditingPromo(null)
    setAddingPromo(false)
  }

  const togglePromo = (id: string) => {
    setPromotions(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p))
  }

  const deletePromo = (id: string) => {
    setPromotions(prev => prev.filter(p => p.id !== id))
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
      Cargando…
    </div>
  )

  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-sm" style={labelStyle}>
        Gestiona los precios de paquetes disponibles y las promociones activas.
      </p>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {([
          { key: 'paquetes',    label: 'Paquetes',    icon: <Package  className="w-4 h-4" /> },
          { key: 'promociones', label: 'Promociones', icon: <Tag      className="w-4 h-4" /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key} type="button" onClick={() => setActiveTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: activeTab === key ? 'var(--accent)' : 'transparent',
              color:      activeTab === key ? '#fff' : 'var(--text-muted)',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: PAQUETES ══════════════ */}
      {activeTab === 'paquetes' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(effectivePkgs).map(([key, data]) => {
              if (editingPkg?.key === key) {
                return (
                  <div key={key} className="sm:col-span-2 lg:col-span-3">
                    <PkgForm
                      initial={editingPkg}
                      onSave={savePkg}
                      onCancel={() => setEditingPkg(null)}
                    />
                  </div>
                )
              }
              return (
                <PkgCard
                  key={key}
                  pkgKey={key}
                  data={data}
                  isDefault={key in PACKAGES}
                  onEdit={() => setEditingPkg({ key, ...data })}
                  onToggle={() => togglePkg(key)}
                  onDelete={() => deletePkg(key)}
                />
              )
            })}
          </div>

          {addingPkg ? (
            <PkgForm
              initial={EMPTY_PKG()}
              onSave={p => addPkg(p)}
              onCancel={() => setAddingPkg(false)}
            />
          ) : (
            <button
              type="button" onClick={() => { setEditingPkg(null); setAddingPkg(true) }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed w-full text-sm font-semibold transition-colors hover:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <Plus className="w-4 h-4" /> Nuevo paquete personalizado
            </button>
          )}

          <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
            Los paquetes base (Cena y Barra Libre, Barra Libre, Paquete Niños) no se pueden eliminar — solo editar precios o desactivar.
            Los cambios se aplican al presionar <strong>Guardar</strong>.
          </p>
        </div>
      )}

      {/* ══════════════ TAB: PROMOCIONES ══════════════ */}
      {activeTab === 'promociones' && (
        <div className="space-y-4">
          {promotions.length === 0 && !addingPromo && (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <Tag className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-subtle)' }} />
              <p className="text-sm" style={labelStyle}>Sin promociones configuradas.</p>
            </div>
          )}

          {promotions.map(promo => {
            if (editingPromo?.id === promo.id) {
              return (
                <PromoForm
                  key={promo.id}
                  initial={editingPromo}
                  onSave={savePromo}
                  onCancel={() => setEditingPromo(null)}
                />
              )
            }
            return (
              <PromoRow
                key={promo.id}
                promo={promo}
                onEdit={() => { setAddingPromo(false); setEditingPromo(promo) }}
                onToggle={() => togglePromo(promo.id)}
                onDelete={() => deletePromo(promo.id)}
              />
            )
          })}

          {addingPromo ? (
            <PromoForm
              initial={EMPTY_PROMO()}
              onSave={savePromo}
              onCancel={() => setAddingPromo(false)}
            />
          ) : (
            <button
              type="button" onClick={() => { setEditingPromo(null); setAddingPromo(true) }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed w-full text-sm font-semibold transition-colors hover:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <Plus className="w-4 h-4" /> Nueva promoción
            </button>
          )}

          <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
            Las promociones se guardan en la base de datos pero no se aplican automáticamente al flujo de reserva — se usan como referencia para el vendedor.
            Los cambios se aplican al presionar <strong>Guardar</strong>.
          </p>
        </div>
      )}
    </div>
  )
}
