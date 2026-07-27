const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const router = express.Router();

// US-01: Como usuario, quiero registrarme para poder solicitar servicios.
router.post('/registro', async (req, res) => {
  const { nombre, email, password, tipo, telefono, ubicacion } = req.body;

  if (!nombre || !email || !password || !tipo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  if (!['cliente', 'tecnico'].includes(tipo)) {
    return res.status(400).json({ error: "El tipo debe ser 'cliente' o 'tecnico'" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, tipo, telefono, ubicacion)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, email, tipo, telefono, ubicacion, creado_en`,
      [nombre, email, passwordHash, tipo, telefono, ubicacion]
    );
    const usuario = result.rows[0];
    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo },
      process.env.JWT_SECRET || 'secreto_dev',
      { expiresIn: '7d' }
    );
    res.status(201).json({ usuario, token });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese email ya esta registrado' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y password son obligatorios' });
  }
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = result.rows[0];
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo },
      process.env.JWT_SECRET || 'secreto_dev',
      { expiresIn: '7d' }
    );
    delete usuario.password_hash;
    res.json({ usuario, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
});

module.exports = router;
