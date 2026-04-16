import { Users, CalendarCheck, DollarSign, TrendingUp } from 'lucide-react'
import { useReservationStore } from '@app/store/reservationStore'
import { useReservationsByDate } from '@features/reservations/hooks/useReservations'
import { formatCurrency, formatDate } from '@utils/formatters'
import { StatusBadge } from '@components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@components/ui/Card'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { Link } from 'react-router-dom'
import { Button } from '@components/ui/Button'

export default function DashboardPage() {
  const { selectedDate, setSelectedDate } = useReservationStore()
  const { data, isLoading } = useReservationsByDate(selectedDate)

  const reservations = data?.data ?? []
  const totalRevenue = reservations
    .filter((r) => r.status === 'pagada')
    .reduce((sum, r) => sum + r.total, 0)
  const totalPeople = reservations.reduce((sum, r) => sum + r.numberOfPeople, 0)

  // Paleta pirata: navy para métricas neutras, gold para dinero, pirate para alertas si hubiera
  const stats = [
    { label: 'Reservaciones',    value: reservations.length,        icon: CalendarCheck, iconBg: 'bg-navy-100',   iconColor: 'text-navy-700'  },
    { label: 'Personas',         value: totalPeople,                icon: Users,         iconBg: 'bg-navy-100',   iconColor: 'text-navy-700'  },
    { label: 'Ingresos del día', value: formatCurrency(totalRevenue), icon: DollarSign,  iconBg: 'bg-gold-100',   iconColor: 'text-gold-700'  },
    {
      label: 'Tasa de pago',
      value: `${reservations.length ? Math.round((reservations.filter(r => r.status === 'pagada').length / reservations.length) * 100) : 0}%`,
      icon: TrendingUp, iconBg: 'bg-gold-100', iconColor: 'text-gold-700'
    },
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy-900">Dashboard</h1>
          <p className="text-navy-500 text-sm mt-1">Resumen del día seleccionado</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input-field w-auto"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
          <Card key={label} className="flex items-center gap-4 border border-navy-100">
            <div className={`p-2.5 rounded-lg ${iconBg} ${iconColor}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-navy-500">{label}</p>
              <p className="text-xl font-bold text-navy-900">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabla de reservaciones */}
      <Card padding="none" className="border border-navy-100">
        <CardHeader className="px-6 pt-6">
          <div className="flex justify-between items-center">
            <CardTitle>Reservaciones – {formatDate(selectedDate)}</CardTitle>
            <Link to="/admin/reservaciones">
              <Button variant="ghost" size="sm">Ver todas</Button>
            </Link>
          </div>
        </CardHeader>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : reservations.length === 0 ? (
          <p className="text-center text-navy-400 py-12">No hay reservaciones para esta fecha.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-navy-600 text-xs uppercase">
                <tr>
                  {['Nombre', 'Hora', 'Personas', 'Paquete', 'Total', 'Estado', 'Acción'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-navy-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-navy-900">{r.contactName}</td>
                    <td className="px-6 py-4 text-navy-600">{r.time}</td>
                    <td className="px-6 py-4 text-navy-700">{r.numberOfPeople}</td>
                    <td className="px-6 py-4 text-navy-600">{r.packageId.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-4 font-semibold text-gold-700">{formatCurrency(r.total)}</td>
                    <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                    <td className="px-6 py-4">
                      <Link to={`/admin/venta/${r.id}`}>
                        <Button variant="ghost" size="sm">Ver</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
