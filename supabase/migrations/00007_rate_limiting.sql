-- ─────────────────────────────────────────────────────────────────────────────
--  Migración 00007: Rate limiting por teléfono
--
--  Crea una función SQL que verifica si un número de teléfono ha excedido el
--  límite de reservaciones recientes, para prevenir spam o abusos.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_phone_rate_limit(
  p_phone      TEXT,
  p_max_per_hour INT DEFAULT 3
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*) < p_max_per_hour
  FROM reservations
  WHERE contact_phone = p_phone
    AND created_at > NOW() - INTERVAL '1 hour'
    AND status != 'cancelada';
$$;

GRANT EXECUTE ON FUNCTION check_phone_rate_limit TO anon, authenticated;
