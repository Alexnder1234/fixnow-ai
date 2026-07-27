# FixNow AI

Plataforma marketplace de servicios técnicos con IA que conecta clientes con técnicos calificados en electricidad, cámaras de seguridad, refrigeración, plomería y mantenimiento general.

**Autor:** Alexander Guzman Vasquez
**Eslogan:** "Soluciones rápidas, técnicos confiables."

## Qué incluye este proyecto

**App web instalable en el celular (PWA)**
- Se abre desde el navegador del teléfono y se puede "instalar" en la pantalla de inicio
  (ícono propio, pantalla completa, sin barra del navegador).
- Barra de navegación inferior fija, como una app nativa.
- Formularios y botones pensados para dedo, no para mouse (campos grandes, sin zoom accidental de iOS).

**Backend (Node.js + Express + PostgreSQL)**
- Autenticación con JWT (registro/login)
- Búsqueda de técnicos por categoría y perfil con valoraciones
- Creación/edición de perfil profesional para técnicos
- Solicitudes de servicio con ubicación, foto y urgencia
- Estimación de costo automática (heurística v1 — ver nota abajo)
- **Bandeja de trabajos disponibles para técnicos, con botón para aceptar** (antes solo existía en el backend, sin pantalla)
- Valoraciones de clientes hacia técnicos
- Chat por solicitud, con interfaz de mensajes
- Notificaciones con contador de no leídas

## 🛠️ Varias habilidades por técnico + ver tu propio perfil

- **Un técnico ya puede elegir varias categorías** (ej. Electricidad + Mantenimiento general a la vez), no solo una — se marca con checkboxes en "Mi perfil". Aparece en la búsqueda de cada una de sus categorías, y "Trabajos disponibles" le muestra solicitudes de cualquiera de ellas.
- **"Cómo me ven mis clientes"** — nueva sección dentro de "Mi perfil" donde el técnico ve su calificación promedio y cada comentario que le han dejado, igual que lo ve un cliente que visita su perfil público.
- **Descripción del servicio en el recibo de pago** — el recibo (y el PDF/impresión) ahora muestra también la categoría y la descripción del problema que se pagó, no solo el monto.

### Si ya tenías la base de datos creada antes de este cambio
Corre también `src/db/migracion_multicategoria.sql` una vez en la consola Query de Railway — crea la tabla nueva y traslada automáticamente la categoría que cada técnico ya tenía guardada, para que nadie la pierda. Si vas a crear la base de datos desde cero, no hace falta: `schema.sql` ya la incluye.

## 🎨 Mejoras de producto (para que no se sienta "básica")

- **Modo oscuro/claro** — botón 🌙/☀️ en la barra superior, recuerda tu preferencia y respeta el modo del sistema operativo la primera vez.
- **Favoritos de técnicos** — corazón en cada tarjeta de técnico y en su perfil; chip "⭐ Favoritos" en Buscar para verlos todos juntos.
- **Filtros y búsqueda en "Mis tickets"** — buscador por texto + chips por estado (pendiente/aceptada/en proceso/completada/cancelada).
- **Estadísticas del técnico (US-12)** — en "Mi perfil": total completados, trabajos activos, calificación, ingreso cobrado vs. facturado, y un gráfico de servicios completados por mes.

### Si ya tenías la base de datos creada antes de este cambio
Corre también `src/db/migracion_favoritos.sql` una vez en la consola Query de Railway. Si vas a crear la base de datos desde cero, no hace falta: `schema.sql` ya la incluye.

## 🔔 Notificaciones push reales (avisos aunque la app esté cerrada)

Además de las notificaciones dentro de la app, ahora hay **push real**: al
aceptar/completar un ticket o recibir un mensaje de chat, el otro usuario
recibe un aviso del sistema operativo, incluso con el navegador cerrado
(igual que cualquier app instalada).

**Ya viene un par de llaves VAPID generadas y listas para usar** en
`.env.example` — no tienes que generar las tuyas salvo que quieras.

### Para que funcione en Railway (importante)
`.env` nunca se sube a GitHub (está en `.gitignore`), así que Railway no lo
ve — hay que agregar estas 3 variables **a mano** en Railway:

1. Servicio del backend (`fixnow-ai`) → pestaña **Variables** → **+ New Variable**, agrega una por una:
   - `VAPID_PUBLIC_KEY` (copia el valor de `.env.example`)
   - `VAPID_PRIVATE_KEY` (copia el valor de `.env.example`)
   - `VAPID_EMAIL` (puede quedar el mismo valor de ejemplo)
2. Corre también `src/db/migracion_push.sql` una vez en la consola Query de tu Postgres (crea la tabla `push_suscripciones`). Si vas a crear la base de datos desde cero, no hace falta: `schema.sql` ya la incluye.
3. Redeploy.

### Cómo se activa para cada usuario
Al iniciar sesión o registrarse, el navegador pide permiso de notificaciones
(el popup normal de "¿Permitir notificaciones?"). Si el usuario acepta,
queda suscrito. Si lo rechaza, el navegador no vuelve a preguntar — tendría
que habilitarlo él mismo desde la configuración del sitio.

**Limitación conocida de iPhone:** en iOS, las notificaciones push web solo
funcionan si la persona "instaló" la app (Agregar a pantalla de inicio) —
Safari no las permite si solo la tienes abierta como una pestaña normal.
En Android/Chrome funcionan sin necesidad de instalarla.

## Correcciones recientes (revisión de seguridad y estabilidad)

- **Seguridad**: cualquier usuario logueado podía leer los mensajes de chat de
  cualquier ticket ajeno adivinando el número. Ya se valida que solo el
  cliente y el técnico de ese ticket puedan ver o escribir sus mensajes.
- **Notificaciones de chat**: enviar un mensaje ahora genera una notificación
  para la otra persona del ticket (antes el chat no avisaba a nadie).
- **Service worker (PWA)**: cambiaba a estrategia "caché primero", lo que
  hacía que actualizaciones ya subidas al servidor no se vieran hasta borrar
  el caché del navegador a mano. Ahora es "red primero" — siempre busca lo
  más reciente y solo usa la copia guardada si no hay conexión.

### ⚠️ Importante sobre el pago (US-10)
El botón "Pagar" dentro de un ticket **simula** el pago — no está conectado a
Stripe, Azul, ni ningún procesador real, y no mueve dinero de verdad. Guarda
el método elegido y la fecha en la base de datos para completar el flujo de
la app (útil para la demo/presentación), pero para una versión real de
producción habría que integrar un procesador de pagos certificado (esto
requiere una cuenta comercial verificada, algo fuera del alcance de un
proyecto académico). El código lo deja bien señalado con un comentario
en `src/routes/solicitudes.js`.

### Si ya tenías la base de datos creada antes de este cambio
Corre además `src/db/migracion_pagos.sql` una sola vez en la consola Query
de Railway (agrega las columnas de pago a la tabla `solicitudes`). Si vas a
crear la base de datos desde cero, no hace falta: `schema.sql` ya las incluye.

### Nota sobre la IA de estimación de costos
`src/services/estimador.js` usa por ahora una **regla heurística transparente**
(categoría + urgencia + longitud de la descripción), no un modelo de IA entrenado.
Está aislada en una sola función para que, cuando tengas un modelo real, solo
tengas que reemplazar esa función — el resto de la app no cambia.

## Historias de usuario cubiertas

| ID | Historia | Estado |
|----|----------|--------|
| US-01 | Registrarse | ✅ |
| US-02 | Buscar técnicos por categoría | ✅ |
| US-03 | Ver perfiles y valoraciones | ✅ |
| US-04 | Solicitar servicio con ubicación | ✅ |
| US-05 | Estimación de costo por IA | ✅ (heurística v1) |
| US-06 | Crear perfil profesional (técnico) | ✅ con interfaz |
| US-07 | Notificaciones + ver/aceptar trabajos disponibles | ✅ con interfaz |
| US-08 | Chat cliente-técnico | ✅ con interfaz |
| US-09 | Subir foto del problema | ✅ (como URL; falta subida real de archivos) |
| US-10 | Pagos in-app (simulado) | ✅ con interfaz — ver nota de seguridad abajo |
| US-11 | Programar servicios a futuro | ✅ (campo fecha_programada) |
| US-12 | Estadísticas del técnico | ⏳ Pendiente |
| — | Ciclo completo del servicio (iniciar → finalizar → pagar → valorar) | ✅ con interfaz |

## Estructura del proyecto

```
fixnow-ai/
├── public/                 # Frontend estático (PWA)
│   ├── index.html
│   ├── manifest.json        # Metadatos para instalar la app
│   ├── sw.js                 # Service worker (cache + instalable)
│   ├── icons/                 # Íconos de la app
│   ├── css/style.css
│   └── js/{api.js, app.js}
├── src/
│   ├── index.js            # Punto de entrada del servidor
│   ├── db/{pool.js, schema.sql}
│   ├── middleware/auth.js
│   ├── services/estimador.js
│   └── routes/{auth,tecnicos,categorias,solicitudes,valoraciones,mensajes,notificaciones}.js
├── package.json
├── .env.example
└── .gitignore
```

## Paso 1: Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "FixNow AI - version movil (PWA)"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/fixnow-ai.git
git push -u origin main
```

## Paso 2: Base de datos en Railway

1. https://railway.app → **New Project** → **Provision PostgreSQL**.
2. Servicio de PostgreSQL → pestaña **Variables** → copia `DATABASE_URL`.
3. Copia `.env.example` a `.env` y pega ese valor en `DATABASE_URL`.
4. Corre `src/db/schema.sql` contra esa base (pestaña **Query** en Railway, o `psql "$DATABASE_URL" -f src/db/schema.sql`).

## Paso 3: Desplegar el backend en Railway

1. En el proyecto de Railway: **New** → **GitHub Repo** → selecciona `fixnow-ai`.
2. Si el repo no está en la raíz, configura **Root Directory** en Settings → Source.
3. Variables del servicio: `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`, y `JWT_SECRET` con cualquier texto largo.
4. Settings → Networking → **Generate Domain** para obtener el link público.

## Correr el proyecto localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` en el navegador de tu celular (misma red WiFi que tu computadora) para probarlo como app móvil, o usa el link público de Railway una vez desplegado.

### Cómo "instalarla" en el celular
- **Android (Chrome):** menú (⋮) → "Instalar aplicación" o "Agregar a pantalla de inicio".
- **iPhone (Safari):** botón compartir (□↑) → "Agregar a pantalla de inicio".

## Pendiente para una siguiente iteración

- Subida real de archivos (fotos) en vez de URL
- Pagos in-app (US-10) y estadísticas del técnico (US-12)
- Reemplazar la heurística de `estimador.js` por un modelo de IA real
- Notificaciones push reales (hoy se revisan dentro de la app, no llegan al celular fuera de ella)
