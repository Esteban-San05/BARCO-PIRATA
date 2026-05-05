import { MapPin, Phone, Mail, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { COMPANY } from '@constants/index'

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
                src="/images/logo.png"
                alt={COMPANY.shortName}
                className="h-12 w-auto object-contain drop-shadow-[0_2px_8px_rgba(247,201,72,0.35)]"
              />
              <span className="font-display font-bold text-gold-400 text-base tracking-wider uppercase">{COMPANY.shortName}</span>
            </div>
            <p className="text-sm leading-relaxed">
              {t('footer.tagline')}
            </p>
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
                {COMPANY.phone}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gold-400 shrink-0" />
                {COMPANY.email}
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
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-navy-300">
          © {new Date().getFullYear()} {COMPANY.name}. {t('footer.rights')}
        </div>
      </div>
    </footer>
  )
}
