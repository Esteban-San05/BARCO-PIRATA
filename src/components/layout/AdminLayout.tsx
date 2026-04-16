import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Anchor, LayoutDashboard, CalendarCheck, BarChart3,
  LogOut, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@app/providers'
import { COMPANY } from '@constants/index'

const navItems = [
  { to: '/admin',                icon: LayoutDashboard, label: 'Dashboard',      end: true  },
  { to: '/admin/reservaciones',  icon: CalendarCheck,   label: 'Reservaciones',  end: false },
  { to: '/admin/reportes',       icon: BarChart3,       label: 'Reportes',       end: false },
]

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen flex bg-navy-50">
      {/* Sidebar */}
      <aside className="w-64 bg-navy-900 text-white flex flex-col fixed inset-y-0 left-0 z-40 shadow-card-lg">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-white/10">
          <Anchor className="w-6 h-6 text-gold-400" />
          <span className="font-display font-bold text-gold-400">{COMPANY.shortName}</span>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-white/10">
          <p className="text-xs text-navy-300 uppercase tracking-wider mb-0.5">Sesión activa</p>
          <p className="text-sm font-medium text-white truncate">{user?.email}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                  isActive
                    ? 'bg-gold-400 text-navy-900'
                    : 'text-navy-200 hover:text-white hover:bg-white/10'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-navy-200 hover:text-white hover:bg-pirate-600 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="bg-white border-b border-navy-100 h-16 flex items-center px-8 sticky top-0 z-30">
          <h1 className="text-lg font-semibold text-navy-900">Panel de Administración</h1>
        </header>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
