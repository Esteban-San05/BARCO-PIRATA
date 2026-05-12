import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Minus, Banknote, ArrowLeftRight } from 'lucide-react'
import { PACKAGES, CHILDREN_PRICE, BOAT_CAPACITY } from '@constants/index'
import type { PackageId, PaymentMethod } from '@constants/index'
import { formatCurrency } from '@utils/formatters'
import { useAdminCreateReservation } from '@features/reservations/hooks/useReservations'
import { useBusinessSettings } from '@features/settings/hooks/useBusinessSettings'
import { Button } from '@components/ui/Button'
import { format } from 'date-fns'

function slotMeta(time: string) {
  const h = parseInt(time.split(':')[0], 10)
  if (h < 11) return { icon: '🌅', label: 'Mañana' }
  if (h < 14) return { icon: '🌞', label: 'Mediodía' }
  if (h < 18) return { icon: '🌤️', label: 'Tarde' }
  return { icon: '🌇', label: 'Atardecer' }
}

// ─── Tipos (misma lógica que ReservationPage pública) ────────────────────────
type AgeGroup  = 'adults' | 'youth'
type PkgCounts = Record<PackageId, Record<AgeGroup, number>>

const PKG_IDS = Object.keys(PACKAGES) as PackageId[]

const EMPTY_COUNTS = (): PkgCounts =>
  Object.fromEntries(PKG_IDS.map(id => [id, { adults: 0, youth: 0 }])) as PkgCounts

// ─── Sub-componente: contador ────────────────────────────────────────────────
function Counter({
  value, onDec, onInc, disableDec, disableInc,
}: {
  value: number; onDec: () => void; onInc: () => void
  disableDec: boolean; disableInc: boolean
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button" onClick={onDec} disabled={disableDec}
        className="w-7 h-7 rounded-full border flex items-center justify-center transition-colors disabled:opacity-25"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
      >
        <Minus size={12} />
      </button>
      <span className="w-5 text-center font-bold text-sm" style={{ color: 'var(--text-title)' }}>{value}</span>
      <button
        type="button" onClick={onInc} disabled={disableInc}
        className="w-7 h-7 rounded-full border flex items-center justify-center transition-colors disabled:opacity-25"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
      >
        <Plus size={12} />
      </button>
    </div>
  )
}

// ─── Estilos reutilizables ────────────────────────────────────────────────────
const cardStyle   = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }
const inputStyle  = { borderColor: 'var(--border)', background: 'var(--bg-surface-alt)', color: 'var(--text-body)' }
const labelStyle  = { color: 'var(--text-muted)' }

// ─── Página ──────────────────────────────────────────────────────────────────
export default function NewReservationPage() {
  const navigate = useNavigate()
  const { mutateAsync: adminCreate, isPending } = useAdminCreateReservation()
  const { data: settings } = useBusinessSettings()
  const activeSlots = settings?.activeTimeSlots ?? []

  // Tripulación
  const [counts,   setCounts]   = useState<PkgCounts>(EMPTY_COUNTS)
  const [children, setChildren] = useState(0)
  const [babies,   setBabies]   = useState(0)

  const inc = (pkg: PackageId, group: AgeGroup) =>
    setCounts(prev => ({ ...prev, [pkg]: { ...prev[pkg], [group]: prev[pkg][group] + 1 } }))
  const dec = (pkg: PackageId, group: AgeGroup) =>
    setCounts(prev => ({ ...prev, [pkg]: { ...prev[pkg], [group]: Math.max(0, prev[pkg][group] - 1) } }))

  // Datos del cliente
  const [contactName,  setContactName]  = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [date,         setDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [time,         setTime]         = useState<string>('')

  useEffect(() => {
    if (activeSlots.length > 0 && time === '') setTime(activeSlots[0])
  }, [activeSlots, time])

  // Estado de pago
  const [initialStatus, setInitialStatus] = useState<'pendiente' | 'pagada'>('pendiente')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo')
  const [notes,         setNotes]         = useState('')
  const [error,         setError]         = useState<string | null>(null)

  // ── Totales derivados (idénticos al flujo público) ──────────────────────────
  const totalAdults   = PKG_IDS.reduce((s, id) => s + counts[id].adults, 0)
  const totalYouth    = PKG_IDS.reduce((s, id) => s + counts[id].youth,  0)
  const numberOfPeople  = totalAdults + totalYouth + children
  const totalPassengers = numberOfPeople + babies
  const atCapacity      = numberOfPeople >= BOAT_CAPACITY

  // Paquete dominante (el que tiene más adultos+jóvenes; fallback al primero con alguien)
  const dominantPkg = useMemo<PackageId>(() =>
    PKG_IDS.reduce((best, id) => {
      const n    = counts[id].adults + counts[id].youth
      const bestN = counts[best].adults + counts[best].youth
      return n > bestN ? id : best
    }, PKG_IDS[0])
  , [counts])

  // Costos por paquete
  const pkgCosts = useMemo(() =>
    Object.fromEntries(PKG_IDS.map(id => {
      const p = PACKAGES[id]
      return [id, p.adultPrice * counts[id].adults + p.youthPrice * counts[id].youth]
    })) as Record<PackageId, number>
  , [counts])

  const adultsCost   = PKG_IDS.reduce((s, id) => s + PACKAGES[id].adultPrice * counts[id].adults, 0)
  const youthCost    = PKG_IDS.reduce((s, id) => s + PACKAGES[id].youthPrice  * counts[id].youth,  0)
  const childrenCost = children * CHILDREN_PRICE
  const total        = adultsCost + youthCost + childrenCost

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!contactName.trim())  return setError('El nombre es requerido.')
    if (!contactPhone.trim()) return setError('El teléfono es requerido.')
    if (totalAdults === 0)    return setError('Se requiere al menos 1 adulto para abordar el barco.')

    const pkgBreakdownItems: import('@app-types/index').PackageBreakdownItem[] = PKG_IDS
      .filter(id => id !== 'NINOS')
      .map(id => {
        const p = PACKAGES[id]
        const c = counts[id]
        const total = c.adults * p.adultPrice + c.youth * p.youthPrice
        if (c.adults === 0 && c.youth === 0) return null
        return { packageId: id, adults: c.adults, adultPrice: p.adultPrice, youth: c.youth, youthPrice: p.youthPrice, total }
      })
      .filter(Boolean) as import('@app-types/index').PackageBreakdownItem[]

    if (children > 0) {
      pkgBreakdownItems.push({
        packageId: 'NINOS',
        adults: 0, adultPrice: 0,
        youth: 0,  youthPrice: 0,
        children,  childrenPrice: CHILDREN_PRICE,
        total: childrenCost,
      })
    }

    try {
      const reservation = await adminCreate({
        contactName:      contactName.trim(),
        contactPhone:     contactPhone.trim(),
        date, time,
        packageId:        dominantPkg,
        packageBreakdown: pkgBreakdownItems,
        numberOfPeople,
        adults:           totalAdults,
        youth:            totalYouth,
        children,
        babies,
        adultsCost,
        youthCost,
        childrenCost,
        serviceType:      numberOfPeople >= 10 ? 'grupal' : 'individual',
        initialStatus,
        paymentMethod:    initialStatus === 'pagada' ? paymentMethod : undefined,
        notes:            notes.trim() || undefined,
      })
      navigate(`/admin/venta/${reservation.id}`)
    } catch (e) {
      setError((e as Error).message ?? 'Error al crear la reservación.')
    }
  }

  const AGE_GROUPS: { key: AgeGroup; label: string; desc: string; priceKey: 'adultPrice' | 'youthPrice' }[] = [
    { key: 'adults', label: 'Adultos',      desc: '18 años en adelante', priceKey: 'adultPrice' },
    { key: 'youth',  label: 'Adolescentes', desc: '12 a 17 años',        priceKey: 'youthPrice' },
  ]

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button" onClick={() => navigate(-1)}
          className="p-2 rounded-lg transition-colors"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-title)' }}>Nueva Reservación</h1>
          <p className="text-sm" style={labelStyle}>Walk-in · sin límite de anticipación ni validación de teléfono</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="px-4 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* ── I. Tripulación y paquetes ─────────────────────────────────────── */}
        <section className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center font-display font-bold text-xs"
                style={{ background: 'var(--accent)', color: '#000' }}>I</div>
              <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Tripulación y paquetes</h2>
            </div>
            <span className="text-xs" style={labelStyle}>
              {totalPassengers > 0
                ? `${totalPassengers} persona${totalPassengers !== 1 ? 's' : ''} · ${formatCurrency(total)}`
                : 'Elige quién viene'}
            </span>
          </div>

          <div className="p-5">
            <p className="text-xs mb-4" style={labelStyle}>
              Indica cuántas personas quieren cada paquete. Puedes mezclar paquetes en el mismo paseo.
            </p>

            {/* Tabla paquete × grupo de edad */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse">
                <thead>
                  <tr>
                    <th className="text-left pb-3 pl-1 text-[11px] font-semibold uppercase tracking-wider w-28" style={labelStyle}>
                      Grupo
                    </th>
                    {PKG_IDS.map(id => {
                      const p = PACKAGES[id]
                      return (
                        <th key={id} className="pb-3 px-2 text-center">
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="text-lg">{p.icon}</span>
                            <span className="text-[11px] font-bold leading-tight" style={{ color: 'var(--text-title)' }}>{p.label}</span>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Adultos y Adolescentes */}
                  {AGE_GROUPS.map(({ key, label, desc, priceKey }) => (
                    <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="py-3 pl-1 pr-2">
                        <p className="font-semibold text-xs m-0 leading-tight" style={{ color: 'var(--text-title)' }}>{label}</p>
                        <p className="text-[11px] m-0 mt-0.5" style={labelStyle}>{desc}</p>
                      </td>
                      {PKG_IDS.map(id => {
                        if (id === 'NINOS') {
                          return (
                            <td key={id} className="py-3 px-2 text-center">
                              <span className="inline-block text-[11px] rounded-lg px-2 py-1 select-none"
                                style={{ background: 'var(--bg-surface-alt)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                Solo niños
                              </span>
                            </td>
                          )
                        }
                        const price = PACKAGES[id][priceKey]
                        const val   = counts[id][key]
                        return (
                          <td key={id} className="py-3 px-2">
                            <div className="flex flex-col items-center gap-1">
                              <Counter
                                value={val}
                                onDec={() => dec(id, key)}
                                onInc={() => inc(id, key)}
                                disableDec={val <= 0}
                                disableInc={atCapacity && val === 0}
                              />
                              <span className="text-[11px]" style={labelStyle}>${price} c/u</span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  {/* Niños — paquete único fijo */}
                  <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface-alt)' }}>
                    <td className="py-3 pl-1 pr-2">
                      <p className="font-semibold text-xs m-0 leading-tight" style={{ color: 'var(--text-title)' }}>Niños</p>
                      <p className="text-[11px] m-0 mt-0.5" style={labelStyle}>3 a 11 años</p>
                    </td>
                    {/* Contador solo en la primera columna */}
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Counter
                          value={children}
                          onDec={() => setChildren(v => Math.max(0, v - 1))}
                          onInc={() => setChildren(v => v + 1)}
                          disableDec={children <= 0}
                          disableInc={atCapacity}
                        />
                        <span className="text-[11px]" style={labelStyle}>${CHILDREN_PRICE} c/u</span>
                      </div>
                    </td>
                    {/* Segunda columna: descripción del paquete */}
                    <td className="py-3 px-2" colSpan={PKG_IDS.length - 1}>
                      <span className="inline-flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        🍕 agua, sodas y pizza — paquete fijo
                      </span>
                    </td>
                  </tr>

                  {/* Bebés */}
                  <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface-alt)' }}>
                    <td className="py-3 pl-1 pr-2">
                      <p className="font-semibold text-xs m-0 leading-tight" style={{ color: 'var(--text-title)' }}>Bebés</p>
                      <p className="text-[11px] m-0 mt-0.5" style={labelStyle}>1 a 3 años · sin asiento</p>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Counter
                          value={babies}
                          onDec={() => setBabies(v => Math.max(0, v - 1))}
                          onInc={() => setBabies(v => v + 1)}
                          disableDec={babies <= 0}
                          disableInc={babies >= 10}
                        />
                        <span className="text-[11px] font-semibold" style={{ color: '#10B981' }}>Gratis</span>
                      </div>
                    </td>
                    <td className="py-3 px-2" colSpan={PKG_IDS.length - 1}>
                      <span className="inline-flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        🍼 sin asiento asignado
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Aviso adulto requerido */}
            <div className="mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs"
              style={{
                background: totalAdults === 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                border: `1px solid ${totalAdults === 0 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
                color:  totalAdults === 0 ? '#d97706' : '#059669',
              }}>
              <span>
                {totalAdults === 0
                  ? <><b>Se requiere al menos 1 adulto</b> para poder realizar la reservación y abordar el barco.</>
                  : <><b>{totalAdults} adulto{totalAdults !== 1 ? 's' : ''}</b> incluido{totalAdults !== 1 ? 's' : ''} en la tripulación.</>
                }
              </span>
            </div>

            {/* Resumen de precio en vivo */}
            {totalPassengers > 0 && (
              <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {PKG_IDS.map(id => {
                  const p   = PACKAGES[id]
                  const c   = counts[id]
                  const tot = pkgCosts[id]
                  if (tot === 0) return null
                  return (
                    <div key={id}>
                      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'var(--bg-surface-alt)', borderBottom: '1px solid var(--border)' }}>
                        <span className="text-sm">{p.icon}</span>
                        <span className="font-semibold text-xs" style={{ color: 'var(--text-title)' }}>{p.label}</span>
                        <span className="ml-auto font-bold text-sm" style={{ color: 'var(--accent)' }}>{formatCurrency(tot)}</span>
                      </div>
                      <div className="px-4 py-2 space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {c.adults > 0 && <div className="flex justify-between"><span>{c.adults} adulto{c.adults !== 1 ? 's' : ''}</span><span>{formatCurrency(c.adults * p.adultPrice)}</span></div>}
                        {c.youth  > 0 && <div className="flex justify-between"><span>{c.youth} adolescente{c.youth !== 1 ? 's' : ''}</span><span>{formatCurrency(c.youth * p.youthPrice)}</span></div>}
                      </div>
                    </div>
                  )
                })}
                {children > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'var(--bg-surface-alt)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                      <span className="text-sm">🍕</span>
                      <span className="font-semibold text-xs" style={{ color: 'var(--text-title)' }}>Niños · agua, sodas y pizza</span>
                      <span className="ml-auto font-bold text-sm" style={{ color: 'var(--accent)' }}>{formatCurrency(childrenCost)}</span>
                    </div>
                    <div className="px-4 py-2 text-xs flex justify-between" style={{ color: 'var(--text-muted)' }}>
                      <span>{children} niño{children !== 1 ? 's' : ''}</span><span>{formatCurrency(childrenCost)}</span>
                    </div>
                  </div>
                )}
                {babies > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <span>{babies} bebé{babies !== 1 ? 's' : ''}</span>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>Gratis</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline px-4 py-3 font-bold" style={{ borderTop: '2px solid var(--border)', color: 'var(--text-title)' }}>
                  <span className="text-xs uppercase tracking-wider" style={labelStyle}>Total</span>
                  <span className="text-xl" style={{ color: 'var(--accent)' }}>{formatCurrency(total)}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── II. Fecha y hora ──────────────────────────────────────────────── */}
        <section className="rounded-xl p-5 space-y-4" style={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center font-display font-bold text-xs"
              style={{ background: 'var(--accent)', color: '#000' }}>II</div>
            <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Fecha y hora</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>Fecha *</label>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>Horario *</label>
              <select
                value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={inputStyle}
              >
                {activeSlots.map(t => {
                  const meta = slotMeta(t)
                  return (
                    <option key={t} value={t}>
                      {meta.icon} {meta.label} — {t}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>
        </section>

        {/* ── III. Datos del cliente ────────────────────────────────────────── */}
        <section className="rounded-xl p-5 space-y-4" style={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center font-display font-bold text-xs"
              style={{ background: 'var(--accent)', color: '#000' }}>III</div>
            <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Datos del cliente</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>Nombre *</label>
              <input
                type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                placeholder="Nombre completo" required
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>Teléfono *</label>
              <input
                type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                placeholder="638 123 4567" required
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={inputStyle}
              />
            </div>
          </div>
        </section>

        {/* ── IV. Estado de pago ────────────────────────────────────────────── */}
        <section className="rounded-xl p-5 space-y-4" style={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center font-display font-bold text-xs"
              style={{ background: 'var(--accent)', color: '#000' }}>IV</div>
            <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Estado de pago</h2>
          </div>
          <div className="flex gap-3">
            {(['pendiente', 'pagada'] as const).map(s => (
              <button
                key={s} type="button" onClick={() => setInitialStatus(s)}
                className="flex-1 py-2.5 px-4 rounded-lg border text-sm font-semibold transition-all"
                style={{
                  borderColor: initialStatus === s ? 'var(--accent)' : 'var(--border)',
                  background:  initialStatus === s ? 'rgba(var(--accent-rgb), 0.08)' : 'var(--bg-surface-alt)',
                  color:       initialStatus === s ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {s === 'pendiente' ? '⏳ Pendiente' : '✅ Pagada'}
              </button>
            ))}
          </div>
          {initialStatus === 'pagada' && (
            <div>
              <label className="block text-xs font-semibold mb-2" style={labelStyle}>Método de pago *</label>
              <div className="flex gap-3">
                {([
                  { key: 'efectivo'      as PaymentMethod, label: 'Efectivo',      icon: <Banknote className="w-4 h-4" /> },
                  { key: 'transferencia' as PaymentMethod, label: 'Transferencia', icon: <ArrowLeftRight className="w-4 h-4" /> },
                ]).map(({ key, label, icon }) => (
                  <button
                    key={key} type="button" onClick={() => setPaymentMethod(key)}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all"
                    style={{
                      borderColor: paymentMethod === key ? 'var(--accent)' : 'var(--border)',
                      background:  paymentMethod === key ? 'rgba(var(--accent-rgb), 0.08)' : 'var(--bg-surface-alt)',
                      color:       paymentMethod === key ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── V. Notas ──────────────────────────────────────────────────────── */}
        <section className="rounded-xl p-5 space-y-2" style={cardStyle}>
          <label className="block font-display font-bold text-sm" style={{ color: 'var(--text-title)' }}>
            Notas internas
          </label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Alergias, solicitudes especiales, grupos… (opcional)"
            rows={3} className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none resize-none" style={inputStyle}
          />
        </section>

        {/* Submit */}
        <Button type="submit" variant="primary" className="w-full" disabled={isPending || totalAdults === 0}>
          {isPending ? 'Creando reservación…' : <><Plus className="w-4 h-4" /> Crear Reservación</>}
        </Button>
      </form>
    </div>
  )
}
