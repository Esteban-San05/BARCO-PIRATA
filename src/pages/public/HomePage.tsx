import { Link } from 'react-router-dom'
import { Anchor, Users, Star, Shield } from 'lucide-react'
import { PACKAGES, COMPANY, DISCOUNT_MIN_PEOPLE, DISCOUNT_RATE } from '@constants/index'
import { formatCurrency } from '@utils/formatters'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="wave-bg text-white py-24 px-4 text-center relative overflow-hidden">
        {/* Halo dorado decorativo */}
        <div className="absolute inset-0 bg-treasure-glow pointer-events-none" />
        <div className="max-w-3xl mx-auto animate-fade-in relative">
          <div className="flex justify-center mb-6">
            <Anchor className="w-14 h-14 text-gold-400 animate-wave" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
            <span className="text-gold-shimmer">{COMPANY.shortName}</span>
          </h1>
          <p className="text-lg text-navy-100 mb-8">
            Vive la aventura del mar en Puerto Peñasco. Paseos únicos para toda la familia,
            con los mejores paquetes a los mejores precios.
          </p>
          <Link to="/reservar">
            <Button variant="accent" size="lg">
              Reservar mi paseo
            </Button>
          </Link>
        </div>
      </section>

      {/* Paquetes */}
      <section className="container-app py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-display font-bold text-navy-900 mb-2">Nuestros Paquetes</h2>
          <p className="text-navy-500">Elige el que mejor se adapte a tu grupo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.values(PACKAGES).map((pkg) => (
            <Card key={pkg.id} className="flex flex-col items-center text-center hover:shadow-card-lg transition-shadow border border-navy-100">
              <div className="text-5xl mb-4">{pkg.icon}</div>
              <h3 className="text-lg font-semibold text-navy-900 mb-2">{pkg.label}</h3>
              <p className="text-navy-500 text-sm mb-4 flex-1">{pkg.description}</p>
              <div className="text-3xl font-bold text-gold-600 mb-1">
                {formatCurrency(pkg.pricePerPerson)}
              </div>
              <p className="text-xs text-navy-400 mb-5">por persona</p>
              <Link to="/reservar" className="w-full">
                <Button variant="outline" className="w-full">Reservar</Button>
              </Link>
            </Card>
          ))}
        </div>

        {/* Banner descuento grupal */}
        <div className="mt-8 panel-gold flex items-start gap-4">
          <Users className="w-8 h-8 text-gold-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-navy-900">
              ¡Descuento grupal del {DISCOUNT_RATE * 100}%!
            </p>
            <p className="text-navy-700 text-sm mt-1">
              Grupos de {DISCOUNT_MIN_PEOPLE} personas o más obtienen automáticamente un descuento del {DISCOUNT_RATE * 100}% sobre el costo del paquete.
            </p>
          </div>
        </div>
      </section>

      {/* Características */}
      <section className="bg-navy-900 text-white py-14">
        <div className="container-app grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { icon: Star,   title: 'Experiencia única',  desc: 'Más de 10 años llevando familias al mar' },
            { icon: Shield, title: 'Seguridad primero',  desc: 'Equipos de seguridad certificados a bordo' },
            { icon: Anchor, title: 'Pago seguro',        desc: 'Pago en efectivo o con tarjeta de forma segura' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title}>
              <Icon className="w-8 h-8 text-gold-400 mx-auto mb-3" />
              <h3 className="font-semibold text-lg mb-1">{title}</h3>
              <p className="text-navy-200 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
