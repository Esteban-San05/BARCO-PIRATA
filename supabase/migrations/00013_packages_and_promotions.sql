-- Extiende business_settings con paquetes personalizados y promociones
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS package_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS promotions        jsonb NOT NULL DEFAULT '[]'::jsonb;
