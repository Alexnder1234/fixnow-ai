-- Migracion: agrega soporte de notificaciones push a una base de datos
-- que ya existia con una version anterior de schema.sql.
-- Ejecuta esto UNA VEZ en la consola Query de Railway si tu base de
-- datos ya existia antes de este cambio.

CREATE TABLE IF NOT EXISTS push_suscripciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    creado_en TIMESTAMP DEFAULT NOW()
);
