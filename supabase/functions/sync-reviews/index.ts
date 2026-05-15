// Edge Function: sync-reviews
// Deploy: supabase functions deploy sync-reviews --no-verify-jwt
//
// Llama a Google Places API, obtiene las reseñas y el rating general del
// negocio, y los guarda en Supabase (reemplazando los datos anteriores).
//
// Variables de entorno requeridas en Supabase Dashboard → Settings → Edge Functions:
//   GOOGLE_API_KEY   → Tu API Key de Google Cloud (Places API habilitada)
//   GOOGLE_PLACE_ID  → El Place ID de tu negocio en Google Maps

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS restringido (idéntico al resto de Edge Functions) ────────────────
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? ''
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(origin) })

  try {
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
    const GOOGLE_PLACE_ID = Deno.env.get('GOOGLE_PLACE_ID')

    if (!GOOGLE_API_KEY || !GOOGLE_PLACE_ID) {
      return json({ error: 'Faltan variables de entorno: GOOGLE_API_KEY o GOOGLE_PLACE_ID' }, 500, origin)
    }

    // ── 1. Llamar a Google Places API ────────────────────────────────────────
    const fields = 'reviews,rating,user_ratings_total'
    const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${GOOGLE_PLACE_ID}&fields=${fields}&language=es&key=${GOOGLE_API_KEY}`

    const googleRes = await fetch(googleUrl)
    const googleData = await googleRes.json()

    if (googleData.status !== 'OK') {
      console.error('[sync-reviews] Google API error:', googleData.status, googleData.error_message)
      return json({ error: `Google API error: ${googleData.status}` }, 502, origin)
    }

    const { reviews = [], rating, user_ratings_total } = googleData.result

    // ── 2. Conectar a Supabase con service_role (permisos totales) ───────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 3. Limpiar datos anteriores e insertar los nuevos ────────────────────
    await supabase.from('google_reviews').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('google_place_info').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Insertar reseñas
    if (reviews.length > 0) {
      const reviewsToInsert = reviews.map((r: {
        author_name: string
        profile_photo_url?: string
        rating: number
        text?: string
        time?: number
        relative_time_description?: string
      }) => ({
        author_name:   r.author_name,
        author_photo:  r.profile_photo_url ?? null,
        rating:        r.rating,
        text:          r.text ?? null,
        time:          r.time ?? null,
        relative_time: r.relative_time_description ?? null,
      }))

      const { error: reviewsError } = await supabase
        .from('google_reviews')
        .insert(reviewsToInsert)

      if (reviewsError) {
        console.error('[sync-reviews] Error insertando reseñas:', reviewsError)
        return json({ error: 'Error guardando reseñas' }, 500, origin)
      }
    }

    // Insertar info general del lugar
    const { error: placeError } = await supabase
      .from('google_place_info')
      .insert({ rating: rating ?? null, total_reviews: user_ratings_total ?? null })

    if (placeError) {
      console.error('[sync-reviews] Error insertando place info:', placeError)
      return json({ error: 'Error guardando place info' }, 500, origin)
    }

    console.log(`[sync-reviews] ✅ ${reviews.length} reseñas guardadas. Rating: ${rating} (${user_ratings_total} total)`)

    return json({
      success: true,
      reviewsSaved: reviews.length,
      rating,
      totalReviews: user_ratings_total,
    }, 200, origin)

  } catch (err) {
    console.error('[sync-reviews] Error inesperado:', err)
    return json({ error: 'Error interno del servidor' }, 500, origin)
  }
})

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), 'Content-Type': 'application/json' },
  })
}
