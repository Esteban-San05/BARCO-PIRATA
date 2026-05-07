import { useEffect, useState, useCallback, useRef } from 'react'
import { Star, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { supabase } from '@lib/supabase/client'
import { Button } from '@components/ui/Button'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Review {
  id: string
  author_name: string
  author_photo: string | null
  rating: number
  text: string | null
  relative_time: string | null
}

interface PlaceInfo {
  rating: number | null
  total_reviews: number | null
}

interface ReviewsSectionProps {
  reserveTodayHref: string
}

// ─── Placeholders mientras no hay datos reales ────────────────────────────────

const PLACEHOLDER_REVIEWS: Review[] = [
  { id: '1', author_name: 'Carlos López',   author_photo: null, rating: 5, text: 'Mejor experiencia familiar de Puerto Peñasco. Los niños con sus disfraces piratas, la cena buenísima y el capitán super amable.', relative_time: 'hace 2 semanas' },
  { id: '2', author_name: 'Andrea Sánchez', author_photo: null, rating: 5, text: 'El show de fuego nos voló la cabeza. Vale cada peso, repetiría mañana mismo. Volveré con todos mis amigos.', relative_time: 'hace 1 mes' },
  { id: '3', author_name: 'Roberto Torres', author_photo: null, rating: 5, text: 'Una noche mágica en el mar. La comida, la música y el ambiente superaron todas mis expectativas.', relative_time: 'hace 3 semanas' },
  { id: '4', author_name: 'María Flores',   author_photo: null, rating: 5, text: 'Celebramos el cumpleaños de mi hija aquí y fue perfecto. El equipo hizo todo para que fuera especial.', relative_time: 'hace 2 meses' },
  { id: '5', author_name: 'Juan Mendoza',   author_photo: null, rating: 5, text: 'Increíble atardecer desde el barco. Las fotos quedaron espectaculares. ¡100% recomendado!', relative_time: 'hace 1 semana' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${star <= rating ? 'fill-gold-400 text-gold-400' : 'fill-navy-700 text-navy-700'}`}
        />
      ))}
    </div>
  )
}

function AuthorAvatar({ name, photo }: { name: string; photo: string | null }) {
  const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className="w-10 h-10 rounded-full object-cover border-2 border-gold-400/30"
        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div className="w-10 h-10 rounded-full bg-navy-800 border-2 border-gold-400/30 flex items-center justify-center text-gold-400 text-sm font-semibold">
      {initials}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ReviewsSection({ reserveTodayHref }: ReviewsSectionProps) {
  const [reviews, setReviews]     = useState<Review[]>([])
  const [placeInfo, setPlaceInfo] = useState<PlaceInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [current, setCurrent]     = useState(0)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const INTERVAL = 5000

  useEffect(() => {
    async function fetchData() {
      try {
        const [reviewsRes, placeRes] = await Promise.all([
          supabase
            .from('google_reviews')
            .select('id, author_name, author_photo, rating, text, relative_time')
            .order('rating', { ascending: false })
            .limit(6),
          supabase
            .from('google_place_info')
            .select('rating, total_reviews')
            .order('fetched_at', { ascending: false })
            .limit(1)
            .single(),
        ])
        setReviews(reviewsRes.data && reviewsRes.data.length > 0 ? reviewsRes.data : PLACEHOLDER_REVIEWS)
        if (placeRes.data) setPlaceInfo(placeRes.data)
      } catch {
        setReviews(PLACEHOLDER_REVIEWS)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const goTo = useCallback((index: number) => {
    if (animating || reviews.length === 0) return
    setAnimating(true)
    setCurrent((index + reviews.length) % reviews.length)
    setTimeout(() => setAnimating(false), 500)
  }, [animating, reviews.length])

  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev = useCallback(() => goTo(current - 1), [current, goTo])

  // Auto-avance
  useEffect(() => {
    if (loading || reviews.length === 0) return
    timerRef.current = setTimeout(next, INTERVAL)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current, loading, next, reviews.length])

  const isPlaceholder = reviews[0]?.id === '1'

  // Mostrar 2 tarjetas a la vez en desktop, 1 en móvil
  const visibleReviews = reviews.length > 0
    ? [reviews[current % reviews.length], reviews[(current + 1) % reviews.length]]
    : []

  return (
    <section id="resenas" className="bg-[#040a14] py-16">
      <div className="container-app">

        {/* ── Encabezado ── */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-display font-bold text-white mb-2">
            Lo que dicen{' '}
            <span className="text-gold-400">nuestros pasajeros</span>
          </h2>
          <p className="text-navy-200">Reseñas reales de Google Maps</p>

          {/* Rating general — solo con datos reales */}
          {placeInfo?.rating && !isPlaceholder && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <span className="text-4xl font-bold text-white">
                {Number(placeInfo.rating).toFixed(1)}
              </span>
              <div className="flex flex-col items-start gap-1">
                <StarRating rating={Math.round(Number(placeInfo.rating))} size="lg" />
                {placeInfo.total_reviews && (
                  <span className="text-navy-400 text-sm">
                    {placeInfo.total_reviews.toLocaleString('es-MX')} reseñas
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Carrusel ── */}
        {loading ? (
          // Skeleton
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-gold-400/10 bg-navy-900/40 p-6 animate-pulse">
                <div className="flex gap-1 mb-4">{[1,2,3,4,5].map(s => <div key={s} className="w-4 h-4 rounded bg-navy-700" />)}</div>
                <div className="space-y-2 mb-6">
                  <div className="h-3 bg-navy-700 rounded" />
                  <div className="h-3 bg-navy-700 rounded w-5/6" />
                  <div className="h-3 bg-navy-700 rounded w-4/6" />
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-gold-400/10">
                  <div className="w-10 h-10 rounded-full bg-navy-700" />
                  <div className="flex-1"><div className="h-3 bg-navy-700 rounded w-3/4 mb-2" /><div className="h-3 bg-navy-700 rounded w-1/2" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative max-w-4xl mx-auto">

            {/* Tarjetas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {visibleReviews.map((review, idx) => (
                <article
                  key={`${review.id}-${current}-${idx}`}
                  className={clsx(
                    'rounded-2xl border border-gold-400/10 bg-navy-900/40 backdrop-blur-sm p-6 flex flex-col gap-4',
                    'transition-opacity duration-500',
                    animating ? 'opacity-0' : 'opacity-100',
                    // En móvil solo mostrar la primera
                    idx === 1 && 'hidden md:flex'
                  )}
                  style={{ boxShadow: '0 0 40px rgba(244,197,66,0.04)' }}
                >
                  {/* Comilla decorativa */}
                  <span className="text-gold-400/40 text-5xl leading-none font-serif select-none" aria-hidden="true">"</span>

                  {/* Estrellas */}
                  <StarRating rating={review.rating} />

                  {/* Texto */}
                  {review.text && (
                    <p className="text-navy-200 text-sm leading-relaxed flex-1 italic">
                      {review.text}
                    </p>
                  )}

                  {/* Autor */}
                  <div className="flex items-center gap-3 pt-2 border-t border-gold-400/10">
                    <AuthorAvatar name={review.author_name} photo={review.author_photo} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{review.author_name}</p>
                      {review.relative_time && (
                        <p className="text-navy-400 text-xs">{review.relative_time}</p>
                      )}
                    </div>
                    {!isPlaceholder && (
                      <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 opacity-50" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {/* Controles del carrusel */}
            <div className="flex items-center justify-center gap-6 mt-8">
              {/* Botón anterior */}
              <button
                onClick={prev}
                aria-label="Reseña anterior"
                className="bg-navy-800/60 hover:bg-navy-700 border border-gold-400/30 hover:border-gold-400 text-white rounded-full p-2.5 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Dots */}
              <div className="flex gap-2">
                {reviews.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    aria-label={`Ir a reseña ${i + 1}`}
                    className={clsx(
                      'rounded-full transition-all duration-300',
                      i === current ? 'w-6 h-2.5 bg-gold-400' : 'w-2.5 h-2.5 bg-navy-600 hover:bg-navy-400'
                    )}
                  />
                ))}
              </div>

              {/* Botón siguiente */}
              <button
                onClick={next}
                aria-label="Siguiente reseña"
                className="bg-navy-800/60 hover:bg-navy-700 border border-gold-400/30 hover:border-gold-400 text-white rounded-full p-2.5 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de progreso */}
            <div className="mt-4 max-w-xs mx-auto h-0.5 bg-navy-800 rounded-full overflow-hidden">
              <div
                key={current}
                className="h-full bg-gold-400 origin-left"
                style={{ animation: `carousel-progress ${INTERVAL}ms linear forwards` }}
              />
            </div>
          </div>
        )}

        {/* ── CTAs ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link to={reserveTodayHref}>
            <Button variant="accent" size="lg">
              ¡Quiero vivir esto! Reservar ahora
            </Button>
          </Link>
          {!isPlaceholder && (
            <a
              href={`https://search.google.com/local/reviews?placeid=${import.meta.env.VITE_GOOGLE_PLACE_ID ?? ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-gold-400 hover:text-gold-300 text-sm border border-gold-400/30 hover:border-gold-400/60 rounded-full px-5 py-2.5 transition-colors duration-200"
            >
              Ver todas en Google
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

      </div>
    </section>
  )
}
