const express = require('express');
const pool = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();

// US-08: Como usuario, quiero comunicarme con el tecnico mediante chat.
router.post('/', requiereAuth, async (req, res) => {
  const { solicitud_id, contenido } = req.body;
  if (!solicitud_id || !contenido) {
    return res.status(400).json({ error: 'solicitud_id y contenido son obligatorios' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO mensajes (solicitud_id, remitente_id, contenido)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [solicitud_id, req.usuario.id, contenido]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
});

router.get('/:solicitudId', requiereAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, u.nombre AS remitente
       FROM mensajes m
       JOIN usuarios u ON u.id = m.remitente_id
       WHERE m.solicitud_id = $1
       ORDER BY m.creado_en ASC`,
      [req.params.solicitudId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los mensajes' });
  }
});

module.exports = router;
