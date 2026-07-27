-- Migracion: agrega la tabla de tecnicos favoritos a una base de datos
-- que ya existia con una version anterior de schema.sql.
-- Ejecuta esto UNA VEZ en la consola Query de Railway si tu base de
-- datos ya existia antes de este cambio.

CREATE TABLE IF NOT EXISTS favoritos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    tecnico_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en TIMESTAMP DEFAULT NOW(),
    UNIQUE (cliente_id, tecnico_id)
);
