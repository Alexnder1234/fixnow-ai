const express = require('express');
const pool = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');
const { enviarPush } = require('../services/push');

const router = express.Router();

// US-08: Como usuario, quiero comunicarme con el tecnico mediante chat.
router.post('/', requiereAuth, async (req, res) => {
  const { solicitud_id, contenido } = req.body;
  if (!solicitud_id || !contenido) {
    return res.status(400).json({ error: 'solicitud_id y contenido son obligatorios' });
  }
  try {
    const solicitud = await pool.query(
      `SELECT cliente_id, tecnico_id FROM solicitudes WHERE id = $1`,
      [solicitud_id]
    );
    if (solicitud.rows.length === 0) {
      return res.status(404).json({ error: 'Ese ticket no existe' });
    }
    const { cliente_id, tecnico_id } = solicitud.rows[0];
    if (req.usuario.id !== cliente_id && req.usuario.id !== tecnico_id) {
      return res.status(403).json({ error: 'No participas en este ticket' });
    }

    const result = await pool.query(
      `INSERT INTO mensajes (solicitud_id, remitente_id, contenido)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [solicitud_id, req.usuario.id, contenido]
    );

    // Notificar al otro participante del ticket (cliente o tecnico, el que no escribio)
    const destinatarioId = req.usuario.id === cliente_id ? tecnico_id : cliente_id;
    if (destinatarioId) {
      const vistaPrevia = contenido.length > 80 ? `${contenido.slice(0, 80)}…` : contenido;
      await pool.query(
        `INSERT INTO notificaciones (usuario_id, titulo, mensaje)
         VALUES ($1, 'Nuevo mensaje', $2)`,
        [destinatarioId, `Ticket #${solicitud_id}: ${vistaPrevia}`]
      );
      enviarPush(destinatarioId, {
        titulo: 'Nuevo mensaje',
        cuerpo: `Ticket #${solicitud_id}: ${vistaPrevia}`,
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
});

router.get('/:solicitudId', requiereAuth, async (req, res) => {
  try {
    const solicitud = await pool.query(
      `SELECT cliente_id, tecnico_id FROM solicitudes WHERE id = $1`,
      [req.params.solicitudId]
    );
    if (solicitud.rows.length === 0) {
      return res.status(404).json({ error: 'Ese ticket no existe' });
    }
    const { cliente_id, tecnico_id } = solicitud.rows[0];
    if (req.usuario.id !== cliente_id && req.usuario.id !== tecnico_id) {
      return res.status(403).json({ error: 'No participas en este ticket' });
    }

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
