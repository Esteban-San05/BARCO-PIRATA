-- Agrega desglose por paquete a reservations.
-- Estructura del array JSON:
--   [{ "packageId": "CON_COMIDA", "adults": 2, "adultPrice": 700,
--      "youth": 1, "youthPrice": 500, "total": 1900 }, ...]
-- Solo se incluyen paquetes con al menos un pasajero.
-- package_id sigue almacenando el paquete dominante para compatibilidad.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS package_breakdown jsonb;
