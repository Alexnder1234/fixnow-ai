const express = require('express');
const pool = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();

// US-07: Como tecnico, quiero recibir notificaciones de nuevos trabajos cercanos.
router.get('/', requiereAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notificaciones WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 50`,
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

router.patch('/:id/leida', requiereAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND usuario_id = $2 RETURNING *`,
      [req.params.id, req.usuario.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la notificacion' });
  }
});

module.exports = router;
