-- Migracion: permite que un tecnico tenga varias categorias/habilidades.
-- Ejecuta esto UNA VEZ en la consola Query de Railway si tu base de
-- datos ya existia antes de este cambio.

CREATE TABLE IF NOT EXISTS perfil_categorias (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
    UNIQUE (usuario_id, categoria_id)
);

-- Traslada la categoria unica que cada tecnico ya tenia guardada
-- hacia la nueva tabla, para que nadie pierda su categoria actual.
INSERT INTO perfil_categorias (usuario_id, categoria_id)
SELECT usuario_id, categoria_id FROM perfiles_tecnicos WHERE categoria_id IS NOT NULL
ON CONFLICT (usuario_id, categoria_id) DO NOTHING;
