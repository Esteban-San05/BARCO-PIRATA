import { MapPin, Phone, Mail, Clock, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { COMPANY } from '@constants/index'

// Icono de Facebook SVG inline (lucide no lo incluye)
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

export function PublicFooter() {
  const { t } = useTranslation()

  return (
    <footer id="contacto" className="bg-navy-900 text-navy-200 mt-auto">
      <div className="container-app py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Marca */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img
                src="/images/logo.webp"
                alt={COMPANY.shortName}
                className="h-[72px] w-auto object-contain drop-shadow-[0_2px_8px_rgba(247,201,72,0.35)]"
              />
              <span className="font-display font-bold text-gold-400 text-base tracking-wider uppercase">{COMPANY.shortName}</span>
            </div>
            <p className="text-sm leading-relaxed">
              {t('footer.tagline')}
            </p>

            {/* Redes sociales */}
            <div className="flex items-center gap-3 mt-4">
              <a
                href={COMPANY.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-navy-300 hover:text-gold-400 transition-colors"
                aria-label="Facebook"
              >
                <FacebookIcon className="w-4 h-4 text-gold-400 shrink-0" />
                Facebook
              </a>
              <span className="text-navy-600">·</span>
              <a
                href={COMPANY.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-navy-300 hover:text-gold-400 transition-colors"
                aria-label="WhatsApp"
              >
                <MessageCircle className="w-4 h-4 text-gold-400 shrink-0" />
                WhatsApp
              </a>
            </div>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="text-white font-semibold mb-3">{t('footer.contact')}</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gold-400 mt-0.5 shrink-0" />
                {COMPANY.location}
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gold-400 shrink-0" />
                <a href={`tel:${COMPANY.phone}`} className="hover:text-gold-400 transition-colors">
                  {COMPANY.phone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gold-400 shrink-0" />
                <a href={`mailto:${COMPANY.email}`} className="hover:text-gold-400 transition-colors">
                  {COMPANY.email}
                </a>
              </li>
            </ul>
          </div>

          {/* Horario */}
          <div>
            <h3 className="text-white font-semibold mb-3">{t('footer.schedule')}</h3>
            <div className="flex items-start gap-2 text-sm">
              <Clock className="w-4 h-4 text-gold-400 mt-0.5 shrink-0" />
              {COMPANY.schedule}
            </div>
            <div className="flex items-center gap-2 text-sm mt-3 text-navy-300">
              <Phone className="w-4 h-4 text-gold-400 shrink-0" />
              <span>
                {t('footer.callPrefix')}{' '}
                <a href={`tel:${COMPANY.phone}`} className="text-gold-400 font-semibold hover:text-gold-300 transition-colors">
                  {COMPANY.phone}
                </a>
                {' '}{t('footer.callSuffix')}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-navy-300">
          © {new Date().getFullYear()} {COMPANY.name}. {t('footer.rights')}
        </div>
      </div>
    </footer>
  )
}
