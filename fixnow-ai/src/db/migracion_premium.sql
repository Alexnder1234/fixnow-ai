-- Migracion: agrega el plan Premium (simulado) para tecnicos.
-- Ejecuta esto UNA VEZ en la consola Query de Railway si tu base de
-- datos ya existia antes de este cambio.

ALTER TABLE perfiles_tecnicos ADD COLUMN IF NOT EXISTS es_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE perfiles_tecnicos ADD COLUMN IF NOT EXISTS premium_hasta TIMESTAMP;
