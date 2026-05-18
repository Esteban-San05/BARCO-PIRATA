import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

interface ImageCarouselProps {
  images?: { src: string; alt: string }[]
  /** milisegundos entre slides automáticos (0 = sin auto-avance) */
  interval?: number
  /** alto fijo para modo hero (CSS value) */
  height?: string
  /** muestra flechas de navegación */
  showArrows?: boolean
  /** muestra dots indicadores */
  showDots?: boolean
  /** overlay oscuro sobre las imágenes (0-100) */
  overlayOpacity?: number
  className?: string
  /** contenido que se renderiza encima de las imágenes */
  children?: React.ReactNode
}

// 📁 Agrega tus fotos en public/images/carrusel/ con los nombres de abajo.
// Para añadir más, duplica una línea y cambia el nombre del archivo.
const IMAGES = [
  { src: '/images/carrusel/carrusel-1.webp', alt: 'Paseo en Barco Pirata 1' },
  { src: '/images/carrusel/carrusel-2.webp', alt: 'Paseo en Barco Pirata 2' },
  { src: '/images/carrusel/carrusel-3.webp', alt: 'Paseo en Barco Pirata 3' },
  { src: '/images/carrusel/carrusel-4.webp', alt: 'Paseo en Barco Pirata 4' },
  { src: '/images/carrusel/carrusel-5.webp', alt: 'Paseo en Barco Pirata 5' },
  { src: '/images/carrusel/carrusel-6.webp', alt: 'Paseo en Barco Pirata 6' },
  { src: '/images/carrusel/carrusel-7.webp', alt: 'Paseo en Barco Pirata 7' },
  { src: '/images/carrusel/carrusel-8.webp', alt: 'Paseo en Barco Pirata 8' },
]

export function ImageCarousel({
  images = IMAGES,
  interval = 4500,
  height = '520px',
  showArrows = true,
  showDots = true,
  overlayOpacity = 55,
  className,
  children,
}: ImageCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goTo = useCallback(
    (index: number) => {
      if (animating) return
      setAnimating(true)
      setCurrent((index + images.length) % images.length)
      setTimeout(() => setAnimating(false), 600)
    },
    [animating, images.length]
  )

  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev = useCallback(() => goTo(current - 1), [current, goTo])

  // Auto-avance
  useEffect(() => {
    if (!interval) return
    timerRef.current = setTimeout(next, interval)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current, interval, next])

  // Teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev])

  return (
    <div
      className={clsx('relative overflow-hidden w-full select-none', className)}
      style={{ height }}
      role="region"
      aria-label="Galería de fotos del Barco Pirata"
    >
      {/* Slides */}
      {images.map((img, i) => (
        <div
          key={img.src}
          aria-hidden={i !== current}
          className={clsx(
            'absolute inset-0 transition-opacity duration-700 ease-in-out',
            i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
          )}
        >
          <img
            src={img.src}
            alt={img.alt}
            className="w-full h-full object-cover object-center"
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        </div>
      ))}

      {/* Overlay */}
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{ background: `rgba(13,32,64,${overlayOpacity / 100})` }}
      />

      {/* Contenido sobre las imágenes */}
      {children && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center">
          {children}
        </div>
      )}

      {/* Flechas */}
      {showArrows && images.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Foto anterior"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 bg-navy-900/60 hover:bg-navy-900/90 border border-gold-400/30 hover:border-gold-400 text-white rounded-full p-2 transition-all backdrop-blur-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            aria-label="Siguiente foto"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 bg-navy-900/60 hover:bg-navy-900/90 border border-gold-400/30 hover:border-gold-400 text-white rounded-full p-2 transition-all backdrop-blur-sm"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots indicadores */}
      {showDots && images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ir a foto ${i + 1}`}
              className={clsx(
                'rounded-full transition-all duration-300',
                i === current
                  ? 'w-6 h-2.5 bg-gold-400'
                  : 'w-2.5 h-2.5 bg-white/50 hover:bg-white/80'
              )}
            />
          ))}
        </div>
      )}

      {/* Progreso de auto-avance (barra sutil abajo) */}
      {interval > 0 && (
        <div className="absolute bottom-0 left-0 z-40 h-0.5 bg-gold-400/60 w-full">
          <div
            key={current}
            className="h-full bg-gold-400 origin-left"
            style={{
              animation: `carousel-progress ${interval}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  )
}

/** Versión standalone para la sección Galería (sin overlay ni children) */
export function GalleryCarousel() {
  return (
    <ImageCarousel
      interval={3500}
      height="420px"
      overlayOpacity={10}
      showArrows
      showDots
    />
  )
}
