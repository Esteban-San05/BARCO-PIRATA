import { useMarinaWeather } from '../hooks/useMarinaWeather'

const UMBRAL_VIENTO = 40
const UMBRAL_OLAS   = 2

// WMO weather codes → descripción en español
const WMO_DESC = {
  0:  'Despejado',
  1:  'Principalmente Despejado',
  2:  'Parcialmente Nublado',
  3:  'Nublado',
  45: 'Neblina',
  48: 'Neblina con Escarcha',
  51: 'Llovizna Ligera',
  53: 'Llovizna Moderada',
  55: 'Llovizna Intensa',
  61: 'Lluvia Ligera',
  63: 'Lluvia Moderada',
  65: 'Lluvia Intensa',
  71: 'Nevada Ligera',
  73: 'Nevada Moderada',
  75: 'Nevada Intensa',
  77: 'Granizo',
  80: 'Chubascos Ligeros',
  81: 'Chubascos Moderados',
  82: 'Chubascos Fuertes',
  85: 'Aguanieve Ligera',
  86: 'Aguanieve Intensa',
  95: 'Tormenta',
  96: 'Tormenta con Granizo',
  99: 'Tormenta Severa',
}

// WMO code → emoji
const WMO_ICON = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️', 77: '🌨️',
  80: '🌦️', 81: '🌦️', 82: '⛈️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function Metrica({ icono, valor, unidad = '', etiqueta, alerta = false }) {
  return (
    <div style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '12px 8px', borderRight: '1px solid var(--border)' }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icono}</div>
      <div style={{
        fontSize: 18, fontWeight: 700,
        color: alerta ? '#DC2626' : 'var(--text-title)',
        lineHeight: 1,
      }}>
        {valor !== null && valor !== undefined ? `${valor}${unidad}` : '—'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{etiqueta}</div>
    </div>
  )
}

export function ClimaMarino({ fecha }) {
  const { datos, cargando, error } = useMarinaWeather(fecha)

  if (cargando) return (
    <div
      className="rounded-xl p-6 animate-pulse"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="h-5 w-32 rounded mb-2" style={{ background: 'var(--bg-surface-alt)' }} />
      <div className="h-3 w-48 rounded" style={{ background: 'var(--bg-surface-alt)' }} />
    </div>
  )

  if (error) return (
    <div
      className="rounded-xl p-5 border-l-4 border-pirate-500"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <p className="font-semibold text-sm text-pirate-600">⚠️ Error al cargar el clima marino</p>
      <p className="text-xs text-pirate-500 mt-1">{error}</p>
    </div>
  )

  const { clima, marina } = datos

  const vientoMal  = clima.velocidadViento !== null && clima.velocidadViento > UMBRAL_VIENTO
  const olasMal    = marina.alturaOlas     !== null && marina.alturaOlas     > UMBRAL_OLAS
  const favorable  = !vientoMal && !olasMal

  const esHoy      = !fecha || fecha === todayIso()
  const condicion  = WMO_DESC[clima.codigoClima] ?? 'Condiciones Variables'
  const iconoClima = WMO_ICON[clima.codigoClima] ?? '🌊'

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background:  'var(--bg-surface)',
        border:      '1px solid var(--border)',
        borderLeft:  `3px solid ${favorable ? '#22C55E' : '#DC2626'}`,
        boxShadow:   'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-title)', letterSpacing: '0.02em' }}>
            {iconoClima} {condicion}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Puerto Peñasco · {esHoy ? 'Hoy' : fecha}
          </p>
        </div>

        <span style={{
          fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 9999,
          background: favorable ? '#DCFCE7' : '#FEF2F2',
          color:      favorable ? '#166534'  : '#991B1B',
        }}>
          {favorable ? '✓ Favorable para zarpar' : '✗ No favorable para zarpar'}
        </span>
      </div>

      {/* Métricas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
        <Metrica icono="🌡️" valor={clima.temperatura}       unidad="°C"    etiqueta="Temperatura" />
        <Metrica icono="💨" valor={clima.velocidadViento}   unidad=" km/h" etiqueta="Viento"       alerta={vientoMal} />
        <Metrica icono="🌊" valor={marina.alturaOlas}       unidad=" m"    etiqueta="Olas"         alerta={olasMal} />
        <Metrica icono="💧" valor={clima.humedad}           unidad="%"     etiqueta="Humedad" />
        <div style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>☀️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-title)', lineHeight: 1 }}>
            {clima.uvIndex !== null && clima.uvIndex !== undefined ? clima.uvIndex : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Índice UV</div>
        </div>
      </div>
    </div>
  )
}
