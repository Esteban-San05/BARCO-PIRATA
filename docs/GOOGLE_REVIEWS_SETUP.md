# Guía de configuración — Reseñas de Google Maps

## Paso 1 — Obtener API Key de Google Cloud

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo (o usa uno existente)
3. En el menú lateral: **APIs y servicios → Biblioteca**
4. Busca **"Places API"** y habilítala
5. Ve a **APIs y servicios → Credenciales → Crear credencial → Clave de API**
6. Copia la clave generada (empieza con `AIza...`)
7. **Recomendado:** Restringe la clave a solo "Places API" en la misma pantalla

---

## Paso 2 — Obtener el Place ID del negocio

1. Ve a: https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder
2. En el buscador escribe: **"Barco Pirata Puerto Peñasco"**
3. Copia el Place ID que aparece debajo del nombre (formato: `ChIJxxxxxxxxxxxxxxx`)

---

## Paso 3 — Configurar Supabase

### 3a. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto (elige región US West para menor latencia desde Sonora)
3. Guarda la contraseña de la base de datos en un lugar seguro

### 3b. Obtener las credenciales

En el dashboard de Supabase ve a **Settings → API**:
- `Project URL` → es tu `VITE_SUPABASE_URL`
- `anon public` key → es tu `VITE_SUPABASE_ANON_KEY`
- `service_role` key → necesaria para la Edge Function (NUNCA la expongas en el frontend)

### 3c. Configurar variables de entorno del frontend

Crea o edita el archivo `.env.local` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
VITE_GOOGLE_PLACE_ID=ChIJxxxxxxxxxxxxxxx
```

### 3d. Ejecutar las migraciones

Con Supabase CLI instalado:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

O en el dashboard: **SQL Editor** → copia y ejecuta el contenido de los archivos:
- `supabase/migrations/00006_google_reviews.sql`
- (El cron lo configuras después, en el Paso 5)

---

## Paso 4 — Configurar variables de entorno en la Edge Function

En el dashboard de Supabase ve a **Settings → Edge Functions → Add new secret**:

| Variable | Valor |
|---|---|
| `GOOGLE_API_KEY` | Tu API Key de Google Cloud |
| `GOOGLE_PLACE_ID` | El Place ID del negocio |

Las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase automáticamente.

---

## Paso 5 — Hacer deploy de la Edge Function

```bash
supabase functions deploy sync-reviews --no-verify-jwt
```

### Probar manualmente

Una vez desplegada, puedes disparar la sincronización desde el dashboard de Supabase:

**Edge Functions → sync-reviews → Invoke** (o con curl):

```bash
curl -X POST https://TU_PROJECT_REF.supabase.co/functions/v1/sync-reviews \
  -H "Authorization: Bearer TU_ANON_KEY"
```

Si todo está bien, la respuesta debe ser:
```json
{ "success": true, "reviewsSaved": 5, "rating": 4.8, "totalReviews": 127 }
```

---

## Paso 6 — Configurar el cron job (sincronización automática diaria)

1. En el dashboard de Supabase: **Database → Extensions** → habilita `pg_cron` y `pg_net`
2. Edita el archivo `supabase/migrations/00007_reviews_cron.sql` y reemplaza `TU_PROJECT_REF` con tu Project Reference
3. Ejecuta ese SQL en el **SQL Editor** del dashboard

---

## Verificación final

Después de configurar todo:

1. Ejecuta la Edge Function manualmente (Paso 5)
2. Ve a **Table Editor → google_reviews** en el dashboard — debes ver 5 filas
3. Ve a **Table Editor → google_place_info** — debe ver el rating general
4. Corre la app localmente: `npm run dev`
5. La sección de reseñas debe aparecer en la página principal entre la galería y el banner final

---

## Solución de problemas comunes

**"GOOGLE_API_KEY o GOOGLE_PLACE_ID no encontrados"**
→ Asegúrate de haber agregado los secrets en Settings → Edge Functions del dashboard

**"Google API error: REQUEST_DENIED"**
→ La Places API no está habilitada en tu proyecto de Google Cloud, o la API Key está restringida incorrectamente

**"Google API error: NOT_FOUND"**
→ El Place ID es incorrecto. Vuelve a buscarlo en el Place ID Finder

**La sección no aparece en el sitio**
→ Revisa la consola del navegador. Si hay error de Supabase, verifica que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén en el `.env.local`
