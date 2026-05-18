import { Link, NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { COMPANY } from '@constants/index'
import { LanguageSwitcher } from '@components/ui/LanguageSwitcher'

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useTranslation()

  // "Reservar Ahora" pre-rellena la fecha de hoy en el formulario.
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const reserveTodayHref = `/reservar?date=${todayIso}`

  const navLinks = [
    { to: '/',         label: t('header.home') },
    { to: '/reservar', label: t('header.reserve') },
    { to: '/clima',    label: t('header.weather') },
    { to: '/galeria',  label: t('header.gallery') },
  ]

  return (
    <header className="bg-navy-900 text-white shadow-card-lg sticky top-0 z-50">
      <div className="container-app">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
            aria-label={COMPANY.shortName}
          >
            <img
              src="/images/logo.webp"
              alt={COMPANY.shortName}
              className="h-14 w-auto object-contain drop-shadow-[0_2px_8px_rgba(247,201,72,0.4)]"
            />
            <span className="hidden lg:block font-display font-bold text-gold-400 text-base tracking-wider uppercase leading-none">
              {COMPANY.shortName}
            </span>
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

          {/* CTA + selector de idioma + hamburger */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="header" />
            <Link to={reserveTodayHref} className="hidden sm:inline-flex btn-accent text-sm py-2 px-4">
              {t('header.reserveNow')}
            </Link>
            <button
              className="md:hidden p-2 rounded-lg text-navy-100 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={t('header.menu')}
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
              to={reserveTodayHref}
              onClick={() => setMenuOpen(false)}
              className="block btn-accent text-sm text-center mt-2"
            >
              {t('header.reserveNow')}
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
