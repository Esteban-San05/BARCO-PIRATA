import { Link, NavLink } from 'react-router-dom'
import { Anchor, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { COMPANY } from '@constants/index'

const navLinks = [
  { to: '/',        label: 'Inicio' },
  { to: '/reservar', label: 'Reservar' },
]

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-navy-900 text-white shadow-card-lg sticky top-0 z-50">
      <div className="container-app">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 font-display font-bold text-xl text-gold-400 hover:text-gold-300 transition-colors"
          >
            <Anchor className="w-6 h-6" />
            <span className="hidden sm:block">{COMPANY.shortName}</span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gold-400 text-navy-900'
                      : 'text-navy-100 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* CTA + hamburger */}
          <div className="flex items-center gap-3">
            <Link to="/reservar" className="hidden sm:inline-flex btn-accent text-sm py-2 px-4">
              Reservar Ahora
            </Link>
            <button
              className="md:hidden p-2 rounded-lg text-navy-100 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menú"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Nav móvil */}
        {menuOpen && (
          <nav className="md:hidden py-3 border-t border-white/10 space-y-1 animate-fade-in">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gold-400 text-navy-900'
                      : 'text-navy-100 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <Link
              to="/reservar"
              onClick={() => setMenuOpen(false)}
              className="block btn-accent text-sm text-center mt-2"
            >
              Reservar Ahora
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
