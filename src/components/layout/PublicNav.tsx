import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { format } from 'date-fns'
import '../../styles/hero.css'

export function PublicNav() {
  const { t, i18n } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const reserveTodayHref = `/reservar?date=${todayIso}`

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')
  }

  const closeMenu = () => setMenuOpen(false)

  const navLinks = [
    { to: '/', label: t('header.home'), end: true },
    { to: '/reservar', label: t('header.reserve'), end: false },
    { to: '/clima', label: t('header.weather'), end: false },
    { to: '/galeria', label: t('header.gallery'), end: false },
  ]

  return (
    <header>
      <nav className="public-nav">
        {/* Brand */}
        <Link to="/" className="hero-brand">
          <img
            src="/images/logo.webp"
            alt="Barco Pirata Perla Negra"
            style={{ height: '66px', width: 'auto', objectFit: 'contain' }}
            draggable={false}
          />
        </Link>

        {/* Pills — desktop */}
        <nav className="hero-menu pub-menu-desktop" aria-label="Navegación principal">
          {navLinks.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}>
              {label}
            </NavLink>
          ))}
          <a
            href="#contacto"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            {t('header.contact')}
          </a>
        </nav>

        {/* Right side */}
        <div className="hero-nav-right">
          <button className="hero-lang-btn" onClick={toggleLanguage} aria-label="Cambiar idioma">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>
            </svg>
            {i18n.language === 'es' ? 'ES' : 'EN'}
          </button>
          <Link to={reserveTodayHref} className="hero-reserve-btn pub-reserve-desktop">
            {t('header.reserveNow')}
          </Link>
          {/* Hamburger — solo mobile */}
          <button
            className="pub-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="pub-mobile-menu">
          {navLinks.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeMenu}
              className={({ isActive }) => `pub-mobile-link${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
          <a
            href="#contacto"
            className="pub-mobile-link"
            onClick={(e) => {
              e.preventDefault()
              closeMenu()
              document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            {t('header.contact')}
          </a>
          <Link
            to={reserveTodayHref}
            className="pub-mobile-cta"
            onClick={closeMenu}
          >
            {t('header.reserveNow')}
          </Link>
        </div>
      )}
    </header>
  )
}
