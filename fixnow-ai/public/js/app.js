// ---------- Navegación ----------
const vistas = document.querySelectorAll('.view');
let categoriasCache = [];
let notiPollTimer = null;

const NAV_ITEMS = {
  invitado: [
    { id: 'landing', icon: '🏠', label: 'Inicio' },
    { id: 'buscar', icon: '🔍', label: 'Buscar' },
    { id: 'auth', icon: '🔑', label: 'Ingresar' },
  ],
  cliente: [
    { id: 'landing', icon: '🏠', label: 'Inicio' },
    { id: 'buscar', icon: '🔍', label: 'Buscar' },
    { id: 'solicitar', icon: '🧾', label: 'Solicitar' },
    { id: 'dashboard', icon: '🎫', label: 'Tickets' },
    { id: 'notificaciones', icon: '🔔', label: 'Avisos' },
  ],
  tecnico: [
    { id: 'landing', icon: '🏠', label: 'Inicio' },
    { id: 'trabajos', icon: '💼', label: 'Trabajos' },
    { id: 'mi-perfil', icon: '🪪', label: 'Mi perfil' },
    { id: 'dashboard', icon: '🎫', label: 'Tickets' },
    { id: 'notificaciones', icon: '🔔', label: 'Avisos' },
  ],
};

function grupoNav() {
  const usuario = getUsuario();
  if (!usuario) return 'invitado';
  return usuario.tipo === 'tecnico' ? 'tecnico' : 'cliente';
}

function renderBottomNav() {
  const nav = document.getElementById('bottomNav');
  const items = NAV_ITEMS[grupoNav()];
  nav.innerHTML = items
    .map((it) => `<button class="bottomnav__item" data-nav="${it.id}" data-navid="${it.id}">
        <span class="bottomnav__icon">${it.icon}</span>
        <span class="bottomnav__label">${it.label}</span>
        ${it.id === 'notificaciones' ? '<span class="bottomnav__badge" id="notiBadge" hidden></span>' : ''}
      </button>`)
    .join('');
  nav.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => mostrarVista(el.dataset.nav));
  });
  actualizarNavActiva('landing');
}

function actualizarNavActiva(nombre) {
  document.querySelectorAll('.bottomnav__item').forEach((el) => {
    el.classList.toggle('bottomnav__item--active', el.dataset.navid === nombre);
  });
}

function mostrarVista(nombre) {
  if (nombre === 'registro-cliente' || nombre === 'registro-tecnico') {
    mostrarVista('auth');
    activarTabAuth('registro');
    const tipoDeseado = nombre === 'registro-tecnico' ? 'tecnico' : 'cliente';
    const radio = document.querySelector(`#formRegistro input[name="tipo"][value="${tipoDeseado}"]`);
    if (radio) radio.checked = true;
    return;
  }

  const rutasProtegidas = ['solicitar', 'dashboard', 'mi-perfil', 'trabajos', 'notificaciones'];
  if (rutasProtegidas.includes(nombre) && !getToken()) {
    mostrarVista('auth');
    toast('Inicia sesión primero', 'error');
    return;
  }

  vistas.forEach((v) => v.classList.toggle('view--active', v.dataset.view === nombre));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  actualizarNavActiva(nombre);

  if (nombre === 'buscar') cargarTecnicos();
  if (nombre === 'solicitar') prepararFormSolicitud();
  if (nombre === 'dashboard') cargarDashboard();
  if (nombre === 'mi-perfil') prepararPerfilTecnico();
  if (nombre === 'trabajos') cargarTrabajosDisponibles();
  if (nombre === 'notificaciones') cargarNotificaciones();
}

document.querySelectorAll('[data-nav]').forEach((el) => {
  el.addEventListener('click', () => mostrarVista(el.dataset.nav));
});

// ---------- Toast ----------
let toastTimeout;
function toast(mensaje, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = mensaje;
  el.style.borderLeftColor = tipo === 'error' ? 'var(--danger)' : 'var(--amber)';
  el.classList.add('toast--visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('toast--visible'), 3200);
}

// ---------- Auth UI ----------
function pintarAuthArea() {
  const usuario = getUsuario();
  const cont = document.getElementById('authArea');
  if (usuario) {
    cont.innerHTML = `<span class="cuenta-badge cuenta-badge--${usuario.tipo}">${usuario.tipo === 'tecnico' ? '🛠️ Técnico' : '🧑 Cliente'}</span>
      <span class="topbar__usuario">${usuario.nombre.split(' ')[0]}</span>
      <button class="btn btn--ghost btn--small" id="btnLogout">Salir</button>`;
    document.getElementById('btnLogout').addEventListener('click', () => {
      limpiarSesion();
      detenerPollNotificaciones();
      pintarAuthArea();
      renderBottomNav();
      toast('Sesión cerrada');
      mostrarVista('landing');
    });
    iniciarPollNotificaciones();
  } else {
    cont.innerHTML = `<button class="btn btn--ghost btn--small" data-nav="auth">Iniciar sesión</button>`;
    cont.querySelector('[data-nav]').addEventListener('click', () => mostrarVista('auth'));
  }
}

function activarTabAuth(tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('tab--active', t.dataset.authtab === tab));
  document.getElementById('formLogin').hidden = tab !== 'login';
  document.getElementById('formRegistro').hidden = tab !== 'registro';
}
document.querySelectorAll('[data-authtab]').forEach((t) => {
  t.addEventListener('click', () => activarTabAuth(t.dataset.authtab));
});
activarTabAuth('login');

document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.querySelector('[data-error="login"]');
  errorEl.textContent = '';
  const datos = Object.fromEntries(new FormData(e.target));
  try {
    const { token, usuario } = await api.login(datos);
    setSesion(token, usuario);
    pintarAuthArea();
    renderBottomNav();
    toast(`Bienvenido, ${usuario.nombre.split(' ')[0]}`);
    mostrarVista('dashboard');
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('formRegistro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.querySelector('[data-error="registro"]');
  errorEl.textContent = '';
  const datos = Object.fromEntries(new FormData(e.target));
  try {
    const { token, usuario } = await api.registro(datos);
    setSesion(token, usuario);
    pintarAuthArea();
    renderBottomNav();
    toast(`Cuenta creada. ¡Bienvenido, ${usuario.nombre.split(' ')[0]}!`);
    mostrarVista(usuario.tipo === 'tecnico' ? 'mi-perfil' : 'solicitar');
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------- Categorías (hero + filtros + formularios) ----------
async function cargarCategorias() {
  if (categoriasCache.length) return categoriasCache;
  categoriasCache = await api.categorias();

  document.getElementById('heroCategorias').innerHTML = categoriasCache
    .map((c) => `<div class="hero-cat"><span class="hero-cat__icon">${c.icono}</span>${c.nombre}</div>`)
    .join('');

  const filtroCont = document.getElementById('filtroCategorias');
  categoriasCache.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.dataset.categoria = c.nombre;
    btn.textContent = `${c.icono} ${c.nombre}`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filtroCategorias .chip').forEach((x) => x.classList.remove('chip--active'));
      btn.classList.add('chip--active');
      cargarTecnicos(c.nombre);
    });
    filtroCont.appendChild(btn);
  });
  filtroCont.querySelector('.chip').addEventListener('click', () => {
    document.querySelectorAll('#filtroCategorias .chip').forEach((x) => x.classList.remove('chip--active'));
    filtroCont.querySelector('.chip').classList.add('chip--active');
    cargarTecnicos('');
  });

  return categoriasCache;
}

// ---------- Buscar técnicos ----------
async function cargarTecnicos(categoria = '') {
  const grid = document.getElementById('tecnicoGrid');
  grid.innerHTML = '<p class="empty-state">Cargando técnicos…</p>';
  await cargarCategorias();
  try {
    const tecnicos = await api.tecnicos(categoria);
    if (tecnicos.length === 0) {
      grid.innerHTML = '<p class="empty-state">Todavía no hay técnicos registrados en esta categoría.</p>';
      return;
    }
    grid.innerHTML = tecnicos
      .map(
        (t) => `
      <div class="tecnico-card" data-id="${t.id}">
        <span class="tecnico-card__cat">${t.icono || '🔧'}</span>
        <span class="tecnico-card__nombre">${t.nombre}</span>
        <span class="tecnico-card__meta">${t.categoria} · ${t.ubicacion || 'Ubicación no indicada'}</span>
        <span class="tecnico-card__rating">★ ${Number(t.calificacion_promedio || 0).toFixed(1)} (${t.total_valoraciones || 0})</span>
      </div>`
      )
      .join('');
    grid.querySelectorAll('.tecnico-card').forEach((card) => {
      card.addEventListener('click', () => verPerfil(card.dataset.id));
    });
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">No se pudieron cargar los técnicos: ${err.message}</p>`;
  }
}

async function verPerfil(id) {
  mostrarVista('perfil');
  const cont = document.getElementById('perfilContenido');
  cont.innerHTML = '<p class="empty-state">Cargando perfil…</p>';
  try {
    const perfil = await api.tecnico(id);
    cont.innerHTML = `
      <div class="perfil-card">
        <div class="perfil-card__head">
          <div>
            <h2>${perfil.nombre}</h2>
            <p class="section-sub">${perfil.icono || '🔧'} ${perfil.categoria} · ${perfil.ubicacion || ''}</p>
          </div>
          <span class="tecnico-card__rating">★ ${Number(perfil.calificacion_promedio || 0).toFixed(1)} (${perfil.total_valoraciones || 0} valoraciones)</span>
        </div>
        <p>${perfil.descripcion || 'Este técnico aún no agregó una descripción.'}</p>
        <p class="ticket-row__id">${perfil.anos_experiencia || 0} años de experiencia</p>
        <h3 style="font-size:1rem;margin-top:1.5rem;">Valoraciones de clientes</h3>
        ${
          perfil.valoraciones.length === 0
            ? '<p class="empty-state">Aún no tiene valoraciones.</p>'
            : perfil.valoraciones
                .map(
                  (v) => `<div class="review">
                    <div class="review__meta">${v.cliente} · ★ ${v.puntuacion}</div>
                    <p>${v.comentario || ''}</p>
                  </div>`
                )
                .join('')
        }
      </div>`;
  } catch (err) {
    cont.innerHTML = `<p class="empty-state">No se pudo cargar el perfil: ${err.message}</p>`;
  }
}

// ---------- Solicitar servicio ----------
let estimarTimeout;
async function prepararFormSolicitud() {
  await cargarCategorias();
  const select = document.getElementById('selectCategoria');
  if (!select.dataset.cargado) {
    select.innerHTML = categoriasCache.map((c) => `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join('');
    select.dataset.cargado = '1';
  }
  actualizarEstimacion();
}

const formSolicitud = document.getElementById('formSolicitud');
formSolicitud.addEventListener('input', () => {
  clearTimeout(estimarTimeout);
  estimarTimeout = setTimeout(actualizarEstimacion, 350);
});

async function actualizarEstimacion() {
  const datos = Object.fromEntries(new FormData(formSolicitud));
  if (!datos.categoria_id) return;
  try {
    const { costo_estimado, detalle } = await api.estimar({
      categoria_id: Number(datos.categoria_id),
      urgencia: datos.urgencia,
      descripcion: datos.descripcion,
    });
    document.getElementById('estimateAmount').textContent = `RD$ ${Number(costo_estimado).toLocaleString('es-DO')}`;
    document.getElementById('estimateDetail').textContent = detalle;
  } catch (err) {
    document.getElementById('estimateDetail').textContent = 'No se pudo calcular la estimación todavía.';
  }
}

formSolicitud.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.querySelector('[data-error="solicitud"]');
  errorEl.textContent = '';
  const datos = Object.fromEntries(new FormData(formSolicitud));
  try {
    const solicitud = await api.crearSolicitud({
      ...datos,
      categoria_id: Number(datos.categoria_id),
    });
    toast(`Solicitud creada — ticket N.º ${solicitud.id}`);
    formSolicitud.reset();
    mostrarVista('dashboard');
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------- Mi perfil profesional (tecnico) ----------
async function prepararPerfilTecnico() {
  const usuario = getUsuario();
  if (usuario) document.getElementById('cuentaBannerPerfil').innerHTML = panelCuenta(usuario);
  await cargarCategorias();
  const select = document.getElementById('selectCategoriaPerfil');
  if (!select.dataset.cargado) {
    select.innerHTML = categoriasCache.map((c) => `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join('');
    select.dataset.cargado = '1';
  }
}

document.getElementById('formPerfilTecnico').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.querySelector('[data-error="perfilTecnico"]');
  const okEl = document.querySelector('[data-ok="perfilTecnico"]');
  errorEl.textContent = '';
  okEl.textContent = '';
  const datos = Object.fromEntries(new FormData(e.target));
  try {
    await api.guardarPerfilTecnico({
      categoria_id: Number(datos.categoria_id),
      descripcion: datos.descripcion,
      anos_experiencia: Number(datos.anos_experiencia) || 0,
    });
    okEl.textContent = '¡Perfil guardado! Ya apareces en la búsqueda de tu categoría.';
    toast('Perfil profesional guardado');
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------- Trabajos disponibles (tecnico) ----------
async function cargarTrabajosDisponibles() {
  const cont = document.getElementById('trabajosList');
  const sub = document.getElementById('trabajosSub');
  cont.innerHTML = '<p class="empty-state">Cargando…</p>';
  try {
    const { tiene_perfil, solicitudes } = await api.trabajosDisponibles();
    if (!tiene_perfil) {
      sub.textContent = 'Aún no has creado tu perfil profesional — hazlo primero para ver trabajos de tu categoría.';
    } else {
      sub.textContent = 'Solicitudes pendientes en tu categoría, más urgentes primero.';
    }
    if (solicitudes.length === 0) {
      cont.innerHTML = '<p class="empty-state">No hay trabajos pendientes por ahora. Vuelve a revisar más tarde.</p>';
      return;
    }
    cont.innerHTML = solicitudes
      .map(
        (s) => `
      <div class="ticket-row">
        <div>
          <div class="ticket-row__id">Ticket #${String(s.id).padStart(4, '0')} · ${s.icono || '🔧'} ${s.categoria} · ${s.cliente_nombre}</div>
          <div>${s.descripcion || ''}</div>
          <div class="ticket-row__id">📍 ${s.ubicacion || ''} · RD$ ${Number(s.costo_estimado || 0).toLocaleString('es-DO')}</div>
        </div>
        <div style="text-align:right; display:flex; flex-direction:column; gap:.4rem; align-items:flex-end;">
          <div class="estado-tag estado-${s.urgencia === 'urgente' ? 'cancelada' : 'pendiente'}">${s.urgencia}</div>
          <button class="btn btn--amber btn--small" data-aceptar="${s.id}">Aceptar</button>
        </div>
      </div>`
      )
      .join('');
    cont.querySelectorAll('[data-aceptar]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api.aceptarSolicitud(btn.dataset.aceptar);
          toast('Trabajo aceptado — ya aparece en tus tickets');
          cargarTrabajosDisponibles();
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    cont.innerHTML = `<p class="empty-state">No se pudieron cargar los trabajos: ${err.message}</p>`;
  }
}

// ---------- Dashboard / mis tickets ----------
function panelCuenta(usuario) {
  const esTecnico = usuario.tipo === 'tecnico';
  return `
    <div class="cuenta-panel cuenta-panel--${usuario.tipo}">
      <span class="cuenta-badge cuenta-badge--${usuario.tipo}">${esTecnico ? '🛠️ Cuenta de Técnico' : '🧑 Cuenta de Cliente'}</span>
      <div class="cuenta-panel__nombre">${usuario.nombre}</div>
      <div class="cuenta-panel__meta">${usuario.email}${usuario.telefono ? ' · ' + usuario.telefono : ''}${usuario.ubicacion ? ' · ' + usuario.ubicacion : ''}</div>
    </div>`;
}

async function cargarDashboard() {
  const sub = document.getElementById('dashboardSub');
  const lista = document.getElementById('ticketList');
  const banner = document.getElementById('cuentaBannerDashboard');
  const usuario = getUsuario();
  if (!usuario) {
    sub.textContent = 'Inicia sesión para ver tus solicitudes.';
    lista.innerHTML = '';
    banner.innerHTML = '';
    return;
  }
  banner.innerHTML = panelCuenta(usuario);
  sub.textContent = usuario.tipo === 'tecnico' ? 'Trabajos que has aceptado.' : 'Tus solicitudes de servicio.';
  lista.innerHTML = '<p class="empty-state">Cargando…</p>';
  try {
    const solicitudes = await api.misSolicitudes();
    if (solicitudes.length === 0) {
      lista.innerHTML = '<p class="empty-state">Todavía no tienes tickets.</p>';
      return;
    }
    lista.innerHTML = solicitudes.map((s) => filaTicket(s, usuario)).join('');

    lista.querySelectorAll('[data-chat]').forEach((btn) => {
      btn.addEventListener('click', () => abrirChat(btn.dataset.chat));
    });
    lista.querySelectorAll('[data-iniciar]').forEach((btn) => {
      btn.addEventListener('click', () => accionTicket(btn, () => api.iniciarSolicitud(btn.dataset.iniciar), 'Trabajo iniciado'));
    });
    lista.querySelectorAll('[data-completar]').forEach((btn) => {
      btn.addEventListener('click', () => accionTicket(btn, () => api.completarSolicitud(btn.dataset.completar), '¡Servicio marcado como completado!'));
    });
    lista.querySelectorAll('[data-pagar]').forEach((btn) => {
      btn.addEventListener('click', () => abrirPago(btn.dataset.pagar, btn.dataset.monto));
    });
    lista.querySelectorAll('[data-valorar]').forEach((btn) => {
      btn.addEventListener('click', () => abrirValorar(btn.dataset.valorar, btn.dataset.tecnicoId));
    });
  } catch (err) {
    lista.innerHTML = `<p class="empty-state">No se pudieron cargar tus tickets: ${err.message}</p>`;
  }
}

function filaTicket(s, usuario) {
  const esTecnico = usuario.tipo === 'tecnico';
  let acciones = `<button class="btn btn--ghost btn--small" data-chat="${s.id}">💬 Chat</button>`;

  if (esTecnico) {
    if (s.estado === 'aceptada') {
      acciones = `<button class="btn btn--amber btn--small" data-iniciar="${s.id}">▶ Iniciar trabajo</button>` + acciones;
    } else if (s.estado === 'en_proceso') {
      acciones = `<button class="btn btn--amber btn--small" data-completar="${s.id}">✔ Marcar completado</button>` + acciones;
    }
  } else {
    if (s.estado === 'completada' && !s.pagado) {
      acciones = `<button class="btn btn--amber btn--small" data-pagar="${s.id}" data-monto="${s.costo_estimado}">💳 Pagar</button>` + acciones;
    } else if (s.pagado && !s.ya_valorado) {
      acciones = `<button class="btn btn--amber btn--small" data-valorar="${s.id}" data-tecnico-id="${s.tecnico_id}">★ Valorar técnico</button>` + acciones;
    }
  }

  const etiquetas = [];
  if (s.pagado) etiquetas.push('<span class="pago-tag">Pagado</span>');
  if (s.ya_valorado) etiquetas.push('<span class="valoracion-tag">★ Ya valoraste</span>');

  return `
      <div class="ticket-row">
        <div>
          <div class="ticket-row__id">Ticket #${String(s.id).padStart(4, '0')} · ${s.icono || '🔧'} ${s.categoria}</div>
          <div>${s.descripcion || ''}</div>
        </div>
        <div class="ticket-row__acciones">
          <div class="estado-tag estado-${s.estado}">${s.estado.replace('_', ' ')}</div>
          <div class="ticket-row__id">RD$ ${Number(s.costo_estimado || 0).toLocaleString('es-DO')}</div>
          ${etiquetas.join('')}
          ${acciones}
        </div>
      </div>`;
}

async function accionTicket(btn, llamada, mensajeExito) {
  btn.disabled = true;
  try {
    await llamada();
    toast(mensajeExito);
    cargarDashboard();
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
}

// ---------- Notificaciones ----------
async function cargarNotificaciones() {
  const cont = document.getElementById('notificacionesList');
  cont.innerHTML = '<p class="empty-state">Cargando…</p>';
  try {
    const notis = await api.notificaciones();
    if (notis.length === 0) {
      cont.innerHTML = '<p class="empty-state">No tienes notificaciones todavía.</p>';
    } else {
      cont.innerHTML = notis
        .map(
          (n) => `
        <div class="ticket-row" style="opacity:${n.leida ? 0.6 : 1};">
          <div>
            <div class="ticket-row__id">${new Date(n.creado_en).toLocaleString('es-DO')}</div>
            <div style="font-weight:600;">${n.titulo}</div>
            <div>${n.mensaje || ''}</div>
          </div>
          ${!n.leida ? `<button class="btn btn--ghost btn--small" data-leida="${n.id}">Marcar leída</button>` : ''}
        </div>`
        )
        .join('');
      cont.querySelectorAll('[data-leida]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await api.marcarNotificacionLeida(btn.dataset.leida);
          cargarNotificaciones();
          actualizarBadgeNotificaciones();
        });
      });
    }
    actualizarBadgeNotificaciones(notis);
  } catch (err) {
    cont.innerHTML = `<p class="empty-state">No se pudieron cargar: ${err.message}</p>`;
  }
}

async function actualizarBadgeNotificaciones(notisPrecargadas) {
  const badge = document.getElementById('notiBadge');
  if (!badge) return;
  try {
    const notis = notisPrecargadas || (await api.notificaciones());
    const sinLeer = notis.filter((n) => !n.leida).length;
    if (sinLeer > 0) {
      badge.textContent = sinLeer > 9 ? '9+' : sinLeer;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  } catch (err) {
    /* silencioso: no interrumpir la UI por el badge */
  }
}

function iniciarPollNotificaciones() {
  detenerPollNotificaciones();
  actualizarBadgeNotificaciones();
  notiPollTimer = setInterval(actualizarBadgeNotificaciones, 45000);
}
function detenerPollNotificaciones() {
  if (notiPollTimer) clearInterval(notiPollTimer);
  notiPollTimer = null;
}

// ---------- Chat ----------
let chatSolicitudActual = null;
function abrirChat(solicitudId) {
  chatSolicitudActual = solicitudId;
  document.getElementById('chatTicketId').textContent = `#${String(solicitudId).padStart(4, '0')}`;
  document.getElementById('chatModal').hidden = false;
  cargarMensajes();
}
document.getElementById('chatClose').addEventListener('click', () => {
  document.getElementById('chatModal').hidden = true;
  chatSolicitudActual = null;
});

async function cargarMensajes() {
  const cont = document.getElementById('chatMensajes');
  cont.innerHTML = '<p class="empty-state">Cargando mensajes…</p>';
  try {
    const usuario = getUsuario();
    const mensajes = await api.mensajes(chatSolicitudActual);
    if (mensajes.length === 0) {
      cont.innerHTML = '<p class="empty-state">Todavía no hay mensajes. Escribe el primero.</p>';
      return;
    }
    cont.innerHTML = mensajes
      .map((m) => {
        const propio = usuario && m.remitente_id === usuario.id;
        return `<div class="chat-bubble ${propio ? 'chat-bubble--propio' : ''}">
          <div class="chat-bubble__meta">${propio ? 'Tú' : m.remitente}</div>
          <div>${m.contenido}</div>
        </div>`;
      })
      .join('');
    cont.scrollTop = cont.scrollHeight;
  } catch (err) {
    cont.innerHTML = `<p class="empty-state">No se pudieron cargar los mensajes: ${err.message}</p>`;
  }
}

document.getElementById('formChat').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.elements.contenido;
  const contenido = input.value.trim();
  if (!contenido || !chatSolicitudActual) return;
  try {
    await api.enviarMensaje({ solicitud_id: chatSolicitudActual, contenido });
    input.value = '';
    cargarMensajes();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- Pago (simulado) ----------
let pagoSolicitudActual = null;

function abrirPago(solicitudId, monto) {
  pagoSolicitudActual = solicitudId;
  document.getElementById('pagoTicketId').textContent = `#${String(solicitudId).padStart(4, '0')}`;
  document.getElementById('pagoMonto').textContent = `RD$ ${Number(monto || 0).toLocaleString('es-DO')}`;
  document.querySelector('[data-error="pago"]').textContent = '';
  document.getElementById('formPago').reset();
  document.getElementById('formPago').hidden = false;
  document.getElementById('reciboPago').hidden = true;
  document.getElementById('camposTarjeta').style.display = 'flex';
  document.getElementById('pagoModal').hidden = false;
}
document.getElementById('pagoClose').addEventListener('click', () => {
  document.getElementById('pagoModal').hidden = true;
  pagoSolicitudActual = null;
  cargarDashboard();
});
document.getElementById('btnReciboListo').addEventListener('click', () => {
  document.getElementById('pagoModal').hidden = true;
  pagoSolicitudActual = null;
  cargarDashboard();
});
document.getElementById('btnReciboImprimir').addEventListener('click', () => {
  window.print();
});

document.querySelectorAll('#formPago input[name="metodo"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    document.getElementById('camposTarjeta').style.display = e.target.value === 'tarjeta' ? 'flex' : 'none';
  });
});

// Auto-formato del numero de tarjeta: agrupa de 4 en 4 (solo cosmetico, es un pago simulado)
const numTarjetaInput = document.getElementById('numTarjeta');
numTarjetaInput.addEventListener('input', () => {
  const digitos = numTarjetaInput.value.replace(/\D/g, '').slice(0, 16);
  numTarjetaInput.value = digitos.replace(/(.{4})/g, '$1 ').trim();
});
const expTarjetaInput = document.getElementById('expTarjeta');
expTarjetaInput.addEventListener('input', () => {
  let digitos = expTarjetaInput.value.replace(/\D/g, '').slice(0, 4);
  if (digitos.length >= 3) digitos = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  expTarjetaInput.value = digitos;
});

// Genera un numero de "transaccion" con pinta realista para el recibo simulado
function generarNumeroTransaccion() {
  const azar = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FN-${Date.now().toString().slice(-6)}-${azar}`;
}

const ETIQUETAS_METODO = { tarjeta: '💳 Tarjeta', transferencia: '🏦 Transferencia', efectivo: '💵 Efectivo al técnico' };

document.getElementById('formPago').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.querySelector('[data-error="pago"]');
  errorEl.textContent = '';
  const metodo = e.target.elements.metodo.value;

  if (metodo === 'tarjeta') {
    const numOk = numTarjetaInput.value.replace(/\s/g, '').length === 16;
    const expOk = /^\d{2}\/\d{2}$/.test(expTarjetaInput.value);
    const cvvOk = document.getElementById('cvvTarjeta').value.length === 3;
    if (!numOk || !expOk || !cvvOk) {
      errorEl.textContent = 'Revisa los datos de la tarjeta (son simulados, pero deben tener el formato correcto).';
      return;
    }
  }

  const btn = document.getElementById('btnPagar');
  btn.disabled = true;
  const textoOriginal = btn.textContent;
  btn.textContent = 'Procesando pago…';
  try {
    await new Promise((resolve) => setTimeout(resolve, 1100)); // simula el tiempo de procesamiento con el banco
    await api.pagarSolicitud(pagoSolicitudActual, metodo);

    // Arma el recibo con pinta de transaccion real (todo generado localmente, nada se cobra de verdad)
    document.getElementById('reciboMonto').textContent = document.getElementById('pagoMonto').textContent;
    document.getElementById('reciboTransaccion').textContent = generarNumeroTransaccion();
    document.getElementById('reciboTicket').textContent = document.getElementById('pagoTicketId').textContent;
    let metodoTexto = ETIQUETAS_METODO[metodo] || metodo;
    if (metodo === 'tarjeta') metodoTexto += ` •••• ${numTarjetaInput.value.replace(/\s/g, '').slice(-4)}`;
    document.getElementById('reciboMetodo').textContent = metodoTexto;
    document.getElementById('reciboFecha').textContent = new Date().toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' });

    document.getElementById('formPago').hidden = true;
    document.getElementById('reciboPago').hidden = false;
    toast('¡Pago registrado con éxito!');
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
});

// ---------- Valoracion ----------
let valorarSolicitudActual = null;
let valorarTecnicoActual = null;
let puntuacionSeleccionada = 0;

function abrirValorar(solicitudId, tecnicoId) {
  valorarSolicitudActual = solicitudId;
  valorarTecnicoActual = tecnicoId;
  puntuacionSeleccionada = 0;
  document.getElementById('valorarTicketId').textContent = `#${String(solicitudId).padStart(4, '0')}`;
  document.querySelector('[data-error="valorar"]').textContent = '';
  document.getElementById('formValorar').reset();
  pintarEstrellas(0);
  document.getElementById('valorarModal').hidden = false;
}
document.getElementById('valorarClose').addEventListener('click', () => {
  document.getElementById('valorarModal').hidden = true;
});

function pintarEstrellas(valor) {
  document.querySelectorAll('#estrellasInput .estrella').forEach((el) => {
    el.classList.toggle('estrella--activa', Number(el.dataset.valor) <= valor);
  });
}
document.querySelectorAll('#estrellasInput .estrella').forEach((el) => {
  el.addEventListener('click', () => {
    puntuacionSeleccionada = Number(el.dataset.valor);
    pintarEstrellas(puntuacionSeleccionada);
  });
});

document.getElementById('formValorar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.querySelector('[data-error="valorar"]');
  errorEl.textContent = '';
  if (puntuacionSeleccionada < 1) {
    errorEl.textContent = 'Selecciona al menos una estrella.';
    return;
  }
  const comentario = e.target.elements.comentario.value;
  try {
    await api.valorar({
      solicitud_id: valorarSolicitudActual,
      tecnico_id: valorarTecnicoActual,
      puntuacion: puntuacionSeleccionada,
      comentario,
    });
    document.getElementById('valorarModal').hidden = true;
    toast('¡Gracias por tu valoración!');
    cargarDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------- Service worker (PWA instalable) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ---------- Init ----------
pintarAuthArea();
renderBottomNav();
cargarCategorias();
mostrarVista('landing');
