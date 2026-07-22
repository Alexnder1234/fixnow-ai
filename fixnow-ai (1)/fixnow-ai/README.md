# FixNow AI

Plataforma marketplace de servicios técnicos con IA que conecta clientes con técnicos calificados en electricidad, cámaras de seguridad, refrigeración, plomería y mantenimiento general.

**Autor:** Alexander Guzman Vasquez
**Eslogan:** "Soluciones rápidas, técnicos confiables."

## Qué incluye este proyecto

**Backend (Node.js + Express + PostgreSQL)**
- Autenticación con JWT (registro/login)
- Búsqueda de técnicos por categoría y perfil con valoraciones
- Creación de perfil profesional para técnicos
- Solicitudes de servicio con ubicación, foto y urgencia
- Estimación de costo automática (heurística v1 — ver nota abajo)
- Aceptar solicitudes (técnico)
- Valoraciones de clientes hacia técnicos
- Chat por solicitud (mensajes)
- Notificaciones

**Frontend (HTML/CSS/JS sin frameworks, servido por el mismo backend)**
- Landing, login/registro, búsqueda de técnicos, perfil con valoraciones,
  formulario de solicitud con estimación de costo en tiempo real, y
  dashboard de "mis tickets".

### Nota sobre la IA de estimación de costos
`src/services/estimador.js` usa por ahora una **regla heurística transparente**
(categoría + urgencia + longitud de la descripción), no un modelo de IA entrenado.
Está aislada en una sola función para que, cuando tengas un modelo real
(por ejemplo, clasificando la descripción y las fotos), solo tengas que
reemplazar esa función — el resto de la app no cambia.

## Historias de usuario cubiertas

| ID | Historia | Estado |
|----|----------|--------|
| US-01 | Registrarse | ✅ |
| US-02 | Buscar técnicos por categoría | ✅ |
| US-03 | Ver perfiles y valoraciones | ✅ |
| US-04 | Solicitar servicio con ubicación | ✅ |
| US-05 | Estimación de costo por IA | ✅ (heurística v1) |
| US-06 | Crear perfil profesional (técnico) | ✅ |
| US-07 | Notificaciones de nuevos trabajos | ✅ (backend listo, falta activarlo en el frontend) |
| US-08 | Chat cliente-técnico | ✅ (backend listo, falta interfaz de chat) |
| US-09 | Subir foto del problema | ✅ (como URL; falta subida real de archivos) |
| US-10 | Pagos in-app | ⏳ Pendiente |
| US-11 | Programar servicios a futuro | ✅ (campo fecha_programada) |
| US-12 | Estadísticas del técnico | ⏳ Pendiente |

## Estructura del proyecto

```
fixnow-ai/
├── public/                 # Frontend estático
│   ├── index.html
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

1. Crea un repositorio nuevo en https://github.com/new (por ejemplo `fixnow-ai`), sin marcar "Initialize with README".
2. Dentro de la carpeta `fixnow-ai`, ejecuta:

```bash
git init
git add .
git commit -m "FixNow AI - version inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/fixnow-ai.git
git push -u origin main
```

## Paso 2: Crear la base de datos en Railway

1. Entra a https://railway.app y crea una cuenta (puedes usar tu cuenta de GitHub).
2. **New Project** → **Provision PostgreSQL**.
3. Servicio de PostgreSQL → pestaña **Variables** → copia `DATABASE_URL`.
4. En tu proyecto local, copia `.env.example` a `.env` y pega ese valor en `DATABASE_URL`.

## Paso 3: Crear las tablas

- Desde Railway: servicio de PostgreSQL → pestaña **Query** → pega el contenido de `src/db/schema.sql` y ejecútalo.
- O desde tu computadora:

```bash
psql "$DATABASE_URL" -f src/db/schema.sql
```

## Paso 4: (Opcional) Desplegar el backend también en Railway

1. En el mismo proyecto de Railway: **New** → **GitHub Repo** → selecciona `fixnow-ai`.
2. Railway detecta Node.js y usa `npm start`.
3. En **Variables** del servicio del backend agrega `DATABASE_URL` (puedes referenciarla con `${{Postgres.DATABASE_URL}}`) y `JWT_SECRET`.

## Correr el proyecto localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` — ahí sirve tanto la interfaz como la API (`/api/...`).

## Pendiente para una siguiente iteración

- Subida real de archivos (fotos) en vez de URL
- Interfaz de chat y notificaciones en el frontend (el backend ya las soporta)
- Pagos in-app (US-10) y estadísticas del técnico (US-12)
- Reemplazar la heurística de `estimador.js` por un modelo de IA real
