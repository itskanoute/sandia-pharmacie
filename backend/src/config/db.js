/**
 * Pool MySQL partagé (mysql2/promise) et test de connexion au démarrage.
 * Options lues depuis les variables d’environnement (.env).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

// SSL activé pour hébergeurs distants (ex. Aiven) via DB_SSL=true
const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

/** Pool réutilisé par toutes les routes et services (limite 10 connexions simultanées). */
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pharmacie_mali',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00',
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

/** Ping la base pour vérifier que le serveur répond (route /api/health). */
async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
}

/** Pool partagé et helper santé API. */
module.exports = { pool, testConnection };
