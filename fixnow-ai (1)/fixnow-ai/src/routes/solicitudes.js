const express = require('express');
const pool = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');
const { estimarCosto } = require('../services/estimador');

const router = express.Router();

// US-04 + US-05 + US-09 + US-11:
// Como usuario, quiero solicitar un servicio indicando mi ubicacion,
// recibir una estimacion de costo por IA, subir una foto del problema
// y opcionalmente programar la fecha.
router.post('/', requiereAuth, async (req, res) => {
  const { categoria_id, descripcion, ubicacion, foto_url, urgencia, fecha_programada } = req.body;

  if (!categoria_id || !ubicacion) {
    return res.status(400).json({ error: 'La categoria y la ubicacion son obligatorias' });
  }

  try {
    const categoria = await pool.query('SELECT * FROM categorias WHERE id = $1', [categoria_id]);
    if (categoria.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria no encontrada' });
    }

    const { costo_estimado, detalle } = estimarCosto({
      tarifaBase: Number(categoria.rows[0].tarifa_base),
      urgencia: urgencia || 'normal',
      descripcion,
    });

    const result = await pool.query(
      `INSERT INTO solicitudes
         (cliente_id, categoria_id, descripcion, ubicacion, foto_url, urgencia, costo_estimado, fecha_programada)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.usuario.id, categoria_id, descripcion, ubicacion, foto_url, urgencia || 'normal', costo_estimado, fecha_programada || null]
    );

    res.status(201).json({ ...result.rows[0], detalle_estimacion: detalle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la solicitud' });
  }
});

// Estimar costo sin crear la solicitud todavia (para mostrar el numero antes de confirmar)
router.post('/estimar', async (req, res) => {
  const { categoria_id, urgencia, descripcion } = req.body;
  try {
    const categoria = await pool.query('SELECT * FROM categorias WHERE id = $1', [categoria_id]);
    if (categoria.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria no encontrada' });
    }
    const estimacion = estimarCosto({
      tarifaBase: Number(categoria.rows[0].tarifa_base),
      urgencia: urgencia || 'normal',
      descripcion,
    });
    res.json(estimacion);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al estimar el costo' });
  }
});

// Listar las solicitudes del usuario autenticado (como cliente o como tecnico)
router.get('/mias', requiereAuth, async (req, res) => {
  try {
    const columna = req.usuario.tipo === 'tecnico' ? 'tecnico_id' : 'cliente_id';
    const result = await pool.query(
      `SELECT s.*, c.nombre AS categoria, c.icono
       FROM solicitudes s
       JOIN categorias c ON c.id = s.categoria_id
       WHERE s.${columna} = $1
       ORDER BY s.creado_en DESC`,
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las solicitudes' });
  }
});

// Un tecnico acepta una solicitud pendiente
router.patch('/:id/aceptar', requiereAuth, async (req, res) => {
  if (req.usuario.tipo !== 'tecnico') {
    return res.status(403).json({ error: 'Solo un tecnico puede aceptar una solicitud' });
  }
  try {
    const result = await pool.query(
      `UPDATE solicitudes SET tecnico_id = $1, estado = 'aceptada'
       WHERE id = $2 AND estado = 'pendiente'
       RETURNING *`,
      [req.usuario.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'La solicitud ya no esta disponible' });
    }
    await pool.query(
      `INSERT INTO notificaciones (usuario_id, titulo, mensaje)
       VALUES ($1, 'Tu solicitud fue aceptada', 'Un tecnico aceptó tu solicitud y se pondrá en contacto contigo.')`,
      [result.rows[0].cliente_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al aceptar la solicitud' });
  }
});

module.exports = router;
