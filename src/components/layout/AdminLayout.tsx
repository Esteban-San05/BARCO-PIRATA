import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, CalendarCheck, BarChart3, Settings, Clock, LogOut, Menu, Shield, DatabaseBackup } from 'lucide-react'
import { useAuth } from '@app/providers'
import { COMPANY } from '@constants/index'
import { AdminHeaderSlotProvider, useAdminHeaderSlot } from '@lib/AdminHeaderSlot'

const navItems = [
  { to: '/admin',               icon: LayoutDashboard, label: 'Dashboard',     end: true  },
  { to: '/admin/reservaciones', icon: CalendarCheck,   label: 'Reservaciones', end: false },
  { to: '/admin/reportes',      icon: BarChart3,       label: 'Reportes',      end: false },
  { to: '/admin/horarios',      icon: Clock,           label: 'Horarios',      end: false },
  { to: '/admin/bitacora',      icon: Shield,          label: 'Bitácora',      end: false },
  { to: '/admin/respaldo',      icon: DatabaseBackup,  label: 'Respaldo',      end: false },
  { to: '/admin/ajustes',       icon: Settings,        label: 'Ajustes',       end: false },
]

const PAGE_TITLES: Record<string, string> = {
  '/admin':               'Dashboard',
  '/admin/reservaciones': 'Reservaciones',
  '/admin/reportes':      'Reportes',
  '/admin/horarios':      'Horarios',
  '/admin/ajustes':       'Ajustes',
  '/admin/bitacora':      'Bitácora de Accesos',
  '/admin/respaldo':      'Respaldo y Recuperación',
}

export function AdminLayout() {
  return (
    <AdminHeaderSlotProvider>
      <AdminLayoutInner />
    </AdminHeaderSlotProvider>
  )
}

function AdminLayoutInner() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { slot } = useAdminHeaderSlot()

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login')
  }

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Panel de Administración'
  const initials = (user?.email ?? 'AD').slice(0, 2).toUpperCase()

  return (
    <div className="admin-scope min-h-screen flex overflow-x-hidden" style={{ background: 'var(--bg-app)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-64 flex flex-col fixed inset-y-0 left-0 z-40 shadow-card-lg transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ background: 'var(--sidebar-bg, #081630)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10 shrink-0">
          <img
            src="/images/logo.png"
            alt={COMPANY.shortName}
            className="h-8 w-auto object-contain drop-shadow-[0_2px_8px_rgba(247,201,72,0.5)]"
          />
          <span className="font-display font-bold text-gold-400 text-xs tracking-wider uppercase leading-tight truncate">
            {COMPANY.shortName}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `bp-nav-item${isActive ? ' active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <span className={`bp-nav-icon${isActive ? ' text-[var(--accent)]' : ''}`}>
                    <Icon size={17} />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-white/10 p-4 shrink-0">
          <div className="flex items-center gap-3 mb-2 px-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {initials}
            </div>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {user?.email}
            </p>
          </div>
          <button onClick={handleSignOut} className="bp-nav-item" style={{ paddingLeft: 8 }}>
            <span className="bp-nav-icon"><LogOut size={16} /></span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 min-w-0 lg:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header
          className="h-16 flex items-center justify-between gap-4 px-6 lg:px-8 sticky top-0 z-30 border-b shrink-0"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1
              className="font-display font-bold text-lg tracking-wide"
              style={{ color: 'var(--text-title)' }}
            >
              {pageTitle}
            </h1>
          </div>
          {slot && <div className="flex items-center gap-4 shrink-0">{slot}</div>}
        </header>

        {/* Content */}
        <main className="flex-1">
          <div key={location.pathname} className="bp-page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
