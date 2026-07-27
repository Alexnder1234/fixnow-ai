-- Migracion: agrega soporte de pago (simulado) a una base de datos
-- que ya fue creada con una version anterior de schema.sql.
-- Ejecuta esto UNA VEZ en la consola Query de Railway si tu base de
-- datos ya existía antes de este cambio. Si vas a crear la base de
-- datos desde cero, no lo necesitas: usa schema.sql directamente,
-- ya incluye estas columnas.

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT FALSE;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(30);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS pagado_en TIMESTAMP;
