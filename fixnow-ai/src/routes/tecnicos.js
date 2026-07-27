const express = require('express');
const pool = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();

// US-02: Como usuario, quiero buscar tecnicos por categoria.
// Un tecnico puede tener varias categorias/habilidades a la vez.
router.get('/', async (req, res) => {
  const { categoria } = req.query;
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.ubicacion, p.descripcion, p.anos_experiencia,
              p.calificacion_promedio, p.total_valoraciones,
              p.es_premium AND (p.premium_hasta IS NULL OR p.premium_hasta > NOW()) AS es_premium,
              json_agg(json_build_object('nombre', c.nombre, 'icono', c.icono) ORDER BY c.nombre) AS categorias
       FROM perfiles_tecnicos p
       JOIN usuarios u ON u.id = p.usuario_id
       JOIN perfil_categorias pc ON pc.usuario_id = p.usuario_id
       JOIN categorias c ON c.id = pc.categoria_id
       GROUP BY u.id, u.nombre, u.ubicacion, p.descripcion, p.anos_experiencia, p.calificacion_promedio, p.total_valoraciones, p.es_premium, p.premium_hasta
       HAVING ($1::text IS NULL OR bool_or(c.nombre ILIKE $1))
       ORDER BY (p.es_premium AND (p.premium_hasta IS NULL OR p.premium_hasta > NOW())) DESC, p.calificacion_promedio DESC`,
      [categoria || null]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar tecnicos' });
  }
});

// Tecnicos favoritos del cliente autenticado
router.get('/favoritos/mios', requiereAuth, async (req, res) => {
  if (req.usuario.tipo !== 'cliente') {
    return res.status(403).json({ error: 'Solo los clientes tienen favoritos' });
  }
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.ubicacion, p.descripcion, p.anos_experiencia,
              p.calificacion_promedio, p.total_valoraciones,
              p.es_premium AND (p.premium_hasta IS NULL OR p.premium_hasta > NOW()) AS es_premium,
              json_agg(json_build_object('nombre', c.nombre, 'icono', c.icono) ORDER BY c.nombre) AS categorias
       FROM favoritos f
       JOIN perfiles_tecnicos p ON p.usuario_id = f.tecnico_id
       JOIN usuarios u ON u.id = p.usuario_id
       JOIN perfil_categorias pc ON pc.usuario_id = p.usuario_id
       JOIN categorias c ON c.id = pc.categoria_id
       WHERE f.cliente_id = $1
       GROUP BY u.id, u.nombre, u.ubicacion, p.descripcion, p.anos_experiencia, p.calificacion_promedio, p.total_valoraciones, p.es_premium, p.premium_hasta, f.creado_en
       ORDER BY f.creado_en DESC`,
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tus favoritos' });
  }
});

// Solo los ids de los tecnicos favoritos (para marcar corazones en la busqueda)
router.get('/favoritos/ids', requiereAuth, async (req, res) => {
  if (req.usuario.tipo !== 'cliente') return res.json([]);
  try {
    const result = await pool.query('SELECT tecnico_id FROM favoritos WHERE cliente_id = $1', [req.usuario.id]);
    res.json(result.rows.map((r) => r.tecnico_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tus favoritos' });
  }
});

// Alterna (agrega o quita) un tecnico de favoritos
router.post('/:id/favorito', requiereAuth, async (req, res) => {
  if (req.usuario.tipo !== 'cliente') {
    return res.status(403).json({ error: 'Solo los clientes pueden marcar favoritos' });
  }
  const tecnicoId = req.params.id;
  try {
    const existente = await pool.query(
      'SELECT 1 FROM favoritos WHERE cliente_id = $1 AND tecnico_id = $2',
      [req.usuario.id, tecnicoId]
    );
    if (existente.rows.length > 0) {
      await pool.query('DELETE FROM favoritos WHERE cliente_id = $1 AND tecnico_id = $2', [req.usuario.id, tecnicoId]);
      return res.json({ es_favorito: false });
    }
    await pool.query('INSERT INTO favoritos (cliente_id, tecnico_id) VALUES ($1, $2)', [req.usuario.id, tecnicoId]);
    res.json({ es_favorito: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar favoritos' });
  }
});

// US-03: Como usuario, quiero visualizar perfiles y valoraciones para contratar con confianza.
router.get('/:id', async (req, res) => {
  try {
    const perfil = await pool.query(
      `SELECT u.id, u.nombre, u.ubicacion, u.telefono, p.descripcion, p.anos_experiencia,
              p.calificacion_promedio, p.total_valoraciones,
              p.es_premium AND (p.premium_hasta IS NULL OR p.premium_hasta > NOW()) AS es_premium,
              p.premium_hasta
       FROM perfiles_tecnicos p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (perfil.rows.length === 0) {
      return res.status(404).json({ error: 'Tecnico no encontrado' });
    }
    const categorias = await pool.query(
      `SELECT c.id, c.nombre, c.icono
       FROM perfil_categorias pc
       JOIN categorias c ON c.id = pc.categoria_id
       WHERE pc.usuario_id = $1
       ORDER BY c.nombre`,
      [req.params.id]
    );
    const valoraciones = await pool.query(
      `SELECT v.puntuacion, v.comentario, v.creado_en, u.nombre AS cliente
       FROM valoraciones v
       JOIN usuarios u ON u.id = v.cliente_id
       WHERE v.tecnico_id = $1
       ORDER BY v.creado_en DESC
       LIMIT 20`,
      [req.params.id]
    );
    res.json({ ...perfil.rows[0], categorias: categorias.rows, valoraciones: valoraciones.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

// US-06: Como tecnico, quiero crear mi perfil profesional con varias
// categorias/habilidades para ofrecer mis servicios.
router.post('/perfil', requiereAuth, async (req, res) => {
  if (req.usuario.tipo !== 'tecnico') {
    return res.status(403).json({ error: 'Solo los tecnicos pueden crear un perfil profesional' });
  }
  const { descripcion, anos_experiencia } = req.body;
  let { categoria_ids } = req.body;
  categoria_ids = Array.isArray(categoria_ids) ? categoria_ids.map(Number).filter(Boolean) : [];
  if (categoria_ids.length === 0) {
    return res.status(400).json({ error: 'Selecciona al menos una categoría' });
  }
  try {
    await pool.query(
      `INSERT INTO perfiles_tecnicos (usuario_id, categoria_id, descripcion, anos_experiencia)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id) DO UPDATE
         SET categoria_id = EXCLUDED.categoria_id,
             descripcion = EXCLUDED.descripcion,
             anos_experiencia = EXCLUDED.anos_experiencia`,
      [req.usuario.id, categoria_ids[0], descripcion, anos_experiencia || 0]
    );

    // Reemplaza el conjunto de categorias por el nuevo que envio el tecnico
    await pool.query('DELETE FROM perfil_categorias WHERE usuario_id = $1', [req.usuario.id]);
    await Promise.all(
      categoria_ids.map((catId) =>
        pool.query(
          `INSERT INTO perfil_categorias (usuario_id, categoria_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [req.usuario.id, catId]
        )
      )
    );

    const categorias = await pool.query(
      `SELECT c.id, c.nombre, c.icono FROM perfil_categorias pc JOIN categorias c ON c.id = pc.categoria_id WHERE pc.usuario_id = $1 ORDER BY c.nombre`,
      [req.usuario.id]
    );
    res.status(201).json({ categorias: categorias.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el perfil' });
  }
});

// Suscripcion Premium del tecnico (RD$500/mes).
// IMPORTANTE: igual que el pago de servicios, esto es SIMULADO para la
// demo academica — no cobra una tarjeta real ni se conecta a un banco.
router.post('/premium/suscribir', requiereAuth, async (req, res) => {
  if (req.usuario.tipo !== 'tecnico') {
    return res.status(403).json({ error: 'Solo los tecnicos pueden suscribirse al plan Premium' });
  }
  try {
    const result = await pool.query(
      `UPDATE perfiles_tecnicos
       SET es_premium = TRUE,
           premium_hasta = GREATEST(COALESCE(premium_hasta, NOW()), NOW()) + INTERVAL '30 days'
       WHERE usuario_id = $1
       RETURNING es_premium, premium_hasta`,
      [req.usuario.id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Crea primero tu perfil profesional' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar la suscripción' });
  }
});

module.exports = router;
