const express = require('express');
const pool = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requiereAuth, async (req, res) => {
  const { solicitud_id, tecnico_id, puntuacion, comentario } = req.body;
  if (!solicitud_id || !tecnico_id || !puntuacion) {
    return res.status(400).json({ error: 'solicitud_id, tecnico_id y puntuacion son obligatorios' });
  }
  try {
    const solicitud = await pool.query(
      `SELECT * FROM solicitudes WHERE id = $1 AND cliente_id = $2`,
      [solicitud_id, req.usuario.id]
    );
    if (solicitud.rows.length === 0) {
      return res.status(404).json({ error: 'Ese ticket no existe o no te pertenece' });
    }
    if (solicitud.rows[0].estado !== 'completada') {
      return res.status(409).json({ error: 'Solo puedes valorar un servicio ya completado' });
    }
    const existente = await pool.query('SELECT 1 FROM valoraciones WHERE solicitud_id = $1', [solicitud_id]);
    if (existente.rows.length > 0) {
      return res.status(409).json({ error: 'Ya valoraste este servicio' });
    }

    const result = await pool.query(
      `INSERT INTO valoraciones (solicitud_id, cliente_id, tecnico_id, puntuacion, comentario)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [solicitud_id, req.usuario.id, tecnico_id, puntuacion, comentario]
    );

    // Recalcular promedio del tecnico
    await pool.query(
      `UPDATE perfiles_tecnicos
       SET calificacion_promedio = (
             SELECT AVG(puntuacion) FROM valoraciones WHERE tecnico_id = $1
           ),
           total_valoraciones = (
             SELECT COUNT(*) FROM valoraciones WHERE tecnico_id = $1
           )
       WHERE usuario_id = $1`,
      [tecnico_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar la valoracion' });
  }
});

module.exports = router;
