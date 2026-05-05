import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { PACKAGES, DISCOUNT_MIN_PEOPLE, DISCOUNT_RATE } from '@constants/index'
import { formatCurrency } from '@utils/formatters'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { ImageCarousel } from '@components/ui/ImageCarousel'
import { HeroSection } from '@components/ui/HeroSection'
import { Users } from 'lucide-react'

export default function HomePage() {
  const { t } = useTranslation()

  // Todos los CTAs llevan a la reservación con la fecha de hoy preseleccionada.
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const reserveTodayHref = `/reservar?date=${todayIso}`

  return (
    <div>
      {/* ══════════════════════════════════════════════════
          HERO — Escena animada nocturna del barco pirata
         ══════════════════════════════════════════════════ */}
      <HeroSection />

      {/* ══════════════════════════════════════════════════
          PAQUETES
         ══════════════════════════════════════════════════ */}
      <section className="container-app py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-display font-bold text-navy-900 mb-2">{t('home.packages.title')}</h2>
          <p className="text-navy-500">{t('home.packages.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.values(PACKAGES).map((pkg) => (
            <Card
              key={pkg.id}
              className="flex flex-col items-center text-center hover:shadow-card-lg hover:-translate-y-1 transition-all duration-300 border border-navy-100 group"
            >
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
                {pkg.icon}
              </div>
              <h3 className="text-lg font-semibold text-navy-900 mb-2">{t(`packages.${pkg.id}.label`)}</h3>
              <p className="text-navy-500 text-sm mb-4 flex-1">{t(`packages.${pkg.id}.description`)}</p>
              <div className="text-3xl font-bold text-gold-600 mb-1">
                {formatCurrency(pkg.pricePerPerson)}
              </div>
              <p className="text-xs text-navy-400 mb-5">{t('home.packages.perPerson')}</p>
              <Link to={reserveTodayHref} className="w-full">
                <Button variant="outline" className="w-full group-hover:bg-navy-900 group-hover:text-white transition-colors">
                  {t('home.packages.reserve')}
                </Button>
              </Link>
            </Card>
          ))}
        </div>

        {/* Banner descuento grupal */}
        <div className="mt-8 panel-gold flex items-start gap-4">
          <Users className="w-8 h-8 text-gold-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-navy-900">
              {t('home.packages.discountTitle', { rate: DISCOUNT_RATE * 100 })}
            </p>
            <p className="text-navy-700 text-sm mt-1">
              {t('home.packages.discountText', { min: DISCOUNT_MIN_PEOPLE, rate: DISCOUNT_RATE * 100 })}
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          VIDEO — sección de video estratégico
         ══════════════════════════════════════════════════ */}
      <section id="video" className="bg-navy-900 py-16">
        <div className="container-app">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-display font-bold text-white mb-2">
              {t('home.video.title')}{' '}
              <span className="text-gold-400">{t('home.video.highlight')}</span>
            </h2>
            <p className="text-navy-200">
              {t('home.video.subtitle')}
            </p>
          </div>

          {/* Video player */}
          <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-modal border border-gold-400/20">
            <video
              src="/images/video-barco.mp4"
              className="w-full aspect-video object-cover"
              controls
              preload="metadata"
              poster="/images/carrete-1.jpeg"
              playsInline
            >
              {t('home.video.fallback')}
            </video>
          </div>

          <div className="text-center mt-8">
            <Link to={reserveTodayHref}>
              <Button variant="accent" size="lg">
                {t('home.video.cta')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          GALERÍA — misma vibra oscura pirata
         ══════════════════════════════════════════════════ */}
      <section id="galeria" className="bg-[#040a14] py-20">
        <div className="container-app">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-4 mb-5">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold-400/60" />
              <span
                className="text-gold-400/80 text-xs tracking-[0.35em] uppercase"
                style={{ fontFamily: 'Pirata One, serif' }}
              >
                Puerto Peñasco
              </span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold-400/60" />
            </div>
            <h2 className="text-3xl font-display font-bold text-white mb-3">
              {t('home.gallery.title')}
            </h2>
            <p className="text-navy-300">
              {t('home.gallery.subtitle')}
            </p>
          </div>

          <div
            className="rounded-2xl overflow-hidden border border-gold-400/20"
            style={{ boxShadow: '0 0 60px rgba(244,197,66,0.07)' }}
          >
            <ImageCarousel
              interval={3500}
              height="560px"
              overlayOpacity={8}
              showArrows
              showDots
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          BANNER FINAL CTA
         ══════════════════════════════════════════════════ */}
      <section className="bg-navy-900 py-16">
        <div className="container-app text-center">
          <img
            src="/images/logo.png"
            alt="Barco Pirata"
            className="h-20 w-auto object-contain mx-auto mb-6 drop-shadow-[0_4px_16px_rgba(247,201,72,0.4)]"
          />
          <h2 className="text-3xl md:text-4xl font-display-deco font-bold text-white mb-4 tracking-widest uppercase">
            {t('home.finalCta.title')}
          </h2>
          <p className="text-navy-200 mb-8 max-w-xl mx-auto">
            {t('home.finalCta.subtitle')}
          </p>
          <Link to={reserveTodayHref}>
            <Button variant="accent" size="lg">
              {t('home.finalCta.button')}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
