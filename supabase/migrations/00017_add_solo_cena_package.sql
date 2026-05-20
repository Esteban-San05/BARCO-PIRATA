-- Agrega el paquete "Solo Cena" (solo adultos, sin barra libre) al enum package_id.
-- ALTER TYPE ... ADD VALUE debe ir en su propia migración: un valor de enum nuevo
-- no puede usarse en la misma transacción en que se agrega.

ALTER TYPE package_id ADD VALUE IF NOT EXISTS 'SOLO_CENA';
