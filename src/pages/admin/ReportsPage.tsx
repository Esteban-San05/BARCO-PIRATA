import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, BarChart3 } from 'lucide-react'
import { reportService } from '@features/reports/services/reportService'
import { formatCurrency, formatDate } from '@utils/formatters'
import { PACKAGES } from '@constants/index'
import type { PackageId } from '@constants/index'
import { Button } from '@components/ui/Button'
import { Card, CardHeader, CardTitle } from '@components/ui/Card'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { todayISO } from '@utils/formatters'

export default function ReportsPage() {
  const [date, setDate] = useState(todayISO())

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['report', date],
    queryFn: () => reportService.getDailyReport(date),
    enabled: !!date,
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-display font-bold text-navy-900">Reportes</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field w-auto"
          />
          {report && (
            <>
              <Button variant="outline" size="sm" onClick={() => reportService.exportToExcel(report)}>
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => reportService.exportToPDF(report)}>
                <FileText className="w-4 h-4" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>}
      {isError && (
        <div className="panel-danger text-center">
          Error al cargar el reporte.
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Resumen general */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Reservaciones',    value: report.totalReservations,            accent: false },
              { label: 'Personas totales', value: report.totalPeople,                  accent: false },
              { label: 'Ingresos totales', value: formatCurrency(report.totalRevenue), accent: true  },
              { label: 'Fecha',            value: formatDate(report.date),             accent: false },
            ].map(({ label, value, accent }) => (
              <Card key={label} className={`text-center border ${accent ? 'border-gold-300 bg-gold-50' : 'border-navy-100'}`}>
                <p className="text-xs text-navy-500 mb-1">{label}</p>
                <p className={`text-xl font-bold ${accent ? 'text-gold-700' : 'text-navy-900'}`}>{value}</p>
              </Card>
            ))}
          </div>

          {/* Por paquete */}
          <Card className="border border-navy-100">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gold-600" />
                <CardTitle>Por Paquete</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-3">
              {Object.entries(report.byPackage).map(([pkgId, stats]) => {
                const pkg = PACKAGES[pkgId as PackageId]
                const pct = report.totalReservations
                  ? Math.round((stats.count / report.totalReservations) * 100)
                  : 0
                return (
                  <div key={pkgId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-navy-900">{pkg.icon} {pkg.label}</span>
                      <span className="text-navy-500">{stats.count} reserv. · {formatCurrency(stats.revenue)}</span>
                    </div>
                    <div className="h-2 bg-navy-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold-gradient rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Por método de pago */}
          <Card className="border border-navy-100">
            <CardHeader><CardTitle>Por Método de Pago</CardTitle></CardHeader>
            <div className="divide-y divide-navy-100">
              {Object.entries(report.byPaymentMethod).map(([method, stats]) => (
                <div key={method} className="flex justify-between py-3 text-sm">
                  <span className="capitalize font-medium text-navy-900">{method.replace('_', ' ')}</span>
                  <div className="text-right">
                    <p className="font-semibold text-gold-700">{formatCurrency(stats.revenue)}</p>
                    <p className="text-xs text-navy-400">{stats.count} transacción(es)</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
