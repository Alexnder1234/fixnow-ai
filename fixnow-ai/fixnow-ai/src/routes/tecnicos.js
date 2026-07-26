const express = require('express');
const pool = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();

// US-02: Como usuario, quiero buscar tecnicos por categoria.
router.get('/', async (req, res) => {
  const { categoria } = req.query;
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.ubicacion, p.descripcion, p.anos_experiencia,
              p.calificacion_promedio, p.total_valoraciones, c.nombre AS categoria, c.icono
       FROM perfiles_tecnicos p
       JOIN usuarios u ON u.id = p.usuario_id
       JOIN categorias c ON c.id = p.categoria_id
       WHERE ($1::text IS NULL OR c.nombre ILIKE $1)
       ORDER BY p.calificacion_promedio DESC`,
      [categoria || null]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar tecnicos' });
  }
});

// US-03: Como usuario, quiero visualizar perfiles y valoraciones para contratar con confianza.
router.get('/:id', async (req, res) => {
  try {
    const perfil = await pool.query(
      `SELECT u.id, u.nombre, u.ubicacion, u.telefono, p.descripcion, p.anos_experiencia,
              p.calificacion_promedio, p.total_valoraciones, c.nombre AS categoria, c.icono
       FROM perfiles_tecnicos p
       JOIN usuarios u ON u.id = p.usuario_id
       JOIN categorias c ON c.id = p.categoria_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (perfil.rows.length === 0) {
      return res.status(404).json({ error: 'Tecnico no encontrado' });
    }
    const valoraciones = await pool.query(
      `SELECT v.puntuacion, v.comentario, v.creado_en, u.nombre AS cliente
       FROM valoraciones v
       JOIN usuarios u ON u.id = v.cliente_id
       WHERE v.tecnico_id = $1
       ORDER BY v.creado_en DESC
       LIMIT 20`,
      [req.params.id]
    );
    res.json({ ...perfil.rows[0], valoraciones: valoraciones.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

// US-06: Como tecnico, quiero crear mi perfil profesional para ofrecer mis servicios.
router.post('/perfil', requiereAuth, async (req, res) => {
  if (req.usuario.tipo !== 'tecnico') {
    return res.status(403).json({ error: 'Solo los tecnicos pueden crear un perfil profesional' });
  }
  const { categoria_id, descripcion, anos_experiencia } = req.body;
  if (!categoria_id) {
    return res.status(400).json({ error: 'La categoria es obligatoria' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO perfiles_tecnicos (usuario_id, categoria_id, descripcion, anos_experiencia)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id) DO UPDATE
         SET categoria_id = EXCLUDED.categoria_id,
             descripcion = EXCLUDED.descripcion,
             anos_experiencia = EXCLUDED.anos_experiencia
       RETURNING *`,
      [req.usuario.id, categoria_id, descripcion, anos_experiencia || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el perfil' });
  }
});

module.exports = router;
