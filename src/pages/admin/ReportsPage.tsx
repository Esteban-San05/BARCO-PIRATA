import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileSpreadsheet, FileText, TrendingUp, Users, DollarSign,
  CalendarRange, Package, BarChart3, XCircle, Baby,
} from 'lucide-react'
import { reportService } from '@features/reports/services/reportService'
import { formatCurrency, formatDate } from '@utils/formatters'
import { PACKAGES } from '@constants/index'
import type { PackageId } from '@constants/index'
import { Button } from '@components/ui/Button'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { PeriodPicker, DEFAULT_PERIOD, type Period } from '@components/ui/PeriodPicker'
import { BarChart, LineChart, DonutChart } from '@components/ui/Charts'

const PACKAGE_COLORS: Record<string, string> = {
  CON_COMIDA:   '#F0B429',
  SOLO_BEBIDAS: '#3B82F6',
  NINOS:        '#10B981',
}

const PAYMENT_COLORS: Record<string, string> = {
  efectivo:      '#F0B429',
  transferencia: '#10B981',
}

// ════════════════════════════════════════════════════════════════════════
//   KPI Card
// ════════════════════════════════════════════════════════════════════════
function KpiCard({
  icon: Icon, label, value, hint, accent = false, delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
  accent?: boolean
  delay?: number
}) {
  return (
    <div
      className={['bp-kpi-card visible', accent ? 'bp-kpi-card--accent' : ''].join(' ')}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="bp-kpi-icon">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="bp-kpi-label">{label}</p>
        <p className="bp-kpi-value">{value}</p>
        {hint && <p className="bp-kpi-hint">{hint}</p>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//   Página de Reportes
// ════════════════════════════════════════════════════════════════════════
export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD)

  const { data: report, isLoading, isError, error } = useQuery({
    queryKey: ['rangeReport', period.startDate, period.endDate, period.granularity],
    queryFn: () => reportService.getRangeReport(period.startDate, period.endDate, period.granularity),
  })

  const seriesForCharts = useMemo(
    () => (report?.series ?? []).map((p) => ({
      label: p.label,
      value: p.revenue,
      sublabel: `${p.reservations} reserv.`,
    })),
    [report],
  )
  const peopleSeries = useMemo(
    () => (report?.series ?? []).map((p) => ({ label: p.label, value: p.people })),
    [report],
  )

  const packageDonut = useMemo(() => {
    if (!report) return []
    const entries: { label: string; value: number; color: string }[] = []
    for (const k of Object.keys(report.byPackage) as PackageId[]) {
      const pkg = PACKAGES[k]
      const s   = report.byPackage[k]
      if (pkg && s.people > 0) {
        entries.push({ label: String(pkg.label), value: s.people, color: PACKAGE_COLORS[k] ?? '#6B7280' })
      }
    }
    if (report.totalBabies > 0) {
      entries.push({ label: 'Bebés (gratis)' as string, value: report.totalBabies, color: '#8B5CF6' })
    }
    return entries
  }, [report])

  const paymentDonut = useMemo(() => {
    if (!report) return []
    return Object.entries(report.byPaymentMethod).map(([method, s]) => ({
      label: method.replace(/_/g, ' '),
      value: s.revenue,
      color: PAYMENT_COLORS[method] ?? '#6B7280',
    }))
  }, [report])

  const avgTicket = report && report.totalReservations
    ? report.totalRevenue / report.totalReservations
    : 0

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <p className="text-sm min-w-0" style={{ color: 'var(--text-muted)' }}>
          Analiza el desempeño de reservaciones, ocupación e ingresos.
        </p>

        <div className="flex flex-col gap-2 w-full lg:w-auto">
          <PeriodPicker value={period} onChange={setPeriod} />
          {report && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => reportService.exportRangeToExcel(report)}
                disabled={!report.totalReservations}
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reportService.exportRangeToPDF(report)}
                disabled={!report.totalReservations}
              >
                <FileText className="w-4 h-4" /> PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Estados */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}
      {isError && (
        <div className="panel-danger text-center">
          Error al cargar el reporte: {(error as Error)?.message ?? 'desconocido'}
        </div>
      )}

      {report && !isLoading && (
        <>
          {/* Banda de período activo */}
          <div className="flex items-start gap-2 text-sm admin-text-muted flex-wrap">
            <CalendarRange className="w-4 h-4 text-gold-500 shrink-0 mt-0.5" />
            <span className="min-w-0 break-words">
              Periodo analizado:&nbsp;
              <span className="font-semibold admin-text-body">
                {formatDate(report.startDate)} → {formatDate(report.endDate)}
              </span>
            </span>
          </div>

          {/* KPIs */}
          <div className="bp-kpi-grid">
            <KpiCard
              icon={TrendingUp}
              label="Reservaciones"
              value={String(report.totalReservations)}
              hint={`${report.series.length} ${report.granularity === 'day' ? 'día(s)' : report.granularity === 'month' ? 'mes(es)' : 'año(s)'} con datos`}
              delay={0}
            />
            <KpiCard
              icon={Users}
              label="Personas"
              value={String(report.totalPeople)}
              hint={report.totalReservations
                ? `${(report.totalPeople / report.totalReservations).toFixed(1)} por reserva`
                : '—'}
              delay={60}
            />
            <KpiCard
              icon={DollarSign}
              label="Ingresos"
              value={formatCurrency(report.totalRevenue)}
              hint={`Ticket prom. ${formatCurrency(avgTicket)}`}
              accent
              delay={120}
            />
            <KpiCard
              icon={BarChart3}
              label="Mejor período"
              value={
                report.series.length
                  ? report.series.reduce((a, b) => (a.revenue > b.revenue ? a : b)).label
                  : '—'
              }
              hint={
                report.series.length
                  ? formatCurrency(report.series.reduce((a, b) => (a.revenue > b.revenue ? a : b)).revenue)
                  : 'Sin datos'
              }
              delay={180}
            />
          </div>

          {/* KPI canceladas */}
          {report.totalCancelled > 0 && (
            <div
              className="flex items-center gap-4 rounded-xl px-5 py-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}
            >
              <XCircle className="w-5 h-5 shrink-0" style={{ color: '#f87171' }} />
              <div>
                <span className="font-bold" style={{ color: '#f87171' }}>
                  {report.totalCancelled} reservación{report.totalCancelled !== 1 ? 'es' : ''} cancelada{report.totalCancelled !== 1 ? 's' : ''}
                </span>
                <span className="ml-2" style={{ color: 'var(--text-muted)' }}>en el período — no se contabilizan en los ingresos</span>
              </div>
            </div>
          )}

          {/* Desglose por tipo de pasajero */}
          <section
            className="rounded-xl p-4 sm:p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <header className="flex items-center gap-2 mb-4">
              <Baby className="w-5 h-5 text-gold-500" />
              <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Pasajeros por tipo</h2>
            </header>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Adultos',      count: report.totalAdults,   revenue: report.revenueAdults,   color: '#F0B429' },
                { label: 'Adolescentes', count: report.totalYouth,    revenue: report.revenueYouth,    color: '#3B82F6' },
                { label: 'Niños',        count: report.totalChildren, revenue: report.revenueChildren, color: '#10B981' },
                { label: 'Bebés',        count: report.totalBabies,   revenue: 0,                      color: '#8B5CF6' },
              ].map(({ label, count, revenue, color }) => (
                <div
                  key={label}
                  className="rounded-lg p-3 text-center"
                  style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border)' }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="text-2xl font-bold mb-1" style={{ color }}>{count}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {revenue > 0 ? formatCurrency(revenue) : label === 'Bebés' ? 'Gratis' : '—'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Gráfica principal — Ingresos por período */}
          <section
            className="rounded-xl p-4 sm:p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-gold-500" />
                <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>
                  Ingresos por {report.granularity === 'day' ? 'día' : report.granularity === 'month' ? 'mes' : 'año'}
                </h2>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{report.series.length} puntos</span>
            </header>
            <LineChart
              data={seriesForCharts}
              valueFormatter={(v) => formatCurrency(v)}
              height={240}
            />
          </section>

          {/* Dos columnas: personas + paquetes */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section
              className="rounded-xl p-4 sm:p-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <header className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-gold-500" />
                <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Personas embarcadas</h2>
              </header>
              <BarChart
                data={peopleSeries.map((d) => ({ label: d.label, value: d.value }))}
                valueFormatter={(v) => `${v} personas`}
                height={240}
              />
            </section>

            <section
              className="rounded-xl p-4 sm:p-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <header className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-gold-500" />
                <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Distribución por paquete</h2>
              </header>
              {packageDonut.length ? (
                <DonutChart
                  data={packageDonut}
                  centerValue={String(report.totalPeople)}
                  centerLabel="Personas"
                  valueFormatter={(v) => `${v} personas`}
                />
              ) : (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin datos en el período.</p>
              )}
            </section>
          </div>

          {/* Pago + detalle de paquetes */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section
              className="rounded-xl p-4 sm:p-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <header className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-gold-500" />
                <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Efectivo vs Transferencia</h2>
              </header>
              {paymentDonut.length ? (
                <DonutChart
                  data={paymentDonut}
                  centerValue={formatCurrency(report.totalRevenue)}
                  centerLabel="Total"
                  valueFormatter={(v) => formatCurrency(v)}
                />
              ) : (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin pagos registrados.</p>
              )}
            </section>

            <section
              className="rounded-xl p-4 sm:p-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <header className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-gold-500" />
                <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Desglose por paquete</h2>
              </header>
              <div className="space-y-4">
                {(Object.keys(report.byPackage) as PackageId[]).map((pkgId) => {
                  const pkg = PACKAGES[pkgId]
                  if (!pkg) return null
                  const stats = report.byPackage[pkgId]
                  const pct = report.totalPeople
                    ? Math.round((stats.people / report.totalPeople) * 100)
                    : 0
                  return (
                    <div key={pkgId}>
                      <div className="flex justify-between items-baseline text-sm mb-1.5">
                        <span className="font-semibold" style={{ color: 'var(--text-body)' }}>
                          <span className="mr-1.5">{pkg.icon}</span>{pkg.label}
                        </span>
                        <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          <span className="font-semibold" style={{ color: 'var(--text-title)' }}>{stats.people}</span> personas ·&nbsp;
                          <span className="font-semibold text-gold-600">{formatCurrency(stats.revenue)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-alt)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #F7C948, #F0B429)' }}
                        />
                      </div>
                      <p className="text-[11px] mt-0.5 text-right" style={{ color: 'var(--text-subtle)' }}>{pct}% del total</p>
                    </div>
                  )
                })}
                {report.totalBabies > 0 && (() => {
                  const pct = report.totalPeople
                    ? Math.round((report.totalBabies / report.totalPeople) * 100)
                    : 0
                  return (
                    <div>
                      <div className="flex justify-between items-baseline text-sm mb-1.5">
                        <span className="font-semibold" style={{ color: 'var(--text-body)' }}>
                          <span className="mr-1.5">👶</span>Bebés
                        </span>
                        <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          <span className="font-semibold" style={{ color: '#8B5CF6' }}>{report.totalBabies}</span> personas ·&nbsp;
                          <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Gratis</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-alt)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #A78BFA, #8B5CF6)' }}
                        />
                      </div>
                      <p className="text-[11px] mt-0.5 text-right" style={{ color: 'var(--text-subtle)' }}>{pct}% del total</p>
                    </div>
                  )
                })()}
              </div>
            </section>
          </div>

          {/* Tabla de canceladas */}
          {report.cancelledReservations.length > 0 && (
            <section
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-surface)', border: '1px solid rgba(248,113,113,0.3)', boxShadow: 'var(--shadow-card)' }}
            >
              <header className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'rgba(248,113,113,0.2)' }}>
                <XCircle className="w-5 h-5" style={{ color: '#f87171' }} />
                <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>
                  Reservaciones canceladas
                  <span className="ml-2 text-sm font-normal" style={{ color: '#f87171' }}>
                    ({report.cancelledReservations.length})
                  </span>
                </h2>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--bg-surface-alt)' }}>
                    <tr>
                      {['Fecha', 'Hora', 'Cliente', 'Teléfono', 'Personas', 'Paquete', 'Total'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-5 py-3 font-bold text-xs uppercase tracking-wider ${i > 2 ? 'hidden sm:table-cell' : ''} ${i > 4 ? 'text-right' : ''}`}
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.cancelledReservations.map((r) => (
                      <tr
                        key={r.id}
                        style={{ borderTop: '1px solid var(--border)', opacity: 0.7 }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--bg-surface-alt)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent' }}
                      >
                        <td className="px-5 py-3" style={{ color: 'var(--text-body)' }}>{formatDate(r.date)}</td>
                        <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{r.time}</td>
                        <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-body)' }}>{r.contactName}</td>
                        <td className="hidden sm:table-cell px-5 py-3" style={{ color: 'var(--text-muted)' }}>{r.contactPhone}</td>
                        <td className="hidden sm:table-cell px-5 py-3 text-center" style={{ color: 'var(--text-muted)' }}>{r.totalPassengers}</td>
                        <td className="hidden sm:table-cell px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                          {r.packageId.replace(/_/g, ' ')}
                        </td>
                        <td className="hidden sm:table-cell px-5 py-3 text-right line-through" style={{ color: 'var(--text-muted)' }}>
                          {formatCurrency(r.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Tabla de serie */}
          <section
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <header className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <CalendarRange className="w-5 h-5 text-gold-500" />
              <h2 className="font-display font-bold" style={{ color: 'var(--text-title)' }}>Detalle por período</h2>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg-surface-alt)' }}>
                  <tr className="text-left">
                    {['Período', 'Reservas', 'Personas', 'Ingresos'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3 font-bold text-xs uppercase tracking-wider ${i > 0 ? 'text-right' : ''}`}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.series.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                        Sin datos en el período seleccionado.
                      </td>
                    </tr>
                  )}
                  {report.series.map((p) => (
                    <tr
                      key={p.key}
                      style={{ borderTop: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-alt)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-body)' }}>{p.label}</td>
                      <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--text-body)' }}>{p.reservations}</td>
                      <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--text-body)' }}>{p.people}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-gold-600">
                        {formatCurrency(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
