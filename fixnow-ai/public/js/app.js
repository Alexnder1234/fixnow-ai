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
    cont.innerHTML = `<span class="topbar__usuario">${usuario.nombre.split(' ')[0]}</span> <button class="btn btn--ghost btn--small" id="btnLogout">Salir</button>`;
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
async function cargarDashboard() {
  const sub = document.getElementById('dashboardSub');
  const lista = document.getElementById('ticketList');
  const usuario = getUsuario();
  if (!usuario) {
    sub.textContent = 'Inicia sesión para ver tus solicitudes.';
    lista.innerHTML = '';
    return;
  }
  sub.textContent = usuario.tipo === 'tecnico' ? 'Trabajos que has aceptado.' : 'Tus solicitudes de servicio.';
  lista.innerHTML = '<p class="empty-state">Cargando…</p>';
  try {
    const solicitudes = await api.misSolicitudes();
    if (solicitudes.length === 0) {
      lista.innerHTML = '<p class="empty-state">Todavía no tienes tickets.</p>';
      return;
    }
    lista.innerHTML = solicitudes
      .map(
        (s) => `
      <div class="ticket-row">
        <div>
          <div class="ticket-row__id">Ticket #${String(s.id).padStart(4, '0')} · ${s.icono || '🔧'} ${s.categoria}</div>
          <div>${s.descripcion || ''}</div>
        </div>
        <div style="text-align:right; display:flex; flex-direction:column; gap:.4rem; align-items:flex-end;">
          <div class="estado-tag estado-${s.estado}">${s.estado.replace('_', ' ')}</div>
          <div class="ticket-row__id">RD$ ${Number(s.costo_estimado || 0).toLocaleString('es-DO')}</div>
          <button class="btn btn--ghost btn--small" data-chat="${s.id}">💬 Chat</button>
        </div>
      </div>`
      )
      .join('');
    lista.querySelectorAll('[data-chat]').forEach((btn) => {
      btn.addEventListener('click', () => abrirChat(btn.dataset.chat));
    });
  } catch (err) {
    lista.innerHTML = `<p class="empty-state">No se pudieron cargar tus tickets: ${err.message}</p>`;
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
