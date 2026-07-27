const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('fixnow_token');
}
function setSesion(token, usuario) {
  localStorage.setItem('fixnow_token', token);
  localStorage.setItem('fixnow_usuario', JSON.stringify(usuario));
}
function limpiarSesion() {
  localStorage.removeItem('fixnow_token');
  localStorage.removeItem('fixnow_usuario');
}
function getUsuario() {
  const raw = localStorage.getItem('fixnow_usuario');
  return raw ? JSON.parse(raw) : null;
}

async function apiFetch(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Ocurrió un error inesperado');
  }
  return data;
}

const api = {
  registro: (payload) => apiFetch('/auth/registro', { method: 'POST', body: payload }),
  login: (payload) => apiFetch('/auth/login', { method: 'POST', body: payload }),
  categorias: () => apiFetch('/categorias'),
  tecnicos: (categoria) => apiFetch(`/tecnicos${categoria ? `?categoria=${encodeURIComponent(categoria)}` : ''}`),
  tecnico: (id) => apiFetch(`/tecnicos/${id}`),
  guardarPerfilTecnico: (payload) => apiFetch('/tecnicos/perfil', { method: 'POST', body: payload, auth: true }),
  estimar: (payload) => apiFetch('/solicitudes/estimar', { method: 'POST', body: payload }),
  crearSolicitud: (payload) => apiFetch('/solicitudes', { method: 'POST', body: payload, auth: true }),
  misSolicitudes: () => apiFetch('/solicitudes/mias', { auth: true }),
  trabajosDisponibles: () => apiFetch('/solicitudes/disponibles', { auth: true }),
  estadisticas: () => apiFetch('/solicitudes/estadisticas', { auth: true }),
  misFavoritos: () => apiFetch('/tecnicos/favoritos/mios', { auth: true }),
  idsFavoritos: () => apiFetch('/tecnicos/favoritos/ids', { auth: true }),
  alternarFavorito: (id) => apiFetch(`/tecnicos/${id}/favorito`, { method: 'POST', auth: true }),
  aceptarSolicitud: (id) => apiFetch(`/solicitudes/${id}/aceptar`, { method: 'PATCH', auth: true }),
  iniciarSolicitud: (id) => apiFetch(`/solicitudes/${id}/iniciar`, { method: 'PATCH', auth: true }),
  completarSolicitud: (id) => apiFetch(`/solicitudes/${id}/completar`, { method: 'PATCH', auth: true }),
  pagarSolicitud: (id, metodo_pago) => apiFetch(`/solicitudes/${id}/pagar`, { method: 'PATCH', body: { metodo_pago }, auth: true }),
  valorar: (payload) => apiFetch('/valoraciones', { method: 'POST', body: payload, auth: true }),
  notificaciones: () => apiFetch('/notificaciones', { auth: true }),
  marcarNotificacionLeida: (id) => apiFetch(`/notificaciones/${id}/leida`, { method: 'PATCH', auth: true }),
  vapidPublicKey: () => apiFetch('/push/vapid-public-key'),
  suscribirPush: (subscription) => apiFetch('/push/suscribir', { method: 'POST', body: subscription, auth: true }),
  mensajes: (solicitudId) => apiFetch(`/mensajes/${solicitudId}`, { auth: true }),
  enviarMensaje: (payload) => apiFetch('/mensajes', { method: 'POST', body: payload, auth: true }),
};
