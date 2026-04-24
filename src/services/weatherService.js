const LAT = 31.3026
const LON = -113.5489
const TZ  = 'America/Hermosillo'

// ── Condiciones actuales ────────────────────────────────────────────────────

async function fetchClimaGeneral() {
  const params = new URLSearchParams({
    latitude:  LAT,
    longitude: LON,
    timezone:  TZ,
    current:   [
      'temperature_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation',
      'weather_code',
      'relative_humidity_2m',
      'uv_index',
    ].join(','),
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error(`Clima general: HTTP ${res.status}`)
  return res.json()
}

async function fetchDatosMarina() {
  const params = new URLSearchParams({
    latitude:  LAT,
    longitude: LON,
    timezone:  TZ,
    current:   [
      'wave_height',
      'wave_direction',
      'wave_period',
      'wind_wave_height',
      'swell_wave_height',
      'ocean_current_velocity',
      'ocean_current_direction',
    ].join(','),
  })
  const res = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`)
  if (!res.ok) throw new Error(`Marina: HTTP ${res.status}`)
  return res.json()
}

export async function fetchDatosCompletos() {
  const [general, marina] = await Promise.all([fetchClimaGeneral(), fetchDatosMarina()])
  const gc = general.current ?? {}
  const mc = marina.current  ?? {}

  return {
    ubicacion:    { latitud: LAT, longitud: LON, zona: TZ },
    actualizadoEn: gc.time ?? mc.time ?? new Date().toISOString(),
    clima: {
      temperatura:       gc.temperature_2m         ?? null,
      humedad:           gc.relative_humidity_2m   ?? null,
      velocidadViento:   gc.wind_speed_10m         ?? null,
      direccionViento:   gc.wind_direction_10m     ?? null,
      precipitacion:     gc.precipitation          ?? null,
      codigoClima:       gc.weather_code           ?? null,
      uvIndex:           gc.uv_index               ?? null,
    },
    marina: {
      alturaOlas:          mc.wave_height             ?? null,
      direccionOlas:       mc.wave_direction          ?? null,
      periodoOlas:         mc.wave_period             ?? null,
      alturaOlasViento:    mc.wind_wave_height        ?? null,
      alturaSwell:         mc.swell_wave_height       ?? null,
      velocidadCorriente:  mc.ocean_current_velocity  ?? null,
      direccionCorriente:  mc.ocean_current_direction ?? null,
    },
  }
}

// ── Pronóstico por día (hasta 14 días) ─────────────────────────────────────

async function fetchDiarioGeneral() {
  const params = new URLSearchParams({
    latitude:     LAT,
    longitude:    LON,
    timezone:     TZ,
    forecast_days: '14',
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'wind_speed_10m_max',
      'wind_direction_10m_dominant',
      'precipitation_sum',
      'weather_code',
    ].join(','),
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error(`Pronóstico general: HTTP ${res.status}`)
  return res.json()
}

async function fetchDiarioMarina() {
  const params = new URLSearchParams({
    latitude:     LAT,
    longitude:    LON,
    timezone:     TZ,
    forecast_days: '14',
    daily: [
      'wave_height_max',
      'wave_direction_dominant',
      'wave_period_max',
      'wind_wave_height_max',
      'swell_wave_height_max',
    ].join(','),
  })
  const res = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`)
  if (!res.ok) throw new Error(`Pronóstico marina: HTTP ${res.status}`)
  return res.json()
}

/** Retorna el pronóstico de los próximos 14 días como array. */
export async function fetchPronostico14Dias() {
  const [general, marina] = await Promise.all([fetchDiarioGeneral(), fetchDiarioMarina()])
  const fechas = general.daily?.time ?? []
  const gd = general.daily ?? {}
  const md = marina.daily  ?? {}

  return fechas.map((fecha, idx) => ({
    fecha,
    clima: {
      temperaturaMax:  gd.temperature_2m_max?.[idx]  ?? null,
      velocidadViento: gd.wind_speed_10m_max?.[idx]  ?? null,
      precipitacion:   gd.precipitation_sum?.[idx]   ?? null,
      codigoClima:     gd.weather_code?.[idx]         ?? null,
    },
    marina: {
      alturaOlas: md.wave_height_max?.[idx] ?? null,
    },
  }))
}

/** Retorna el pronóstico para una fecha específica (formato 'yyyy-MM-dd'). */
export async function fetchPronosticoDia(fecha) {
  const [general, marina] = await Promise.all([fetchDiarioGeneral(), fetchDiarioMarina()])

  const idx = (general.daily?.time ?? []).indexOf(fecha)
  if (idx === -1) throw new Error(`Sin pronóstico disponible para ${fecha}`)

  const gd = general.daily
  const md = marina.daily ?? {}

  return {
    fecha,
    clima: {
      temperaturaMax:   gd.temperature_2m_max?.[idx]           ?? null,
      temperaturaMin:   gd.temperature_2m_min?.[idx]           ?? null,
      velocidadViento:  gd.wind_speed_10m_max?.[idx]           ?? null,
      direccionViento:  gd.wind_direction_10m_dominant?.[idx]  ?? null,
      precipitacion:    gd.precipitation_sum?.[idx]            ?? null,
      codigoClima:      gd.weather_code?.[idx]                 ?? null,
    },
    marina: {
      alturaOlas:       md.wave_height_max?.[idx]       ?? null,
      direccionOlas:    md.wave_direction_dominant?.[idx] ?? null,
      periodoOlas:      md.wave_period_max?.[idx]       ?? null,
      alturaOlasViento: md.wind_wave_height_max?.[idx]  ?? null,
      alturaSwell:      md.swell_wave_height_max?.[idx] ?? null,
    },
  }
}
