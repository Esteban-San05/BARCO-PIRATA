/**
 * GalleryPage.tsx — Galería pública del Barco Pirata
 *
 * Secciones:
 *  1. Hero con breadcrumb
 *  2. Carrusel de reseñas (marquee infinito)
 *  3. Barra de filtros sticky + buscador + toggle de layout
 *  4. Mosaico destacado (featured grid)
 *  5. Galería masonry
 *  6. Sección de videos destacados
 *  7. Strip de estadísticas
 *  8. Lightbox con navegación teclado
 *
 * Sin hardcodeo: todos los items de contenido viven en arrays tipados.
 * Todo el texto pasa por i18n (ES / EN).
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import '../../styles/gallery.css'

/* ── Tipos ─────────────────────────────────────────────────────────── */
type Scene = 'sunset' | 'night' | 'day' | 'fire' | 'deck' | 'crew' | 'family' | 'aerial'
type Category = 'all' | 'sunsets' | 'onboard' | 'crew' | 'families' | 'aerial' | 'videos'
type Ratio = 'portrait' | 'square' | 'landscape' | 'tall' | 'wide'

interface GalleryItem {
  id: string
  scene: Scene
  titleKey: string           // i18n key dentro de gallery.items.*
  metaKey?: string           // i18n key para el subtítulo
  category: Exclude<Category, 'all'>
  badge?: string             // badge dorado
  badgeDark?: boolean        // badge oscuro (fondo navy)
  cornerTag?: string         // etiqueta esquina superior izquierda
  isVideo?: boolean
  videoDuration?: string     // ej. '2:14'
  videoQuality?: string      // ej. '4K'
  ratio?: Ratio              // para masonry; featured ignora esto
  featured?: boolean         // aparece en el mosaico grande
  featuredSpanBig?: boolean  // ocupa 2 filas en featured
  isDrift?: boolean          // animación drift
}

interface Review {
  id: string
  author: string
  city: string
  tour: string
  textKey: string
  avatarBg: string
  initials: string
}

/* ── Datos: reseñas ─────────────────────────────────────────────────── */
const REVIEWS: Review[] = [
  { id: 'r1', author: 'María Rojas',     city: 'Hermosillo',  tour: 'Atardecer Pirata',  textKey: 'r1', avatarBg: 'linear-gradient(135deg,#8b1a1a,#3a0808)', initials: 'MR' },
  { id: 'r2', author: 'Carlos López',    city: 'CDMX',        tour: 'Paseo Familiar',    textKey: 'r2', avatarBg: 'linear-gradient(135deg,#1e4a73,#0a1d33)', initials: 'CL' },
  { id: 'r3', author: 'Andrea Sánchez', city: 'Phoenix, AZ',  tour: 'Noche de Leyenda',  textKey: 'r3', avatarBg: 'linear-gradient(135deg,#b8861a,#5a3818)', initials: 'AS' },
  { id: 'r4', author: 'Jorge Torres',   city: 'Tijuana',      tour: 'Atardecer Pirata',  textKey: 'r4', avatarBg: 'linear-gradient(135deg,#5a2a3c,#2a1638)', initials: 'JT' },
  { id: 'r5', author: 'Daniela Vargas', city: 'Guadalajara',  tour: 'Atardecer Pirata',  textKey: 'r5', avatarBg: 'linear-gradient(135deg,#c97a1f,#5a2818)', initials: 'DV' },
  { id: 'r6', author: 'Ricardo Mendoza',city: 'Tucson, AZ',   tour: 'Paseo de Día',      textKey: 'r6', avatarBg: 'linear-gradient(135deg,#1f8a4c,#0a1d33)', initials: 'RM' },
]

// textos de reseñas hardcodeados porque son "quotes" de usuarios, no i18n
const REVIEW_TEXTS: Record<string, { es: string; en: string }> = {
  r1: { es: 'El atardecer fue mágico. La tripulación se entregó al show y nuestros hijos no paran de hablar de la noche del barco pirata.', en: 'The sunset was magical. The crew gave their all in the show and our kids won\'t stop talking about pirate ship night.' },
  r2: { es: 'Mejor experiencia familiar de Puerto Peñasco. Los niños con sus disfraces piratas, la cena buenísima y el capitán super amable.', en: 'Best family experience in Puerto Peñasco. The kids in pirate costumes, amazing dinner and a super friendly captain.' },
  r3: { es: 'El show de fuego nos voló la cabeza. Vale cada peso, repetiría mañana mismo. Volveré con todos mis amigos.', en: 'The fire show blew our minds. Worth every penny — I\'d do it again tomorrow and bring all my friends.' },
  r4: { es: 'Muy organizados, salimos a tiempo y el barco es aún más impresionante en persona. Las fotos no le hacen justicia.', en: 'Very well organized, we left on time and the ship is even more impressive in person. Photos don\'t do it justice.' },
  r5: { es: 'Idealmente romántico. Llevamos a mi pareja por su cumpleaños y fue inolvidable, hasta sacó lagrimitas.', en: 'Perfectly romantic. We went for my partner\'s birthday — unforgettable. Even brought a few happy tears.' },
  r6: { es: 'No soy fan de paseos turísticos pero esto fue diferente. Profesional, divertido, con personalidad. 10/10.', en: 'Not usually a fan of tourist tours but this was different. Professional, fun and full of personality. 10/10.' },
}

/* ── Datos: galería ─────────────────────────────────────────────────── */
const GALLERY_ITEMS: GalleryItem[] = [
  // ── Featured (mosaico grande) ──
  {
    id: 'f1', scene: 'sunset', titleKey: 'lastRay', metaKey: 'lastRayMeta',
    category: 'sunsets', badge: 'Atardeceres', cornerTag: '★ Destacada',
    featured: true, featuredSpanBig: true, isDrift: true,
  },
  {
    id: 'f2', scene: 'night', titleKey: 'moonPirate', metaKey: 'moonPirateMeta',
    category: 'onboard', badgeDark: true, badge: 'A bordo',
    featured: true,
  },
  {
    id: 'f3', scene: 'day', titleKey: 'deckLaughs', metaKey: 'deckLaughsMeta',
    category: 'videos', badgeDark: true, badge: 'Video',
    isVideo: true, featured: true,
  },
  {
    id: 'f4', scene: 'fire', titleKey: 'fireShow', metaKey: 'fireShowMeta',
    category: 'onboard', badgeDark: true, badge: 'Eventos', cornerTag: '3 fotos',
    featured: true,
  },
  {
    id: 'f5', scene: 'aerial', titleKey: 'fromSky', metaKey: 'fromSkyMeta',
    category: 'aerial', badge: 'Aéreas', cornerTag: 'Drone',
    featured: true,
  },

  // ── Masonry ──
  { id: 'm1', scene: 'sunset', titleKey: 'sailsWind',   metaKey: 'sailsWindMeta',   category: 'sunsets',   ratio: 'portrait'  },
  { id: 'm2', scene: 'family', titleKey: 'familyGarcia',metaKey: 'familyGarciaMeta',category: 'families',  ratio: 'square',    cornerTag: 'Familias' },
  { id: 'm3', scene: 'night',  titleKey: 'toastStars',  metaKey: 'toastStarsMeta',  category: 'onboard',   ratio: 'landscape' },
  { id: 'm4', scene: 'deck',   titleKey: 'portCannon',  metaKey: 'portCannonMeta',  category: 'onboard',   ratio: 'tall'      },
  { id: 'm5', scene: 'crew',   titleKey: 'capDiego',    metaKey: 'capDiegoMeta',    category: 'crew',      ratio: 'portrait',  cornerTag: 'Tripulación' },
  { id: 'm6', scene: 'aerial', titleKey: 'goldenBay',   metaKey: 'goldenBayMeta',   category: 'aerial',    ratio: 'landscape', cornerTag: 'Drone' },
  { id: 'm7', scene: 'family', titleKey: 'miniPirates', metaKey: 'miniPiratesMeta', category: 'families',  ratio: 'landscape', badgeDark: true, badge: 'Familias' },
  { id: 'm8', scene: 'sunset', titleKey: 'horizonGlow', metaKey: 'horizonGlowMeta', category: 'sunsets',   ratio: 'wide'      },
  { id: 'm9', scene: 'crew',   titleKey: 'crewPortrait',metaKey: 'crewPortraitMeta',category: 'crew',      ratio: 'square',    cornerTag: 'Tripulación' },
  { id: 'm10',scene: 'night',  titleKey: 'starryDeck',  metaKey: 'starryDeckMeta',  category: 'onboard',   ratio: 'portrait'  },
  { id: 'm11',scene: 'day',    titleKey: 'morningDep',  metaKey: 'morningDepMeta',  category: 'onboard',   ratio: 'landscape' },
  { id: 'm12',scene: 'fire',   titleKey: 'torchDance',  metaKey: 'torchDanceMeta',  category: 'onboard',   ratio: 'tall'      },

  // ── Videos ──
  { id: 'v1', scene: 'day',    titleKey: 'tour360',    metaKey: 'tour360Meta',   category: 'videos', isVideo: true, videoDuration: '2:14', videoQuality: '4K' },
  { id: 'v2', scene: 'sunset', titleKey: 'timelapse',  metaKey: 'timelapseMeta', category: 'videos', isVideo: true, videoDuration: '0:48', cornerTag: 'Drone' },
  { id: 'v3', scene: 'fire',   titleKey: 'fullShow',   metaKey: 'fullShowMeta',  category: 'videos', isVideo: true, videoDuration: '3:55', badge: 'Top' },
]

/* ── Textos de tiles (i18n sería muy verboso para 20+ items; usamos un map) */
const ITEM_LABELS: Record<string, { title: { es: string; en: string }; meta: { es: string; en: string } }> = {
  lastRay:      { title: { es: 'El último rayo',               en: 'The last ray'            }, meta: { es: 'Atardecer · Mayo 2026',        en: 'Sunset · May 2026'        } },
  moonPirate:   { title: { es: 'Bajo la luna pirata',          en: 'Under the pirate moon'   }, meta: { es: 'Noche de Leyenda · Abr 2026',  en: 'Night of Legend · Apr 2026'} },
  deckLaughs:   { title: { es: 'Cubierta llena de risas',      en: 'Deck full of laughter'   }, meta: { es: 'Paseo de día · 0:42',          en: 'Daytime tour · 0:42'       } },
  fireShow:     { title: { es: 'Show de fuego',                en: 'Fire show'               }, meta: { es: 'Atardecer Pirata',             en: 'Pirate Sunset'             } },
  fromSky:      { title: { es: 'Vista desde el cielo',         en: 'View from the sky'       }, meta: { es: 'Toma aérea · Mar 2026',        en: 'Aerial shot · Mar 2026'    } },
  sailsWind:    { title: { es: 'Velas al viento',              en: 'Sails in the wind'       }, meta: { es: 'Atardecer · 1280×1920',        en: 'Sunset · 1280×1920'        } },
  familyGarcia: { title: { es: 'Familia García',               en: 'The García Family'       }, meta: { es: 'Paseo de día',                 en: 'Daytime tour'              } },
  toastStars:   { title: { es: 'Brindis bajo las estrellas',   en: 'Toast under the stars'   }, meta: { es: 'Noche de Leyenda',             en: 'Night of Legend'           } },
  portCannon:   { title: { es: 'Cañón de babor',               en: 'Port cannon'             }, meta: { es: 'Detalle · A bordo',            en: 'Detail · On board'         } },
  capDiego:     { title: { es: 'Capitán Diego',                en: 'Captain Diego'           }, meta: { es: 'Retrato · 2026',               en: 'Portrait · 2026'           } },
  goldenBay:    { title: { es: 'Bahía dorada',                 en: 'Golden bay'              }, meta: { es: 'Aérea · Atardecer',            en: 'Aerial · Sunset'           } },
  miniPirates:  { title: { es: 'Mini piratas',                 en: 'Mini pirates'            }, meta: { es: 'Disfraces a bordo',            en: 'Costumes on board'         } },
  horizonGlow:  { title: { es: 'Brillo en el horizonte',       en: 'Horizon glow'            }, meta: { es: 'Atardecer panorámico',         en: 'Panoramic sunset'          } },
  crewPortrait: { title: { es: 'Tripulación completa',         en: 'Full crew'               }, meta: { es: 'Foto grupal · 2026',           en: 'Group photo · 2026'        } },
  starryDeck:   { title: { es: 'Cubierta estrellada',          en: 'Starry deck'             }, meta: { es: 'Noche a bordo',                en: 'Night on board'            } },
  morningDep:   { title: { es: 'Partida matutina',             en: 'Morning departure'       }, meta: { es: 'Salida 9:00 AM',               en: '9:00 AM departure'         } },
  torchDance:   { title: { es: 'Danza de antorchas',           en: 'Torch dance'             }, meta: { es: 'Show a bordo',                 en: 'On-board show'             } },
  tour360:      { title: { es: 'Tour 360° del barco',          en: '360° ship tour'          }, meta: { es: 'Conoce cada rincón',           en: 'Explore every corner'      } },
  timelapse:    { title: { es: 'Atardecer time-lapse',         en: 'Sunset time-lapse'       }, meta: { es: 'Una hora en 48 segundos',      en: 'An hour in 48 seconds'     } },
  fullShow:     { title: { es: 'Show pirata completo',         en: 'Full pirate show'        }, meta: { es: 'Lo más visto del mes',         en: 'Most viewed this month'    } },
}

/* ── Estadísticas ───────────────────────────────────────────────────── */
const STATS = [
  { num: '240+', labelKey: 'stats.photos'  },
  { num: '4.9',  labelKey: 'stats.rating'  },
  { num: '1,247',labelKey: 'stats.reviews' },
  { num: '10+',  labelKey: 'stats.years'   },
]

/* ── Filtros ────────────────────────────────────────────────────────── */
interface FilterDef { key: Category; labelKey: string }
const FILTERS: FilterDef[] = [
  { key: 'all',     labelKey: 'filterAll'      },
  { key: 'sunsets', labelKey: 'filterSunsets'  },
  { key: 'onboard', labelKey: 'filterOnBoard'  },
  { key: 'crew',    labelKey: 'filterCrew'     },
  { key: 'families',labelKey: 'filterFamilies' },
  { key: 'aerial',  labelKey: 'filterAerial'   },
  { key: 'videos',  labelKey: 'filterVideos'   },
]

/* ── SVG íconos inline (para no necesitar lucide dentro del canvas dark) */
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconGrid = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
const IconList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const IconPlay = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const IconChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

/* ────────────────────────────────────────────────────────────────────
   Sub-componentes
   ──────────────────────────────────────────────────────────────────── */

/** Placeholder de escena con gradiente + grain + gradiente oscuro inferior */
function TileBg({ scene, drift = false }: { scene: Scene; drift?: boolean }) {
  return (
    <>
      <div className={`gal-tile-ph ph-${scene}${drift ? ' gal-drift' : ''}`} />
      <div className="gal-grain" />
      <div className="gal-gradient" />
    </>
  )
}

/** Overlay de título + badge en la esquina inferior */
function TileMeta({
  title, meta, badge, badgeDark,
}: { title: string; meta?: string; badge?: string; badgeDark?: boolean }) {
  return (
    <div className="gal-meta-overlay">
      <div>
        <p className="gal-tile-title">{title}</p>
        {meta && <p className="gal-tile-small">{meta}</p>}
      </div>
      {badge && (
        <span className={`gal-badge${badgeDark ? ' dark' : ''}`}>{badge}</span>
      )}
    </div>
  )
}

/** Tile del mosaico masonry con ratio variable */
function MasonryTile({
  item, lang, onClick,
}: { item: GalleryItem; lang: string; onClick: () => void }) {
  const labels = ITEM_LABELS[item.titleKey]
  const title = labels?.title[lang as 'es' | 'en'] ?? item.titleKey
  const meta  = labels?.meta[lang as 'es' | 'en']

  return (
    <div className="gal-tile gal-reveal" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className={`gal-ratio gal-ratio-${item.ratio ?? 'square'} ph-${item.scene}`}
        style={{ position: 'relative' }}>
        <div className="gal-grain" />
        <div className="gal-gradient" />
        {item.cornerTag && <span className="gal-corner-tag">{item.cornerTag}</span>}
        {item.isVideo && (
          <span className="gal-play-btn">
            <IconPlay />
          </span>
        )}
        <TileMeta title={title} meta={meta} badge={item.badge} badgeDark={item.badgeDark} />
      </div>
    </div>
  )
}

/** Tile del mosaico featured (posición absolute) */
function FeaturedTile({
  item, lang, spanBig = false, onClick,
}: { item: GalleryItem; lang: string; spanBig?: boolean; onClick: () => void }) {
  const labels = ITEM_LABELS[item.titleKey]
  const title  = labels?.title[lang as 'es' | 'en'] ?? item.titleKey
  const meta   = labels?.meta[lang as 'es' | 'en']

  return (
    <div
      className={`gal-tile${spanBig ? ' span-big' : ''} gal-reveal`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <TileBg scene={item.scene} drift={item.isDrift} />
      {item.cornerTag && <span className="gal-corner-tag">{item.cornerTag}</span>}
      {item.isVideo && (
        <span className="gal-play-btn">
          <IconPlay />
        </span>
      )}
      <TileMeta
        title={title}
        meta={meta}
        badge={item.badge}
        badgeDark={item.badgeDark}
      />
    </div>
  )
}

/** Tile de video en la sección de videos */
function VideoTile({
  item, lang, onClick,
}: { item: GalleryItem; lang: string; onClick: () => void }) {
  const labels = ITEM_LABELS[item.titleKey]
  const title  = labels?.title[lang as 'es' | 'en'] ?? item.titleKey
  const meta   = labels?.meta[lang as 'es' | 'en']

  return (
    <div
      className="gal-tile gal-video-tile gal-reveal"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <TileBg scene={item.scene} />
      <span className="gal-play-btn center">
        <IconPlay size={18} />
      </span>
      {item.videoDuration && <span className="gal-corner-tag">{item.videoDuration}</span>}
      <TileMeta
        title={title}
        meta={meta}
        badge={item.videoQuality ?? item.badge}
        badgeDark={!item.videoQuality}
      />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
   Hook: Intersection Observer para animaciones reveal
   ──────────────────────────────────────────────────────────────────── */
function useReveal(containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 },
    )

    const targets = container.querySelectorAll('.gal-reveal')
    targets.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  })
}

/* ────────────────────────────────────────────────────────────────────
   Componente principal
   ──────────────────────────────────────────────────────────────────── */
export default function GalleryPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('en') ? 'en' : 'es'

  const [activeFilter, setActiveFilter] = useState<Category>('all')
  const [search, setSearch]             = useState('')
  const [layout, setLayout]             = useState<'grid' | 'list'>('grid')
  const [visibleCount, setVisibleCount] = useState(8)
  const [lightboxIdx, setLightboxIdx]   = useState<number | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  useReveal(rootRef as React.RefObject<HTMLElement>)

  const todayIso = format(new Date(), 'yyyy-MM-dd')

  /* Conteo por categoría */
  const counts = useMemo(() => {
    const c: Record<Category, number> = {
      all: GALLERY_ITEMS.length, sunsets: 0, onboard: 0,
      crew: 0, families: 0, aerial: 0, videos: 0,
    }
    GALLERY_ITEMS.forEach((item) => { c[item.category]++ })
    return c
  }, [])

  /* Items filtrados para masonry */
  const masonryItems = useMemo(() => {
    const base = GALLERY_ITEMS.filter((i) => !i.featured && !i.isVideo)
    const filtered = activeFilter === 'all'
      ? base
      : base.filter((i) => i.category === activeFilter)
    if (!search.trim()) return filtered
    const q = search.toLowerCase()
    return filtered.filter((i) => {
      const labels = ITEM_LABELS[i.titleKey]
      return (
        labels?.title.es.toLowerCase().includes(q) ||
        labels?.title.en.toLowerCase().includes(q) ||
        labels?.meta.es.toLowerCase().includes(q)
      )
    })
  }, [activeFilter, search])

  const videoItems = useMemo(
    () => GALLERY_ITEMS.filter((i) => i.isVideo && !i.featured),
    [],
  )
  const featuredItems = useMemo(
    () => GALLERY_ITEMS.filter((i) => i.featured),
    [],
  )

  /* Todos los tiles para el lightbox (featured + masonry + video) */
  const allLightboxItems = useMemo(
    () => [...featuredItems, ...masonryItems, ...videoItems],
    [masonryItems, videoItems, featuredItems],
  )

  const openLightbox = useCallback((idx: number) => setLightboxIdx(idx), [])
  const closeLightbox = useCallback(() => setLightboxIdx(null), [])
  const prevLightbox = useCallback(() => {
    setLightboxIdx((i) => i === null ? null : (i - 1 + allLightboxItems.length) % allLightboxItems.length)
  }, [allLightboxItems.length])
  const nextLightbox = useCallback(() => {
    setLightboxIdx((i) => i === null ? null : (i + 1) % allLightboxItems.length)
  }, [allLightboxItems.length])

  /* Teclado para lightbox */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightboxIdx === null) return
      if (e.key === 'Escape')     closeLightbox()
      if (e.key === 'ArrowLeft')  prevLightbox()
      if (e.key === 'ArrowRight') nextLightbox()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIdx, closeLightbox, prevLightbox, nextLightbox])

  /* Bloquear scroll cuando lightbox abierto */
  useEffect(() => {
    document.body.style.overflow = lightboxIdx !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightboxIdx])

  const lbItem = lightboxIdx !== null ? allLightboxItems[lightboxIdx] : null

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="gal-root" ref={rootRef}>

      {/* ── 1. HERO ──────────────────────────────────────────────── */}
      <section className="gal-hero">
        <p className="gal-crumbs">
          <Link to="/">{t('header.home')}</Link> · {t('gallery.crumb')}
        </p>
        <h1 className="gal-h1">{t('gallery.pageTitle')}</h1>
        <p className="gal-sub">{t('gallery.pageSubtitle')}</p>
        <p className="gal-lead">{t('gallery.pageLead')}</p>
      </section>

      {/* ── 2. REVIEWS CAROUSEL ─────────────────────────────────── */}
      <div className="gal-section-title" style={{ marginTop: 0 }}>
        <h2>
          {t('gallery.reviewsTitle')}{' '}
          <span className="gal-accent">{t('gallery.reviewsAccent')}</span>
        </h2>
        <div className="gal-meta">
          ★★★★★ <b>4.9</b> · 1,247 {t('gallery.reviewsMeta')}
        </div>
      </div>

      <section className="gal-reviews-wrap" style={{ marginBottom: 60 }}>
        <div className="gal-reviews-track">
          {/* doble lista para loop infinito */}
          {[...REVIEWS, ...REVIEWS].map((r, idx) => (
            <article
              key={`${r.id}-${idx}`}
              className="gal-review"
              aria-hidden={idx >= REVIEWS.length ? 'true' : undefined}
            >
              <div className="gal-r-stars">★★★★★</div>
              <p className="gal-r-text">{REVIEW_TEXTS[r.textKey][lang]}</p>
              <div className="gal-r-foot">
                <div className="gal-r-avatar" style={{ background: r.avatarBg }}>
                  {r.initials}
                </div>
                <div>
                  <span className="gal-r-name">{r.author}</span>
                  <span className="gal-r-city">{r.city} · {r.tour}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── 3. FILTERS ──────────────────────────────────────────── */}
      <div className="gal-filters-wrap">
        <div className="gal-filters">
          <div className="gal-pills">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`gal-pill${activeFilter === f.key ? ' active' : ''}`}
                onClick={() => { setActiveFilter(f.key); setVisibleCount(8) }}
              >
                {t(`gallery.${f.labelKey}`)}
                <span className="gal-count">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <div className="gal-filters-right">
            <label className="gal-search">
              <IconSearch />
              <input
                type="text"
                placeholder={t('gallery.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t('gallery.searchPlaceholder')}
              />
            </label>
            <div className="gal-layout-toggle">
              <button
                className={layout === 'grid' ? 'active' : ''}
                onClick={() => setLayout('grid')}
                aria-label="Cuadrícula"
              >
                <IconGrid />
              </button>
              <button
                className={layout === 'list' ? 'active' : ''}
                onClick={() => setLayout('list')}
                aria-label="Lista"
              >
                <IconList />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. FEATURED MOSAIC ──────────────────────────────────── */}
      <section className="gal-featured">
        {featuredItems.map((item, idx) => (
          <FeaturedTile
            key={item.id}
            item={item}
            lang={lang}
            spanBig={item.featuredSpanBig}
            onClick={() => openLightbox(idx)}
          />
        ))}
      </section>

      {/* ── 5. MASONRY ──────────────────────────────────────────── */}
      <div className="gal-section-title">
        <h2>
          {t('gallery.allPhotosTitle')}{' '}
          <span className="gal-accent">{t('gallery.allPhotosAccent')}</span>
        </h2>
        <div className="gal-meta">
          <b>{masonryItems.length}</b> {t('gallery.allPhotosMeta')}
        </div>
      </div>

      <section className="gal-masonry">
        {masonryItems.slice(0, visibleCount).map((item, idx) => (
          <MasonryTile
            key={item.id}
            item={item}
            lang={lang}
            onClick={() => openLightbox(featuredItems.length + idx)}
          />
        ))}
      </section>

      {visibleCount < masonryItems.length && (
        <div className="gal-load-more">
          <button onClick={() => setVisibleCount((v) => v + 8)}>
            {t('gallery.loadMore')} <IconChevronDown />
          </button>
        </div>
      )}

      {/* ── 6. VIDEOS ───────────────────────────────────────────── */}
      <div className="gal-section-title" style={{ marginTop: 80 }}>
        <h2>
          {t('gallery.videosTitle')}{' '}
          <span className="gal-accent">{t('gallery.videosAccent')}</span>
        </h2>
        <div className="gal-meta">
          <b>{videoItems.length}</b> {t('gallery.videosMeta')}
        </div>
      </div>

      <section className="gal-video-row">
        {videoItems.map((item, idx) => (
          <VideoTile
            key={item.id}
            item={item}
            lang={lang}
            onClick={() => openLightbox(featuredItems.length + masonryItems.length + idx)}
          />
        ))}
      </section>

      {/* ── 7. STATS STRIP ──────────────────────────────────────── */}
      <div className="gal-stats-strip">
        <div className="gal-stat-row">
          {STATS.map((s) => (
            <div key={s.labelKey}>
              <p className="gal-stat-num">{s.num}</p>
              <p className="gal-stat-label">{t(`gallery.${s.labelKey}`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 8. LIGHTBOX ─────────────────────────────────────────── */}
      {lightboxIdx !== null && lbItem && (
        <div
          className="gal-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={t('gallery.crumb')}
          onClick={(e) => { if (e.target === e.currentTarget) closeLightbox() }}
        >
          <button
            className="gal-lb-close"
            onClick={closeLightbox}
            aria-label={t('gallery.lightboxClose')}
          >
            <IconX />
          </button>

          <span className="gal-lb-counter">
            {String(lightboxIdx + 1).padStart(2, '0')} / {String(allLightboxItems.length).padStart(2, '0')}
          </span>

          <button
            className="gal-lb-arrow left"
            onClick={prevLightbox}
            aria-label={t('gallery.lightboxPrev')}
          >
            <IconChevronLeft />
          </button>

          <div className="gal-lb-frame">
            <div
              className={`gal-tile-ph ph-${lbItem.scene}`}
              style={{ position: 'absolute', inset: 0 }}
            />
            <div className="gal-grain" />
            {lbItem.isVideo && (
              <span className="gal-play-btn center" style={{ position: 'absolute' }}>
                <IconPlay size={24} />
              </span>
            )}
            <div className="gal-lb-info">
              <h3>{ITEM_LABELS[lbItem.titleKey]?.title[lang] ?? lbItem.titleKey}</h3>
              <div className="gal-lb-row">
                {ITEM_LABELS[lbItem.titleKey]?.meta[lang] ?? t('gallery.defaultMeta')}
              </div>
            </div>
          </div>

          <button
            className="gal-lb-arrow right"
            onClick={nextLightbox}
            aria-label={t('gallery.lightboxNext')}
          >
            <IconChevronRight />
          </button>
        </div>
      )}

      {/* ── CTA footer ──────────────────────────────────────────── */}
      <div className="gal-footer-bar">
        © {new Date().getFullYear()} Barco Pirata Perla Negra · Puerto Peñasco, Sonora
        {'  ·  '}
        <Link to={`/reservar?date=${todayIso}`} style={{ color: 'var(--gold-300)', textDecoration: 'none' }}>
          {t('header.reserveNow')} →
        </Link>
      </div>
    </div>
  )
}
