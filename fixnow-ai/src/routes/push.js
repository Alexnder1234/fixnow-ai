const express = require('express');
const pool = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');
const { vapidConfigurado } = require('../services/push');

const router = express.Router();

// El frontend pide esto para saber con que llave publica suscribirse,
// y para saber si el servidor tiene push habilitado en absoluto.
router.get('/vapid-public-key', (req, res) => {
  res.json({
    habilitado: vapidConfigurado,
    llave_publica: vapidConfigurado ? process.env.VAPID_PUBLIC_KEY : null,
  });
});

router.post('/suscribir', requiereAuth, async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Suscripcion invalida' });
  }
  try {
    await pool.query(
      `INSERT INTO push_suscripciones (usuario_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
         SET usuario_id = EXCLUDED.usuario_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [req.usuario.id, endpoint, keys.p256dh, keys.auth]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar la suscripcion' });
  }
});

router.post('/desuscribir', requiereAuth, async (req, res) => {
  const { endpoint } = req.body || {};
  try {
    await pool.query('DELETE FROM push_suscripciones WHERE endpoint = $1 AND usuario_id = $2', [
      endpoint,
      req.usuario.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la suscripcion' });
  }
});

module.exports = router;
