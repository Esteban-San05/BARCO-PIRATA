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

  return (
    <header>
      <nav className="public-nav">
        {/* Brand */}
        <Link to="/" className="hero-brand">
          <img
            src="/images/logo.png"
            alt="Barco Pirata Perla Negra"
            style={{ height: '66px', width: 'auto', objectFit: 'contain' }}
            draggable={false}
          />
        </Link>

        {/* Menu pills — desktop */}
        <nav className="hero-menu" aria-label="Navegación principal" style={{ display: 'flex' }}>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            {t('header.home')}
          </NavLink>
          <NavLink to="/reservar" className={({ isActive }) => isActive ? 'active' : ''}>
            {t('header.reserve')}
          </NavLink>
          <NavLink to="/clima" className={({ isActive }) => isActive ? 'active' : ''}>
            {t('header.weather')}
          </NavLink>
          <NavLink to="/galeria" className={({ isActive }) => isActive ? 'active' : ''}>
            {t('header.gallery')}
          </NavLink>
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
          <Link to={reserveTodayHref} className="hero-reserve-btn">
            {t('header.reserveNow')}
          </Link>
          {/* Hamburger mobile */}
          <button
            className="hero-lang-btn md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menú"
            style={{ display: 'none' }}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background: 'rgba(4,9,15,0.98)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '12px 20px',
        }}>
          {[
            { to: '/', label: t('header.home'), end: true },
            { to: '/reservar', label: t('header.reserve'), end: false },
            { to: '/clima', label: t('header.weather'), end: false },
            { to: '/galeria', label: t('header.gallery'), end: false },
          ].map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => isActive ? 'active' : ''}
              style={({ isActive }) => ({
                display: 'block',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? '#06121f' : 'rgba(255,255,255,.78)',
                background: isActive ? '#f4c542' : 'transparent',
                marginBottom: '4px',
              })}
            >
              {label}
            </NavLink>
          ))}
          <a
            href="#contacto"
            onClick={(e) => {
              e.preventDefault()
              setMenuOpen(false)
              document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })
            }}
            style={{
              display: 'block',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              color: 'rgba(255,255,255,.78)',
              marginBottom: '4px',
            }}
          >
            {t('header.contact')}
          </a>
        </div>
      )}
    </header>
  )
}
