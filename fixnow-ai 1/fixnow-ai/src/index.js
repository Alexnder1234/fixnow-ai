const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRouter = require('./routes/auth');
const tecnicosRouter = require('./routes/tecnicos');
const categoriasRouter = require('./routes/categorias');
const solicitudesRouter = require('./routes/solicitudes');
const valoracionesRouter = require('./routes/valoraciones');
const mensajesRouter = require('./routes/mensajes');
const notificacionesRouter = require('./routes/notificaciones');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Frontend estatico
app.use(express.static(path.join(__dirname, '..', 'public')));

// API
app.use('/api/auth', authRouter);
app.use('/api/tecnicos', tecnicosRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/solicitudes', solicitudesRouter);
app.use('/api/valoraciones', valoracionesRouter);
app.use('/api/mensajes', mensajesRouter);
app.use('/api/notificaciones', notificacionesRouter);

app.get('/api/salud', (req, res) => {
  res.json({ estado: 'ok', mensaje: 'FixNow AI API funcionando correctamente' });
});

app.listen(PORT, () => {
  console.log(`Servidor FixNow AI corriendo en el puerto ${PORT}`);
});
