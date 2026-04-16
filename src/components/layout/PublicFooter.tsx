import { Anchor, MapPin, Phone, Mail, Clock } from 'lucide-react'
import { COMPANY } from '@constants/index'

export function PublicFooter() {
  return (
    <footer className="bg-navy-900 text-navy-200 mt-auto">
      <div className="container-app py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Marca */}
          <div>
            <div className="flex items-center gap-2 text-gold-400 font-display font-bold text-lg mb-3">
              <Anchor className="w-5 h-5" />
              {COMPANY.shortName}
            </div>
            <p className="text-sm leading-relaxed">
              Vive la experiencia del mar en Puerto Peñasco.
              Paseos en barco únicos para toda la familia.
            </p>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="text-white font-semibold mb-3">Contacto</h3>
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
            <h3 className="text-white font-semibold mb-3">Horario</h3>
            <div className="flex items-start gap-2 text-sm">
              <Clock className="w-4 h-4 text-gold-400 mt-0.5 shrink-0" />
              {COMPANY.schedule}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-navy-300">
          © {new Date().getFullYear()} {COMPANY.name}. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  )
}
