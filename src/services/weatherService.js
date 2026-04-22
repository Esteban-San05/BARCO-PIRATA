const LAT = 31.3026
const LON = -113.5489
const TZ  = 'America/Hermosillo'

async function fetchClimaGeneral() {
  const params = new URLSearchParams({
    latitude:              LAT,
    longitude:             LON,
    timezone:              TZ,
    current:               [
      'temperature_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation',
      'weather_code',
      'relative_humidity_2m',
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

  const gc = general.current   ?? {}
  const mc = marina.current    ?? {}

  return {
    ubicacion: {
      latitud:  LAT,
      longitud: LON,
      zona:     TZ,
    },
    actualizadoEn: gc.time ?? mc.time ?? new Date().toISOString(),
    clima: {
      temperatura:         gc.temperature_2m         ?? null,
      humedad:             gc.relative_humidity_2m   ?? null,
      velocidadViento:     gc.wind_speed_10m         ?? null,
      direccionViento:     gc.wind_direction_10m     ?? null,
      precipitacion:       gc.precipitation          ?? null,
      codigoClima:         gc.weather_code           ?? null,
    },
    marina: {
      alturaOlas:           mc.wave_height            ?? null,
      direccionOlas:        mc.wave_direction         ?? null,
      periodoOlas:          mc.wave_period            ?? null,
      alturaOlasViento:     mc.wind_wave_height       ?? null,
      alturaSwell:          mc.swell_wave_height      ?? null,
      velocidadCorriente:   mc.ocean_current_velocity ?? null,
      direccionCorriente:   mc.ocean_current_direction ?? null,
    },
  }
}
