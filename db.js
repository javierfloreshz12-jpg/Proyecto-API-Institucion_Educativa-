// Conexión a PostgreSQL: proyecto_final_db
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'proyecto_final_db',
  password: 'Fimas@15',
  port: 5432,
});

module.exports = pool;