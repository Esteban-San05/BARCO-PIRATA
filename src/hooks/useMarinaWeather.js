import { useState, useEffect } from 'react'
import { fetchDatosCompletos, fetchPronosticoDia } from '../services/weatherService'

const INTERVALO_MS = 10 * 60 * 1000 // 10 minutos

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Acepta `fecha` opcional ('yyyy-MM-dd'). Si es hoy o no se pasa, usa datos actuales.
 *  Si es otro día dentro del rango de pronóstico (±14 días), usa fetchPronosticoDia. */
export function useMarinaWeather(fecha) {
  const [datos,    setDatos]    = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState(null)

  const esHoy = !fecha || fecha === todayIso()

  useEffect(() => {
    let activo = true

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        let resultado
        if (esHoy) {
          resultado = await fetchDatosCompletos()
        } else {
          const pronostico = await fetchPronosticoDia(fecha)
          // fetchPronosticoDia devuelve formato distinto — lo normalizamos
          resultado = {
            ubicacion:     { latitud: 31.3026, longitud: -113.5489, zona: 'America/Hermosillo' },
            actualizadoEn: pronostico.fecha + 'T00:00:00',
            clima: {
              temperatura:     pronostico.clima.temperaturaMax ?? null,
              humedad:         null,
              velocidadViento: pronostico.clima.velocidadViento ?? null,
              direccionViento: pronostico.clima.direccionViento ?? null,
              precipitacion:   pronostico.clima.precipitacion   ?? null,
              codigoClima:     pronostico.clima.codigoClima      ?? null,
              uvIndex:         null,
            },
            marina: {
              alturaOlas:         pronostico.marina.alturaOlas         ?? null,
              direccionOlas:      pronostico.marina.direccionOlas      ?? null,
              periodoOlas:        pronostico.marina.periodoOlas        ?? null,
              alturaOlasViento:   pronostico.marina.alturaOlasViento   ?? null,
              alturaSwell:        pronostico.marina.alturaSwell        ?? null,
              velocidadCorriente: null,
              direccionCorriente: null,
            },
          }
        }
        if (activo) setDatos(resultado)
      } catch (err) {
        if (activo) setError(err.message ?? 'Error al obtener datos climáticos')
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargar()

    // Solo refresca automáticamente cuando es hoy
    const intervalo = esHoy ? setInterval(cargar, INTERVALO_MS) : null
    return () => {
      activo = false
      if (intervalo) clearInterval(intervalo)
    }
  }, [fecha, esHoy])

  return { datos, cargando, error }
}
