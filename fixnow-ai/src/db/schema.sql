-- Esquema completo de FixNow AI
-- Ejecutar este script una vez conectada la base de datos en Railway

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('cliente', 'tecnico')),
    telefono VARCHAR(30),
    ubicacion VARCHAR(255),
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    tarifa_base NUMERIC(10,2) NOT NULL DEFAULT 1000,
    icono VARCHAR(10) DEFAULT '🔧'
);

INSERT INTO categorias (nombre, tarifa_base, icono) VALUES
    ('Electricidad', 1200, '⚡'),
    ('Camaras de seguridad', 1800, '📷'),
    ('Refrigeracion', 1500, '❄️'),
    ('Plomeria', 1000, '🔧'),
    ('Mantenimiento general', 800, '🛠️')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS perfiles_tecnicos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE UNIQUE,
    categoria_id INTEGER REFERENCES categorias(id),
    descripcion TEXT,
    anos_experiencia INTEGER DEFAULT 0,
    calificacion_promedio NUMERIC(2,1) DEFAULT 0,
    total_valoraciones INTEGER DEFAULT 0,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitudes (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES usuarios(id),
    tecnico_id INTEGER REFERENCES usuarios(id),
    categoria_id INTEGER REFERENCES categorias(id),
    descripcion TEXT,
    ubicacion VARCHAR(255),
    foto_url VARCHAR(500),
    urgencia VARCHAR(20) DEFAULT 'normal' CHECK (urgencia IN ('baja', 'normal', 'urgente')),
    estado VARCHAR(30) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'en_proceso', 'completada', 'cancelada')),
    costo_estimado NUMERIC(10,2),
    fecha_programada TIMESTAMP,
    pagado BOOLEAN DEFAULT FALSE,
    metodo_pago VARCHAR(30),
    pagado_en TIMESTAMP,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS valoraciones (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER REFERENCES solicitudes(id) ON DELETE CASCADE,
    cliente_id INTEGER REFERENCES usuarios(id),
    tecnico_id INTEGER REFERENCES usuarios(id),
    puntuacion INTEGER NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
    comentario TEXT,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensajes (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER REFERENCES solicitudes(id) ON DELETE CASCADE,
    remitente_id INTEGER REFERENCES usuarios(id),
    contenido TEXT NOT NULL,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT,
    leida BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- Suscripciones de notificaciones push del navegador/celular.
-- Cada dispositivo/navegador donde el usuario acepta recibir avisos
-- guarda aqui su "endpoint" unico (lo entrega el navegador, no nosotros).
CREATE TABLE IF NOT EXISTS push_suscripciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- Tecnicos favoritos de un cliente
CREATE TABLE IF NOT EXISTS favoritos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    tecnico_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en TIMESTAMP DEFAULT NOW(),
    UNIQUE (cliente_id, tecnico_id)
);

-- Un tecnico puede tener varias categorias/habilidades (no solo una).
-- perfiles_tecnicos.categoria_id se deja como estaba por compatibilidad,
-- pero la lista real de categorias de un tecnico vive aqui.
CREATE TABLE IF NOT EXISTS perfil_categorias (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
    UNIQUE (usuario_id, categoria_id)
);
