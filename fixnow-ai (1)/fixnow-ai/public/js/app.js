// ---------- Navegación ----------
const vistas = document.querySelectorAll('.view');
let categoriasCache = [];

function mostrarVista(nombre) {
  vistas.forEach((v) => v.classList.toggle('view--active', v.dataset.view === nombre));
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (nombre === 'buscar') cargarTecnicos();
  if (nombre === 'solicitar') prepararFormSolicitud();
  if (nombre === 'dashboard') cargarDashboard();
  if (nombre === 'registro-cliente' || nombre === 'registro-tecnico') {
    mostrarVista('auth');
    activarTabAuth('registro');
    const tipoDeseado = nombre === 'registro-tecnico' ? 'tecnico' : 'cliente';
    const radio = document.querySelector(`#formRegistro input[name="tipo"][value="${tipoDeseado}"]`);
    if (radio) radio.checked = true;
  }
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
    cont.innerHTML = `<span>${usuario.nombre.split(' ')[0]} · ${usuario.tipo}</span> <button class="btn btn--ghost btn--small" id="btnLogout">Salir</button>`;
    document.getElementById('btnLogout').addEventListener('click', () => {
      limpiarSesion();
      pintarAuthArea();
      toast('Sesión cerrada');
      mostrarVista('landing');
    });
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
    toast(`Cuenta creada. ¡Bienvenido, ${usuario.nombre.split(' ')[0]}!`);
    mostrarVista(usuario.tipo === 'tecnico' ? 'dashboard' : 'solicitar');
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------- Categorías (hero + filtros + formulario) ----------
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
  if (!getToken()) {
    errorEl.textContent = 'Debes iniciar sesión para solicitar un servicio.';
    mostrarVista('auth');
    return;
  }
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

// ---------- Dashboard ----------
async function cargarDashboard() {
  const sub = document.getElementById('dashboardSub');
  const lista = document.getElementById('ticketList');
  const usuario = getUsuario();
  if (!usuario) {
    sub.textContent = 'Inicia sesión para ver tus solicitudes.';
    lista.innerHTML = '';
    return;
  }
  sub.textContent = usuario.tipo === 'tecnico' ? 'Trabajos que te han asignado.' : 'Tus solicitudes de servicio.';
  lista.innerHTML = '<p class="empty-state">Cargando…</p>';
  try {
    const solicitudes = await api.misSolicitudes();
    if (solicitudes.length === 0) {
      lista.innerHTML = '<p class="empty-state">Todavía no tienes tickets. Crea una solicitud para empezar.</p>';
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
        <div style="text-align:right;">
          <div class="estado-tag estado-${s.estado}">${s.estado.replace('_', ' ')}</div>
          <div class="ticket-row__id">RD$ ${Number(s.costo_estimado || 0).toLocaleString('es-DO')}</div>
        </div>
      </div>`
      )
      .join('');
  } catch (err) {
    lista.innerHTML = `<p class="empty-state">No se pudieron cargar tus tickets: ${err.message}</p>`;
  }
}

// ---------- Init ----------
pintarAuthArea();
cargarCategorias();
mostrarVista('landing');
