import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Minus, Plus } from 'lucide-react'
import { PACKAGES, TIME_SLOTS, CHILDREN_PRICE, BOAT_CAPACITY } from '@constants/index'
import type { PackageId } from '@constants/index'
import { formatCurrency, formatDate } from '@utils/formatters'
import { useReservation, useUpdateReservation } from '@features/reservations/hooks/useReservations'
import { useBusinessSettings } from '@features/settings/hooks/useBusinessSettings'
import { Button } from '@components/ui/Button'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'

// ─── Tipos (misma lógica que NewReservationPage) ──────────────────────────────
type AgeGroup  = 'adults' | 'youth'
type PkgCounts = Record<PackageId, Record<AgeGroup, number>>

const PKG_IDS = Object.keys(PACKAGES) as PackageId[]

const EMPTY_COUNTS = (): PkgCounts =>
  Object.fromEntries(PKG_IDS.map(id => [id, { adults: 0, youth: 0 }])) as PkgCounts

// Inicializa los contadores desde una reservación existente.
// Si existe package_breakdown lo usa; si no, pone todo bajo el paquete dominante.
const countsFromReservation = (
  pkgId: PackageId,
  adults: number,
  youth: number,
  breakdown: import('@app-types/index').PackageBreakdownItem[] | null,
): PkgCounts => {
  const c = EMPTY_COUNTS()
  if (breakdown?.length) {
    for (const item of breakdown) {
      if (item.packageId in c) {
        c[item.packageId].adults = item.adults
        c[item.packageId].youth  = item.youth
      }
    }
  } else if (pkgId in c) {
    c[pkgId].adults = adults
    c[pkgId].youth  = youth
  }
  return c
}

// ─── Counter ─────────────────────────────────────────────────────────────────
function Counter({ value, onDec, onInc, disableDec, disableInc }: {
  value: number; onDec: () => void; onInc: () => void
  disableDec: boolean; disableInc: boolean
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button type="button" onClick={onDec} disabled={disableDec}
        className="w-7 h-7 rounded-full border flex items-center justify-center transition-colors disabled:opacity-25"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
        <Minus size={12} />
      </button>
      <span className="w-5 text-center font-bold text-sm" style={{ color: 'var(--text-title)' }}>{value}</span>
      <button type="button" onClick={onInc} disabled={disableInc}
        className="w-7 h-7 rounded-full border flex items-center justify-center transition-colors disabled:opacity-25"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
        <Plus size={12} />
      </button>
    </div>
  )
}

const cardStyle  = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }
const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-surface-alt)', color: 'var(--text-body)' }
const labelStyle = { color: 'var(--text-muted)' }

// ─── Página ──────────────────────────────────────────────────────────────────
export default function EditReservationPage() {
  const { reservationId } = useParams<{ reservationId: string }>()
  const navigate          = useNavigate()

  const { data: reservation, isLoading } = useReservation(reservationId ?? '')
  const { mutateAsync: updateReservation, isPending } = useUpdateReservation()
  const { data: bizSettings } = useBusinessSettings()

  const activeTimeSlots = bizSettings?.activeTimeSlots ?? TIME_SLOTS.map(s => s.time)

  // Estado local — se inicializa una vez que llega la reservación
  const [initialized, setInitialized] = useState(false)
  const [counts,   setCounts]   = useState<PkgCounts>(EMPTY_COUNTS)
  const [children, setChildren] = useState(0)
  const [babies,   setBabies]   = useState(0)
  const [date,     setDate]     = useState('')
  const [time,     setTime]     = useState('')
  const [error,    setError]    = useState<string | null>(null)

  // Pre-cargar datos cuando llega la reservación
  if (reservation && !initialized) {
    setCounts(countsFromReservation(
      reservation.packageId as PackageId,
      reservation.adults,
      reservation.youth,
      reservation.packageBreakdown ?? null,
    ))
    setChildren(reservation.children)
    setBabies(reservation.babies)
    setDate(reservation.date)
    setTime(reservation.time)
    setInitialized(true)
  }

  const inc = (pkg: PackageId, group: AgeGroup) =>
    setCounts(prev => ({ ...prev, [pkg]: { ...prev[pkg], [group]: prev[pkg][group] + 1 } }))
  const dec = (pkg: PackageId, group: AgeGroup) =>
    setCounts(prev => ({ ...prev, [pkg]: { ...prev[pkg], [group]: Math.max(0, prev[pkg][group] - 1) } }))

  // ── Totales derivados ────────────────────────────────────────────────────────
  const totalAdults    = PKG_IDS.reduce((s, id) => s + counts[id].adults, 0)
  const totalYouth     = PKG_IDS.reduce((s, id) => s + counts[id].youth,  0)
  const numberOfPeople = totalAdults + totalYouth + children
  const totalPax       = numberOfPeople + babies
  const atCapacity     = numberOfPeople >= BOAT_CAPACITY

  const dominantPkg = useMemo<PackageId>(() =>
    PKG_IDS.reduce((best, id) => {
      const n     = counts[id].adults + counts[id].youth
      const bestN = counts[best].adults + counts[best].youth
      return n > bestN ? id : best
    }, PKG_IDS[0])
  , [counts])

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

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!date)           return setError('La fecha es requerida.')
    if (!time)           return setError('El horario es requerido.')
    if (totalAdults === 0) return setError('Se requiere al menos 1 adulto.')

    const pkgBreakdownItems: import('@app-types/index').PackageBreakdownItem[] = PKG_IDS
      .filter(id => id !== 'NINOS')
      .map(id => {
        const p = PACKAGES[id]
        const c = counts[id]
        const t = c.adults * p.adultPrice + c.youth * p.youthPrice
        if (c.adults === 0 && c.youth === 0) return null
        return { packageId: id, adults: c.adults, adultPrice: p.adultPrice, youth: c.youth, youthPrice: p.youthPrice, total: t }
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
      await updateReservation({
        id: reservationId!,
        date, time,
        packageId:        dominantPkg,
        packageBreakdown: pkgBreakdownItems,
        adults:           totalAdults,
        youth:            totalYouth,
        children,
        babies,
        adultsCost,
        youthCost,
        childrenCost,
        numberOfPeople,
        subtotal:         total,
        total,
        serviceType:      numberOfPeople >= 10 ? 'grupal' : 'individual',
      })
      navigate(`/admin/venta/${reservationId}`)
    } catch (e) {
      setError((e as Error).message ?? 'Error al actualizar la reservación.')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (!reservation) return (
    <div className="text-center py-20 text-sm" style={labelStyle}>Reservación no encontrada.</div>
  )

  if (reservation.status === 'cancelada') return (
    <div className="text-center py-20 text-sm" style={labelStyle}>
      Las reservaciones canceladas no pueden editarse.
    </div>
  )

  const AGE_GROUPS: { key: AgeGroup; label: string; desc: string; priceKey: 'adultPrice' | 'youthPrice' }[] = [
    { key: 'adults', label: 'Adultos',      desc: '18 años en adelante', priceKey: 'adultPrice' },
    { key: 'youth',  label: 'Adolescentes', desc: '12 a 17 años',        priceKey: 'youthPrice' },
  ]

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(`/admin/venta/${reservationId}`)}
          className="p-2 rounded-lg transition-colors"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-title)' }}>
            Editar Reservación
          </h1>
          <p className="text-sm" style={labelStyle}>
            {reservation.contactName} · {formatDate(reservation.date)} {reservation.time}
            {reservation.status === 'pagada' && (
              <span className="ml-2 text-amber-500 font-semibold">· Reservación ya pagada</span>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="px-4 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* ── I. Tripulación y paquetes ──────────────────────────────────────── */}
        <section className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center font-display font-bold text-xs"
                style={{ background: 'var(--accent)', color: '#000' }}>I</div>
              <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Tripulación y paquetes</h2>
            </div>
            <span className="text-xs" style={labelStyle}>
              {totalPax > 0
                ? `${totalPax} persona${totalPax !== 1 ? 's' : ''} · ${formatCurrency(total)}`
                : 'Sin pasajeros'}
            </span>
          </div>

          <div className="p-5">
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
                  {AGE_GROUPS.map(({ key, label, desc, priceKey }) => (
                    <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="py-3 pl-1 pr-2">
                        <p className="font-semibold text-xs m-0 leading-tight" style={{ color: 'var(--text-title)' }}>{label}</p>
                        <p className="text-[11px] m-0 mt-0.5" style={labelStyle}>{desc}</p>
                      </td>
                      {PKG_IDS.map(id => {
                        if (id === 'NINOS') return (
                          <td key={id} className="py-3 px-2 text-center">
                            <span className="inline-block text-[11px] rounded-lg px-2 py-1 select-none"
                              style={{ background: 'var(--bg-surface-alt)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                              Solo niños
                            </span>
                          </td>
                        )
                        if (PACKAGES[id].adultsOnly && key === 'youth') return (
                          <td key={id} className="py-3 px-2 text-center">
                            <span className="inline-block text-[11px] rounded-lg px-2 py-1 select-none"
                              style={{ background: 'var(--bg-surface-alt)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                              Solo adultos
                            </span>
                          </td>
                        )
                        const val = counts[id][key]
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
                              <span className="text-[11px]" style={labelStyle}>
                                ${PACKAGES[id][priceKey]} c/u
                              </span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  {/* Niños */}
                  <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface-alt)' }}>
                    <td className="py-3 pl-1 pr-2">
                      <p className="font-semibold text-xs m-0 leading-tight" style={{ color: 'var(--text-title)' }}>Niños</p>
                      <p className="text-[11px] m-0 mt-0.5" style={labelStyle}>3 a 11 años</p>
                    </td>
                    <td className="py-3 px-2" colSpan={PKG_IDS.length - 1}>
                      <span className="inline-flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        🍕 agua, sodas y pizza — paquete fijo
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Counter value={children}
                          onDec={() => setChildren(v => Math.max(0, v - 1))}
                          onInc={() => setChildren(v => v + 1)}
                          disableDec={children <= 0} disableInc={atCapacity} />
                        <span className="text-[11px]" style={labelStyle}>${CHILDREN_PRICE} c/u</span>
                      </div>
                    </td>
                  </tr>

                  {/* Bebés */}
                  <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface-alt)' }}>
                    <td className="py-3 pl-1 pr-2">
                      <p className="font-semibold text-xs m-0 leading-tight" style={{ color: 'var(--text-title)' }}>Bebés</p>
                      <p className="text-[11px] m-0 mt-0.5" style={labelStyle}>0 a 2 años · sin asiento</p>
                    </td>
                    <td className="py-3 px-2" colSpan={PKG_IDS.length - 1}>
                      <span className="inline-flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        🍼 sin asiento asignado
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Counter value={babies}
                          onDec={() => setBabies(v => Math.max(0, v - 1))}
                          onInc={() => setBabies(v => v + 1)}
                          disableDec={babies <= 0} disableInc={babies >= 10} />
                        <span className="text-[11px] font-semibold" style={{ color: '#10B981' }}>Gratis</span>
                      </div>
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
              {totalAdults === 0
                ? <><b>Se requiere al menos 1 adulto</b> para abordar el barco.</>
                : <><b>{totalAdults} adulto{totalAdults !== 1 ? 's' : ''}</b> en la tripulación.</>
              }
            </div>

            {/* Resumen en vivo */}
            {totalPax > 0 && (
              <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {PKG_IDS.map(id => {
                  const p = PACKAGES[id]; const c = counts[id]; const tot = pkgCosts[id]
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
                <div className="flex justify-between items-baseline px-4 py-3 font-bold" style={{ borderTop: '2px solid var(--border)' }}>
                  <div>
                    <span className="text-xs uppercase tracking-wider" style={labelStyle}>Nuevo total</span>
                    {reservation.total !== total && (
                      <span className="ml-2 text-xs line-through" style={labelStyle}>{formatCurrency(reservation.total)}</span>
                    )}
                  </div>
                  <span className="text-xl" style={{ color: 'var(--accent)' }}>{formatCurrency(total)}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── II. Fecha y hora ───────────────────────────────────────────────── */}
        <section className="rounded-xl p-5 space-y-4" style={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center font-display font-bold text-xs"
              style={{ background: 'var(--accent)', color: '#000' }}>II</div>
            <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Fecha y hora</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>Fecha *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>Horario *</label>
              <select value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={inputStyle}>
                {activeTimeSlots.map(ts => {
                  const known = TIME_SLOTS.find(s => s.time === ts)
                  const label = known ? `${known.icon} ${known.label} — ${ts}` : ts
                  return <option key={ts} value={ts}>{label}</option>
                })}
              </select>
            </div>
          </div>
        </section>

        {/* Acciones */}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1"
            onClick={() => navigate(`/admin/venta/${reservationId}`)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" className="flex-1"
            disabled={isPending || totalAdults === 0}>
            {isPending ? 'Guardando…' : <><Save className="w-4 h-4" /> Guardar cambios</>}
          </Button>
        </div>
      </form>
    </div>
  )
}
