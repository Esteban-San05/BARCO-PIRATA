import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import '../../styles/hero.css'

const HERO_PHOTOS = [
  { src: '/images/carrete-1.jpeg', alt: 'Barco Pirata Perla Negra' },
  { src: '/images/carrete-2.jpeg', alt: 'Paseo en el Mar de Cortés' },
  { src: '/images/carrete-3.jpeg', alt: 'Aventura familiar en el mar' },
  { src: '/images/carrete-4.jpeg', alt: 'Atardecer en Puerto Peñasco' },
  { src: '/images/carrete-5.jpeg', alt: 'La tripulación pirata' },
  { src: '/images/carrete-6.jpeg', alt: 'Experiencia única en el mar' },
]

const SLIDE_DURATION = 5000

export function HeroSection() {
  const { t, i18n } = useTranslation()
  const [, forceUpdate] = useState(0)
  const [currentSlide, setCurrentSlide] = useState(-1)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const reserveTodayHref = `/reservar?date=${todayIso}`

  const goTo = useCallback((index: number) => {
    setCurrentSlide((index + HERO_PHOTOS.length) % HERO_PHOTOS.length)
  }, [])

  const goNext = useCallback(() => goTo(currentSlide < 0 ? 0 : currentSlide + 1), [currentSlide, goTo])
  const goPrev = useCallback(() => goTo(currentSlide < 0 ? HERO_PHOTOS.length - 1 : currentSlide - 1), [currentSlide, goTo])

  // Auto-avance
  useEffect(() => {
    if (paused) return
    timerRef.current = setTimeout(goNext, SLIDE_DURATION)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [currentSlide, paused, goNext])

  // Teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev])

  const toggleLanguage = () => {
    const next = i18n.language === 'es' ? 'en' : 'es'
    i18n.changeLanguage(next)
    forceUpdate(n => n + 1)
  }

  return (
    <section
      className="hero"
      aria-label="Bienvenida Barco Pirata Perla Negra"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >

      {/* ── Background layers ── */}
      <div className="hero-sky" />

      {/* ── Photo carousel ── */}
      <div className="hero-photo-layer" aria-hidden="true">
        {HERO_PHOTOS.map((photo, i) => (
          <div
            key={photo.src}
            className={`hero-photo-slide${i === currentSlide ? ' active' : ''}`}
            style={{ backgroundImage: `url(${photo.src})` }}
            role="img"
            aria-label={photo.alt}
          />
        ))}
      </div>

      <div className="hero-stars" />
      <div className="hero-moon" aria-hidden="true" />

      <div className="hero-cloud-layer" aria-hidden="true">
        <div className="hero-cloud c1" />
        <div className="hero-cloud c2" />
        <div className="hero-cloud c3" />
      </div>

      {/* Distant coast silhouette */}
      <svg className="hero-coast" viewBox="0 0 1600 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,55 L40,40 L90,48 L160,30 L220,42 L300,28 L360,36 L440,22 L520,32 L600,18 L680,30 L760,20 L860,34 L940,24 L1040,38 L1140,28 L1240,40 L1340,30 L1440,42 L1540,36 L1600,40 L1600,60 L0,60 Z" fill="#0a1d33"/>
        <path d="M0,55 L60,50 L140,53 L240,46 L340,52 L460,44 L560,52 L680,46 L800,54 L920,48 L1040,53 L1180,46 L1300,54 L1440,50 L1600,53 L1600,60 L0,60 Z" fill="#06121f"/>
      </svg>

      {/* ── Gulls ── */}
      <div className="hero-gull g1" aria-hidden="true">
        <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 6 Q 5 1, 11 5 Q 17 1, 21 6"/>
        </svg>
      </div>
      <div className="hero-gull g2" aria-hidden="true">
        <svg width="18" height="8" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 6 Q 5 1, 11 5 Q 17 1, 21 6"/>
        </svg>
      </div>
      <div className="hero-gull g3" aria-hidden="true">
        <svg width="14" height="6" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 6 Q 5 1, 11 5 Q 17 1, 21 6"/>
        </svg>
      </div>

      {/* ── Sea ── */}
      <div className="hero-sea" aria-hidden="true">
        <svg className="hero-wave hero-wave-1" viewBox="0 0 2400 80" preserveAspectRatio="none">
          <path d="M0,40 C200,10 400,70 600,40 C800,10 1000,70 1200,40 C1400,10 1600,70 1800,40 C2000,10 2200,70 2400,40 L2400,80 L0,80 Z" fill="#1a3a5e"/>
        </svg>
        <svg className="hero-wave hero-wave-2" viewBox="0 0 2400 100" preserveAspectRatio="none">
          <path d="M0,50 C200,20 400,80 600,50 C800,20 1000,80 1200,50 C1400,20 1600,80 1800,50 C2000,20 2200,80 2400,50 L2400,100 L0,100 Z" fill="#0f2a47"/>
        </svg>
        <svg className="hero-wave hero-wave-3" viewBox="0 0 2400 120" preserveAspectRatio="none">
          <path d="M0,60 C200,30 400,90 600,60 C800,30 1000,90 1200,60 C1400,30 1600,90 1800,60 C2000,30 2200,90 2400,60 L2400,120 L0,120 Z" fill="#0a1d33"/>
        </svg>
        <svg className="hero-wave hero-wave-4" viewBox="0 0 2400 140" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hero-front-wave" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#06121f"/>
              <stop offset="100%" stopColor="#020609"/>
            </linearGradient>
          </defs>
          <path d="M0,70 C150,40 300,100 480,70 C640,40 800,100 980,70 C1140,40 1300,100 1480,70 C1640,40 1800,100 1980,70 C2140,40 2300,100 2400,70 L2400,140 L0,140 Z" fill="url(#hero-front-wave)"/>
        </svg>
        <svg className="hero-wave hero-wave-foam" viewBox="0 0 2400 8" preserveAspectRatio="none" style={{ height: '3px' }}>
          <path d="M0,4 C200,0 400,8 600,4 C800,0 1000,8 1200,4 C1400,0 1600,8 1800,4 C2000,0 2200,8 2400,4" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1"/>
        </svg>
      </div>

      <div className="hero-wake" aria-hidden="true" />

      {/* ── Ship ── */}
      <div className="hero-ship-wrap" aria-hidden="true">
        <svg viewBox="0 0 540 360" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="hero-hull-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3a2614"/>
              <stop offset="60%" stopColor="#1f140a"/>
              <stop offset="100%" stopColor="#0a0604"/>
            </linearGradient>
            <linearGradient id="hero-sail-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f3ead0"/>
              <stop offset="100%" stopColor="#a89868"/>
            </linearGradient>
            <linearGradient id="hero-sail-shade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,0,0,0)"/>
              <stop offset="100%" stopColor="rgba(0,0,0,.45)"/>
            </linearGradient>
          </defs>
          <line x1="160" y1="280" x2="160" y2="40"  stroke="#1a0e06" strokeWidth="5"/>
          <line x1="280" y1="290" x2="280" y2="20"  stroke="#1a0e06" strokeWidth="6"/>
          <line x1="400" y1="280" x2="400" y2="50"  stroke="#1a0e06" strokeWidth="5"/>
          <line x1="120" y1="80"  x2="200" y2="80"  stroke="#1a0e06" strokeWidth="3"/>
          <line x1="220" y1="60"  x2="340" y2="60"  stroke="#1a0e06" strokeWidth="3"/>
          <line x1="360" y1="90"  x2="440" y2="90"  stroke="#1a0e06" strokeWidth="3"/>
          <path d="M125 82 Q 160 130, 125 200 Q 160 192, 200 200 Q 165 130, 200 82 Q 162 90, 125 82 Z" fill="url(#hero-sail-grad)" stroke="#5a4a2a" strokeWidth="1"/>
          <path d="M125 82 Q 160 130, 125 200 Q 160 192, 200 200 Q 165 130, 200 82 Q 162 90, 125 82 Z" fill="url(#hero-sail-shade)" opacity=".6"/>
          <path d="M222 62 Q 280 140, 222 250 Q 280 240, 340 250 Q 282 140, 340 62 Q 282 72, 222 62 Z" fill="url(#hero-sail-grad)" stroke="#5a4a2a" strokeWidth="1"/>
          <path d="M222 62 Q 280 140, 222 250 Q 280 240, 340 250 Q 282 140, 340 62 Q 282 72, 222 62 Z" fill="url(#hero-sail-shade)" opacity=".55"/>
          <g transform="translate(280,150)" opacity=".75">
            <circle r="22" fill="#1a0e06"/>
            <ellipse cx="-7" cy="-3" rx="4" ry="5" fill="#f3ead0"/>
            <ellipse cx="7"  cy="-3" rx="4" ry="5" fill="#f3ead0"/>
            <path d="M-3 7 L0 11 L3 7" stroke="#f3ead0" strokeWidth="1.5" fill="none"/>
            <path d="M-15 18 L15 18 M-15 22 L15 22" stroke="#1a0e06" strokeWidth="3"/>
            <path d="M-22 22 L-12 12 M22 22 L12 12 M-12 22 L-22 12 M12 22 L22 12" stroke="#1a0e06" strokeWidth="2.5" strokeLinecap="round"/>
          </g>
          <path d="M362 92 Q 400 150, 362 220 Q 400 212, 440 220 Q 402 150, 440 92 Q 402 100, 362 92 Z" fill="url(#hero-sail-grad)" stroke="#5a4a2a" strokeWidth="1"/>
          <path d="M362 92 Q 400 150, 362 220 Q 400 212, 440 220 Q 402 150, 440 92 Q 402 100, 362 92 Z" fill="url(#hero-sail-shade)" opacity=".6"/>
          <rect x="270" y="20" width="20" height="14" fill="#1a0e06" rx="2"/>
          <line x1="280" y1="20" x2="280" y2="0" stroke="#1a0e06" strokeWidth="2"/>
          <path d="M280 0 L320 4 L316 18 L280 14 Z" fill="#0a0604" stroke="#1a0e06" strokeWidth="0.5"/>
          <g transform="translate(298,9)" fill="#f3ead0">
            <circle r="3.5"/>
            <rect x="-3" y="3" width="6" height="2"/>
            <path d="M-5 8 L0 4 M5 8 L0 4 M-5 4 L5 8 M5 4 L-5 8" stroke="#f3ead0" strokeWidth="1" fill="none"/>
          </g>
          <path d="M70 270 L470 270 L430 320 L110 320 Z" fill="url(#hero-hull-grad)" stroke="#0a0604" strokeWidth="1"/>
          <line x1="80"  y1="285" x2="460" y2="285" stroke="#5a3818" strokeWidth="2"/>
          <line x1="84"  y1="298" x2="456" y2="298" stroke="#3a2614" strokeWidth="1.5"/>
          <rect x="140" y="290" width="10" height="8" rx="1" fill="#0a0604"/>
          <rect x="200" y="290" width="10" height="8" rx="1" fill="#0a0604"/>
          <rect x="260" y="290" width="10" height="8" rx="1" fill="#0a0604"/>
          <rect x="320" y="290" width="10" height="8" rx="1" fill="#0a0604"/>
          <rect x="380" y="290" width="10" height="8" rx="1" fill="#0a0604"/>
          <circle cx="145" cy="294" r="1.5" fill="#f4c542" opacity=".4"/>
          <circle cx="205" cy="294" r="1.5" fill="#f4c542" opacity=".4"/>
          <circle cx="265" cy="294" r="1.5" fill="#f4c542" opacity=".4"/>
          <circle cx="325" cy="294" r="1.5" fill="#f4c542" opacity=".4"/>
          <circle cx="385" cy="294" r="1.5" fill="#f4c542" opacity=".4"/>
          <line x1="470" y1="270" x2="510" y2="258" stroke="#1a0e06" strokeWidth="4"/>
          <circle cx="78" cy="260" r="4" fill="#f4c542" opacity=".9"/>
          <circle cx="78" cy="260" r="9" fill="#f4c542" opacity=".25"/>
        </svg>
      </div>

      <div className="hero-vignette" aria-hidden="true" />

      {/* ── Navigation (desktop) ── */}
      <header className="hero-nav">
        <Link to="/" className="hero-brand">
          <div className="hero-brand-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f4c542" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="5"/>
              <circle cx="10" cy="9.5" r="1" fill="#f4c542"/>
              <circle cx="14" cy="9.5" r="1" fill="#f4c542"/>
              <path d="M9 18 L7 22 M15 18 L17 22 M9 18 L15 18"/>
            </svg>
          </div>
          <span>BARCO PIRATA</span>
        </Link>

        <nav className="hero-menu" aria-label="Navegación principal">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            {t('header.home')}
          </NavLink>
          <NavLink to="/reservar" className={({ isActive }) => isActive ? 'active' : ''}>
            {t('header.reserve')}
          </NavLink>
          <NavLink to="/clima" className={({ isActive }) => isActive ? 'active' : ''}>
            {t('header.weather')}
          </NavLink>
          <a href="#galeria">Galería</a>
          <a href="#contacto">Contacto</a>
        </nav>

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
        </div>
      </header>

      {/* ── Hero copy ── */}
      <div className="hero-content">
        <div className="hero-crest">
          <div className="hero-smoke" aria-hidden="true">
            <span/><span/><span/><span/>
          </div>
          <img
            src="/images/logo.png"
            alt="Perla Negra - Barco Pirata"
            className="hero-crest-img"
            draggable={false}
          />
        </div>

        <span className="hero-ribbon">Puerto Peñasco · Sonora · México</span>

        <h1 className="hero-title">
          ¡Zarpa con Nosotros!
          <span className="alt">La <span className="accent">Perla Negra</span> te espera</span>
        </h1>

        <p className="hero-lede">{t('home.hero.subtitle')}</p>

        <div className="hero-cta-row">
          <Link to={reserveTodayHref} className="hero-cta-gold">
            {t('home.hero.ctaReserve')}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </Link>
          <a href="#video" className="hero-cta-ghost">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            {t('home.hero.ctaWatch')} (0:42)
          </a>
        </div>
      </div>

      {/* ── Carousel controls ── */}
      <button
        className="hero-side-arrow left"
        aria-label="Foto anterior"
        onClick={goPrev}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <button
        className="hero-side-arrow right"
        aria-label="Siguiente foto"
        onClick={goNext}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>

      <div className="hero-slide-dots" role="tablist" aria-label="Navegación de fotos">
        {HERO_PHOTOS.map((photo, i) => (
          <button
            key={photo.src}
            role="tab"
            aria-selected={i === currentSlide}
            aria-label={`Ver foto ${i + 1}: ${photo.alt}`}
            className={`hero-slide-dot${i === currentSlide ? ' active' : ''}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      {/* Progress bar */}
      {!paused && (
        <div className="hero-photo-progress" aria-hidden="true">
          <div
            key={currentSlide}
            className="hero-photo-progress-bar"
            style={{ '--hero-duration': `${SLIDE_DURATION}ms` } as React.CSSProperties}
          />
        </div>
      )}

      {/* Scroll hint */}
      <div className="hero-scroll-hint" aria-hidden="true">
        <span>Explora</span>
        <div className="hero-scroll-dot"/>
      </div>

      {/* Trust bar */}
      <div className="hero-trust">
        <div className="hero-trust-inner">
          <div className="hero-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>
            </svg>
            {t('home.features.experience')}
          </div>
          <div className="hero-trust-divider"/>
          <div className="hero-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s-8-4-8-12V5l8-3 8 3v5c0 8-8 12-8 12z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            {t('home.features.safety')}
          </div>
          <div className="hero-trust-divider"/>
          <div className="hero-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="7" r="4"/>
              <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3a4 4 0 0 1 0 8M21 21v-2a4 4 0 0 0-3-3.87"/>
            </svg>
            {t('home.features.groups')}
          </div>
          <div className="hero-trust-divider"/>
          <div className="hero-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {t('home.features.securePayment')}
          </div>
        </div>
      </div>

    </section>
  )
}
