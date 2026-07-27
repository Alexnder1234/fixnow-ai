const { Pool } = require('pg');
require('dotenv').config();

// Railway inyecta automaticamente la variable DATABASE_URL
// cuando conectas el servicio de PostgreSQL a tu proyecto.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log('Conectado a la base de datos PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL', err);
});

module.exports = pool;
