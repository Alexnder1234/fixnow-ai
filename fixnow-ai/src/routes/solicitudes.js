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
      `SELECT s.*, c.nombre AS categoria, c.icono,
              EXISTS (SELECT 1 FROM valoraciones v WHERE v.solicitud_id = s.id) AS ya_valorado
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

// US-07: Como tecnico, quiero ver los trabajos disponibles cerca de mi categoria
// para poder aceptarlos (antes de esto no existia ninguna forma de que un
// tecnico encontrara trabajo desde la interfaz).
router.get('/disponibles', requiereAuth, async (req, res) => {
  if (req.usuario.tipo !== 'tecnico') {
    return res.status(403).json({ error: 'Solo un tecnico puede ver los trabajos disponibles' });
  }
  try {
    const perfil = await pool.query('SELECT categoria_id FROM perfiles_tecnicos WHERE usuario_id = $1', [req.usuario.id]);
    const categoriaId = perfil.rows[0]?.categoria_id || null;

    const result = await pool.query(
      `SELECT s.*, c.nombre AS categoria, c.icono, u.nombre AS cliente_nombre
       FROM solicitudes s
       JOIN categorias c ON c.id = s.categoria_id
       JOIN usuarios u ON u.id = s.cliente_id
       WHERE s.estado = 'pendiente'
         AND ($1::int IS NULL OR s.categoria_id = $1)
       ORDER BY
         CASE s.urgencia WHEN 'urgente' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
         s.creado_en ASC`,
      [categoriaId]
    );
    res.json({ tiene_perfil: perfil.rows.length > 0, solicitudes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los trabajos disponibles' });
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

// El tecnico marca que ya empezo a trabajar en el ticket que acepto
router.patch('/:id/iniciar', requiereAuth, async (req, res) => {
  if (req.usuario.tipo !== 'tecnico') {
    return res.status(403).json({ error: 'Solo un tecnico puede iniciar un trabajo' });
  }
  try {
    const result = await pool.query(
      `UPDATE solicitudes SET estado = 'en_proceso'
       WHERE id = $1 AND tecnico_id = $2 AND estado = 'aceptada'
       RETURNING *`,
      [req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Este ticket no se puede iniciar en su estado actual' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar el trabajo' });
  }
});

// El tecnico marca el servicio como completado
router.patch('/:id/completar', requiereAuth, async (req, res) => {
  if (req.usuario.tipo !== 'tecnico') {
    return res.status(403).json({ error: 'Solo un tecnico puede finalizar un trabajo' });
  }
  try {
    const result = await pool.query(
      `UPDATE solicitudes SET estado = 'completada'
       WHERE id = $1 AND tecnico_id = $2 AND estado IN ('aceptada', 'en_proceso')
       RETURNING *`,
      [req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Este ticket no se puede finalizar en su estado actual' });
    }
    const solicitud = result.rows[0];
    await pool.query(
      `INSERT INTO notificaciones (usuario_id, titulo, mensaje)
       VALUES ($1, 'Tu servicio fue completado', 'El tecnico marco el ticket #' || $2 || ' como finalizado. Ya puedes pagar y dejar tu valoracion.')`,
      [solicitud.cliente_id, solicitud.id]
    );
    res.json(solicitud);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al finalizar el trabajo' });
  }
});

// Pago del servicio.
// IMPORTANTE: esto es un pago SIMULADO para fines academicos/demo.
// No se conecta a ningun procesador de pagos real (Stripe, Azul, etc.)
// ni mueve dinero de verdad. Guarda el metodo elegido y la fecha,
// solo para completar el flujo de la app en la presentacion.
router.patch('/:id/pagar', requiereAuth, async (req, res) => {
  const { metodo_pago } = req.body;
  try {
    const result = await pool.query(
      `UPDATE solicitudes SET pagado = TRUE, metodo_pago = $1, pagado_en = NOW()
       WHERE id = $2 AND cliente_id = $3 AND estado = 'completada' AND pagado = FALSE
       RETURNING *`,
      [metodo_pago || 'tarjeta', req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Este ticket no se puede pagar en este momento' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar el pago' });
  }
});

module.exports = router;
