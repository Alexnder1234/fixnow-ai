const webpush = require('web-push');
const pool = require('../db/pool');

const vapidConfigurado = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (vapidConfigurado) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'contacto@fixnowai.local'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn(
    'Aviso: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no estan configuradas. ' +
    'Las notificaciones push reales quedaran desactivadas (la app sigue ' +
    'funcionando normal, solo no llegaran avisos fuera de la app).'
  );
}

/**
 * Envia una notificacion push a todos los dispositivos suscritos de un usuario.
 * Si el envio falla porque la suscripcion ya no es valida (410/404), la borra
 * de la base de datos para no seguir intentando en vano.
 */
async function enviarPush(usuarioId, { titulo, cuerpo, url }) {
  if (!vapidConfigurado) return;

  try {
    const suscripciones = await pool.query(
      'SELECT * FROM push_suscripciones WHERE usuario_id = $1',
      [usuarioId]
    );

    const payload = JSON.stringify({ titulo, cuerpo, url: url || '/' });

    await Promise.all(
      suscripciones.rows.map(async (sub) => {
        const suscripcionWebPush = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        try {
          await webpush.sendNotification(suscripcionWebPush, payload);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await pool.query('DELETE FROM push_suscripciones WHERE endpoint = $1', [sub.endpoint]);
          } else {
            console.error('Error enviando push:', err.message);
          }
        }
      })
    );
  } catch (err) {
    console.error('Error preparando el envio de push:', err.message);
  }
}

module.exports = { enviarPush, vapidConfigurado };
