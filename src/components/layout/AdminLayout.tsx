import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarCheck, BarChart3, Settings, Clock,
  LogOut, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@app/providers'
import { COMPANY } from '@constants/index'

const navItems = [
  { to: '/admin',                icon: LayoutDashboard, label: 'Dashboard',      end: true  },
  { to: '/admin/reservaciones',  icon: CalendarCheck,   label: 'Reservaciones',  end: false },
  { to: '/admin/reportes',       icon: BarChart3,       label: 'Reportes',       end: false },
  { to: '/admin/horarios',       icon: Clock,           label: 'Horarios',       end: false },
  { to: '/admin/ajustes',        icon: Settings,        label: 'Ajustes',        end: false },
]

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <div className="admin-scope min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-navy-900 text-white flex flex-col fixed inset-y-0 left-0 z-40 shadow-card-lg">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/10">
          <img
            src="/images/logo.png"
            alt={COMPANY.shortName}
            className="h-8 w-auto object-contain drop-shadow-[0_2px_8px_rgba(247,201,72,0.5)]"
          />
          <span className="font-display font-bold text-gold-400 text-xs tracking-wider uppercase leading-tight truncate">
            {COMPANY.shortName}
          </span>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-white/10">
          <p className="text-xs text-navy-300 uppercase tracking-wider mb-0.5">Sesión activa</p>
          <p className="text-sm font-medium text-white truncate">{user?.email}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                  isActive
                    ? 'admin-accent-bg'
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
        <header className="admin-surface border-b admin-border h-16 flex items-center px-8 sticky top-0 z-30">
          <h1 className="text-lg font-semibold admin-text-title">Panel de Administración</h1>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
