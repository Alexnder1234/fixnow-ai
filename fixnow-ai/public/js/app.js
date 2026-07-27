// ---------- Modo claro / oscuro ----------
function aplicarTema(tema) {
  if (tema === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('themeToggle').textContent = '☀️';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('themeToggle').textContent = '🌙';
  }
  localStorage.setItem('fixnow_tema', tema);
}
(function iniciarTema() {
  const guardado = localStorage.getItem('fixnow_tema');
  if (guardado) {
    aplicarTema(guardado);
  } else {
    const prefiereOscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    aplicarTema(prefiereOscuro ? 'dark' : 'light');
  }
})();
document.getElementById('themeToggle').addEventListener('click', () => {
  const actual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  aplicarTema(actual === 'dark' ? 'light' : 'dark');
});

// ---------- Navegación ----------
const vistas = document.querySelectorAll('.view');
let categoriasCache = [];
let favoritosIds = new Set();
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
      favoritosIds = new Set();
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
    activarPushNotificaciones();
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
    activarPushNotificaciones();
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

  const usuario = getUsuario();
  if (usuario && usuario.tipo === 'cliente') {
    const favBtn = document.createElement('button');
    favBtn.className = 'chip';
    favBtn.dataset.chipFavoritos = '1';
    favBtn.textContent = '⭐ Favoritos';
    favBtn.addEventListener('click', () => {
      document.querySelectorAll('#filtroCategorias .chip').forEach((x) => x.classList.remove('chip--active'));
      favBtn.classList.add('chip--active');
      cargarFavoritos();
    });
    filtroCont.appendChild(favBtn);
  }

  return categoriasCache;
}

// Agrega o quita el chip de "Favoritos" segun quien tenga la sesion iniciada
// en este momento (categoriasCache solo se carga una vez, pero la sesion
// puede cambiar de cliente a tecnico o cerrar sesion durante la misma visita).
function sincronizarChipFavoritos() {
  const filtroCont = document.getElementById('filtroCategorias');
  const existente = filtroCont.querySelector('[data-chip-favoritos]');
  const usuario = getUsuario();
  if (usuario && usuario.tipo === 'cliente') {
    if (!existente) {
      const favBtn = document.createElement('button');
      favBtn.className = 'chip';
      favBtn.dataset.chipFavoritos = '1';
      favBtn.textContent = '⭐ Favoritos';
      favBtn.addEventListener('click', () => {
        document.querySelectorAll('#filtroCategorias .chip').forEach((x) => x.classList.remove('chip--active'));
        favBtn.classList.add('chip--active');
        cargarFavoritos();
      });
      filtroCont.appendChild(favBtn);
    }
  } else if (existente) {
    existente.remove();
  }
}

function tecnicoCardHTML(t) {
  const esFav = favoritosIds.has(Number(t.id));
  const usuario = getUsuario();
  const mostrarFav = usuario && usuario.tipo === 'cliente';
  const cats = t.categorias || [];
  const iconos = cats.map((c) => c.icono).join(' ') || '🔧';
  const nombresCats = cats.map((c) => c.nombre).join(' · ') || 'Sin categoría';
  return `
      <div class="tecnico-card" data-id="${t.id}">
        ${mostrarFav ? `<button class="fav-btn ${esFav ? 'fav-btn--activo' : ''}" data-fav="${t.id}" title="Marcar favorito">${esFav ? '♥' : '♡'}</button>` : ''}
        ${t.es_premium ? '<span class="premium-badge">★ PREMIUM</span>' : ''}
        <span class="tecnico-card__cat">${iconos}</span>
        <span class="tecnico-card__nombre">${t.nombre}</span>
        <span class="tecnico-card__meta">${nombresCats} · ${t.ubicacion || 'Ubicación no indicada'}</span>
        <span class="tecnico-card__rating">★ ${Number(t.calificacion_promedio || 0).toFixed(1)} (${t.total_valoraciones || 0})</span>
      </div>`;
}

function activarTarjetasTecnico(grid) {
  grid.querySelectorAll('.tecnico-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.fav-btn')) return; // el corazon no debe abrir el perfil
      verPerfil(card.dataset.id);
    });
  });
  grid.querySelectorAll('.fav-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const { es_favorito } = await api.alternarFavorito(btn.dataset.fav);
        if (es_favorito) {
          favoritosIds.add(Number(btn.dataset.fav));
          btn.classList.add('fav-btn--activo');
          btn.textContent = '♥';
        } else {
          favoritosIds.delete(Number(btn.dataset.fav));
          btn.classList.remove('fav-btn--activo');
          btn.textContent = '♡';
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

async function cargarIdsFavoritos() {
  const usuario = getUsuario();
  if (!usuario || usuario.tipo !== 'cliente') return;
  try {
    const ids = await api.idsFavoritos();
    favoritosIds = new Set(ids.map(Number));
  } catch (err) {
    /* si falla, simplemente no se marcan corazones activos */
  }
}

// ---------- Buscar técnicos ----------
async function cargarTecnicos(categoria = '') {
  const grid = document.getElementById('tecnicoGrid');
  grid.innerHTML = '<p class="empty-state">Cargando técnicos…</p>';
  await cargarCategorias();
  sincronizarChipFavoritos();
  await cargarIdsFavoritos();
  try {
    const tecnicos = await api.tecnicos(categoria);
    if (tecnicos.length === 0) {
      grid.innerHTML = '<p class="empty-state">Todavía no hay técnicos registrados en esta categoría.</p>';
      return;
    }
    grid.innerHTML = tecnicos.map(tecnicoCardHTML).join('');
    activarTarjetasTecnico(grid);
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">No se pudieron cargar los técnicos: ${err.message}</p>`;
  }
}

async function cargarFavoritos() {
  const grid = document.getElementById('tecnicoGrid');
  grid.innerHTML = '<p class="empty-state">Cargando tus favoritos…</p>';
  await cargarIdsFavoritos();
  try {
    const tecnicos = await api.misFavoritos();
    if (tecnicos.length === 0) {
      grid.innerHTML = '<p class="empty-state">Todavía no tienes técnicos favoritos — toca el corazón de cualquier tarjeta para guardarlo aquí.</p>';
      return;
    }
    grid.innerHTML = tecnicos.map(tecnicoCardHTML).join('');
    activarTarjetasTecnico(grid);
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">No se pudieron cargar tus favoritos: ${err.message}</p>`;
  }
}

async function verPerfil(id) {
  mostrarVista('perfil');
  const cont = document.getElementById('perfilContenido');
  cont.innerHTML = '<p class="empty-state">Cargando perfil…</p>';
  const usuario = getUsuario();
  if (usuario && usuario.tipo === 'cliente') await cargarIdsFavoritos();
  try {
    const perfil = await api.tecnico(id);
    const esFav = favoritosIds.has(Number(id));
    cont.innerHTML = `
      <div class="perfil-card">
        <div class="perfil-card__head">
          <div>
            <h2>${perfil.nombre}</h2>
            <p class="section-sub">${(perfil.categorias || []).map((c) => `${c.icono} ${c.nombre}`).join(' · ') || 'Sin categoría'} · ${perfil.ubicacion || ''}</p>
          </div>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="tecnico-card__rating">★ ${Number(perfil.calificacion_promedio || 0).toFixed(1)} (${perfil.total_valoraciones || 0} valoraciones)</span>
            ${usuario && usuario.tipo === 'cliente' ? `<button class="fav-btn ${esFav ? 'fav-btn--activo' : ''}" data-fav="${id}" style="position:static; font-size:1.6rem;" title="Marcar favorito">${esFav ? '♥' : '♡'}</button>` : ''}
          </div>
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
    const favBtn = cont.querySelector('.fav-btn');
    if (favBtn) {
      favBtn.addEventListener('click', async () => {
        try {
          const { es_favorito } = await api.alternarFavorito(id);
          favBtn.classList.toggle('fav-btn--activo', es_favorito);
          favBtn.textContent = es_favorito ? '♥' : '♡';
          if (es_favorito) favoritosIds.add(Number(id));
          else favoritosIds.delete(Number(id));
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }
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

  const cont = document.getElementById('categoriasPerfilChecks');
  let categoriasActuales = [];
  try {
    const perfilPropio = await api.tecnico(usuario.id);
    categoriasActuales = (perfilPropio.categorias || []).map((c) => c.id);
  } catch (err) {
    /* si todavia no tiene perfil creado, simplemente no hay nada que pre-marcar */
  }

  cont.innerHTML = categoriasCache
    .map(
      (c) => `<label class="tipo-toggle__opt">
        <input type="checkbox" name="categoria_ids" value="${c.id}" ${categoriasActuales.includes(c.id) ? 'checked' : ''} />
        <span>${c.icono} ${c.nombre}</span>
      </label>`
    )
    .join('');

  cargarEstadisticas();
  cargarMisValoraciones();
}

async function cargarMisValoraciones() {
  const cont = document.getElementById('misValoraciones');
  const usuario = getUsuario();
  cont.innerHTML = '<p class="empty-state">Cargando…</p>';
  try {
    const perfil = await api.tecnico(usuario.id);
    const cats = (perfil.categorias || []).map((c) => `${c.icono} ${c.nombre}`).join(' · ');
    cont.innerHTML = `
      <div class="perfil-card">
        <div class="perfil-card__head">
          <div>
            <p class="section-sub" style="margin:0;">${cats || 'Todavía no elegiste categorías'}</p>
          </div>
          <span class="tecnico-card__rating">★ ${Number(perfil.calificacion_promedio || 0).toFixed(1)} (${perfil.total_valoraciones || 0} valoraciones)</span>
        </div>
        ${
          perfil.valoraciones.length === 0
            ? '<p class="empty-state">Aún no tienes valoraciones — cuando completes servicios, aparecerán aquí.</p>'
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
    cont.innerHTML = `<p class="empty-state">No se pudieron cargar tus valoraciones: ${err.message}</p>`;
  }
}

const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

async function cargarEstadisticas() {
  const cont = document.getElementById('estadisticasTecnico');
  cont.innerHTML = '<p class="empty-state">Cargando estadísticas…</p>';
  try {
    const e = await api.estadisticas();
    const ingresoTotal = Number(e.ingreso_cobrado) + Number(e.ingreso_pendiente);
    const maxCompletados = Math.max(1, ...e.por_mes.map((m) => Number(m.completados)));

    cont.innerHTML = `
      <div class="estadisticas-grid">
        <div class="estadistica-card">
          <div class="estadistica-card__valor">${e.total_completados}</div>
          <div class="estadistica-card__label">Servicios completados</div>
        </div>
        <div class="estadistica-card">
          <div class="estadistica-card__valor">${e.total_activos}</div>
          <div class="estadistica-card__label">Trabajos activos</div>
        </div>
        <div class="estadistica-card">
          <div class="estadistica-card__valor">★ ${Number(e.calificacion_promedio || 0).toFixed(1)}</div>
          <div class="estadistica-card__label">${e.total_valoraciones} valoraciones</div>
        </div>
        <div class="estadistica-card">
          <div class="estadistica-card__valor">RD$ ${Number(e.ingreso_neto_tecnico).toLocaleString('es-DO')}</div>
          <div class="estadistica-card__label">Recibido neto (ya descontada la comisión)</div>
        </div>
      </div>
      <p class="section-sub" style="margin-bottom:0.75rem;">
        De RD$ ${Number(e.ingreso_cobrado).toLocaleString('es-DO')} cobrado, FixNow AI retuvo
        RD$ ${Number(e.comision_plataforma).toLocaleString('es-DO')} de comisión (12%) ·
        RD$ ${Number(e.ingreso_pendiente).toLocaleString('es-DO')} todavía sin pagar de RD$ ${ingresoTotal.toLocaleString('es-DO')} facturado.
      </p>
      <p class="section-sub" style="margin-bottom:0.75rem;">Servicios completados por mes (últimos 6 meses)</p>
      <div class="grafico-meses">
        ${
          e.por_mes.length === 0
            ? '<p class="empty-state">Todavía no tienes servicios completados en este periodo.</p>'
            : e.por_mes
                .map((m) => {
                  const [anio, mes] = m.mes.split('-');
                  const alturaPct = Math.max(6, (Number(m.completados) / maxCompletados) * 100);
                  return `<div class="grafico-mes">
                    <div class="grafico-mes__barra" style="height:${alturaPct}%;" title="${m.completados} completados"></div>
                    <div class="grafico-mes__label">${NOMBRES_MES[Number(mes) - 1]}</div>
                  </div>`;
                })
                .join('')
        }
      </div>`;

    renderPanelPremium(e);
  } catch (err) {
    cont.innerHTML = `<p class="empty-state">No se pudieron cargar tus estadísticas: ${err.message}</p>`;
  }
}

function renderPanelPremium(e) {
  const cont = document.getElementById('premiumTecnico');
  if (e.es_premium) {
    const hasta = e.premium_hasta ? new Date(e.premium_hasta).toLocaleDateString('es-DO') : '—';
    cont.innerHTML = `
      <div class="premium-panel">
        <span class="premium-badge" style="position:static;">★ PREMIUM ACTIVO</span>
        <p class="premium-panel__estado">Vigente hasta el ${hasta}</p>
        <p class="section-sub" style="margin:0;">Ya apareces primero en las búsquedas de tus categorías.</p>
        <button class="btn btn--ghost btn--small" id="btnRenovarPremium">Renovar 30 días más — RD$500</button>
      </div>`;
  } else {
    cont.innerHTML = `
      <div class="premium-panel">
        <span class="premium-panel__precio">RD$ 500<span style="font-size:0.9rem; color:var(--ink-soft);">/mes</span></span>
        <p class="section-sub" style="margin:0;">Aparece primero en los resultados de búsqueda de tus categorías y destaca con una insignia ★ PREMIUM frente a tus clientes.</p>
        <button class="btn btn--amber btn--small" id="btnRenovarPremium">Hazte Premium</button>
        <p class="pago-nota">🔒 Suscripción simulada para fines de demostración académica.</p>
      </div>`;
  }
  document.getElementById('btnRenovarPremium').addEventListener('click', async (ev) => {
    const btn = ev.target;
    btn.disabled = true;
    try {
      await api.suscribirPremium();
      toast('¡Listo! Tu plan Premium está activo.');
      cargarEstadisticas();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

document.getElementById('formPerfilTecnico').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.querySelector('[data-error="perfilTecnico"]');
  const okEl = document.querySelector('[data-ok="perfilTecnico"]');
  errorEl.textContent = '';
  okEl.textContent = '';
  const datos = Object.fromEntries(new FormData(e.target));
  const categoriaIds = Array.from(e.target.querySelectorAll('input[name="categoria_ids"]:checked')).map((el) => Number(el.value));
  if (categoriaIds.length === 0) {
    errorEl.textContent = 'Selecciona al menos una categoría.';
    return;
  }
  try {
    await api.guardarPerfilTecnico({
      categoria_ids: categoriaIds,
      descripcion: datos.descripcion,
      anos_experiencia: Number(datos.anos_experiencia) || 0,
    });
    okEl.textContent = '¡Perfil guardado! Ya apareces en la búsqueda de tus categorías.';
    toast('Perfil profesional guardado');
    cargarMisValoraciones();
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

let ticketsCache = [];
let filtroEstadoActual = '';

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
    ticketsCache = await api.misSolicitudes();
    renderTicketsFiltrados();
  } catch (err) {
    lista.innerHTML = `<p class="empty-state">No se pudieron cargar tus tickets: ${err.message}</p>`;
  }
}

function renderTicketsFiltrados() {
  const lista = document.getElementById('ticketList');
  const usuario = getUsuario();
  if (!usuario) return;

  const texto = (document.getElementById('buscarTickets').value || '').trim().toLowerCase();
  let filtrados = ticketsCache;
  if (filtroEstadoActual) filtrados = filtrados.filter((s) => s.estado === filtroEstadoActual);
  if (texto) {
    filtrados = filtrados.filter(
      (s) => (s.descripcion || '').toLowerCase().includes(texto) || (s.categoria || '').toLowerCase().includes(texto)
    );
  }

  if (ticketsCache.length === 0) {
    lista.innerHTML = '<p class="empty-state">Todavía no tienes tickets.</p>';
    return;
  }
  if (filtrados.length === 0) {
    lista.innerHTML = '<p class="empty-state">Ningún ticket coincide con ese filtro.</p>';
    return;
  }

  lista.innerHTML = filtrados.map((s) => filaTicket(s, usuario)).join('');

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
}

document.getElementById('buscarTickets').addEventListener('input', () => renderTicketsFiltrados());
document.querySelectorAll('#filtroEstado .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#filtroEstado .chip').forEach((c) => c.classList.remove('chip--active'));
    chip.classList.add('chip--active');
    filtroEstadoActual = chip.dataset.estado || '';
    renderTicketsFiltrados();
  });
});

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

let pagoTicketActual = null;
function abrirPago(solicitudId, monto) {
  pagoSolicitudActual = solicitudId;
  pagoTicketActual = ticketsCache.find((t) => String(t.id) === String(solicitudId)) || null;
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
    document.getElementById('reciboServicio').textContent = pagoTicketActual
      ? `${pagoTicketActual.icono || '🔧'} ${pagoTicketActual.categoria || ''}`
      : '—';
    const descripcionEl = document.getElementById('reciboDescripcion');
    if (pagoTicketActual && pagoTicketActual.descripcion) {
      descripcionEl.textContent = `“${pagoTicketActual.descripcion}”`;
      descripcionEl.hidden = false;
    } else {
      descripcionEl.hidden = true;
    }
    let metodoTexto = ETIQUETAS_METODO[metodo] || metodo;
    if (metodo === 'tarjeta') metodoTexto += ` •••• ${numTarjetaInput.value.replace(/\s/g, '').slice(-4)}`;
    document.getElementById('reciboMetodo').textContent = metodoTexto;
    document.getElementById('reciboFecha').textContent = new Date().toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' });

    const montoNum = Number(pagoTicketActual?.costo_estimado || 0);
    const comision = Math.round(montoNum * 0.12);
    document.getElementById('reciboComision').textContent =
      `Técnico recibe RD$ ${(montoNum - comision).toLocaleString('es-DO')} (88%) · Comisión FixNow AI RD$ ${comision.toLocaleString('es-DO')} (12%)`;

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
let swRegistrationLista = null;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registro) => {
        swRegistrationLista = registro;
        // Si ya habia una sesion abierta al cargar la pagina, intenta activar
        // las notificaciones push sin volver a pedir permiso si ya se habia dado.
        if (getUsuario()) activarPushNotificaciones();
      })
      .catch(() => {});
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Activa las notificaciones push reales (avisos aunque la app este cerrada).
// Pide permiso solo si el usuario no lo ha decidido todavia; si ya lo
// denego antes, no insiste (el navegador no deja volver a preguntar,
// el usuario tendria que habilitarlo el mismo desde los ajustes del sitio).
async function activarPushNotificaciones() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;

  try {
    const { habilitado, llave_publica } = await api.vapidPublicKey();
    if (!habilitado) return; // el servidor no tiene las llaves VAPID configuradas

    if (Notification.permission === 'default') {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') return;
    }
    if (Notification.permission !== 'granted') return;

    const registro = swRegistrationLista || (await navigator.serviceWorker.ready);
    let suscripcion = await registro.pushManager.getSubscription();
    if (!suscripcion) {
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(llave_publica),
      });
    }
    await api.suscribirPush(suscripcion.toJSON());
  } catch (err) {
    console.warn('No se pudo activar las notificaciones push:', err.message);
  }
}

// ---------- Init ----------
pintarAuthArea();
renderBottomNav();
cargarCategorias();
mostrarVista('landing');
