import { useState, useEffect } from 'react'
import { fetchDatosCompletos } from '../services/weatherService'

const INTERVALO_MS = 10 * 60 * 1000 // 10 minutos

export function useMarinaWeather() {
  const [datos,    setDatos]    = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const resultado = await fetchDatosCompletos()
        if (activo) setDatos(resultado)
      } catch (err) {
        if (activo) setError(err.message ?? 'Error al obtener datos climáticos')
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargar()

    const intervalo = setInterval(cargar, INTERVALO_MS)
    return () => {
      activo = false
      clearInterval(intervalo)
    }
  }, [])

  return { datos, cargando, error }
}
