/**
 * Applique database/update_*.sql sur la base distante (Aiven).
 * Ignore les erreurs « colonne / table déjà existante ».
 *
 * Usage : DB_* + DB_SSL=true dans .env puis npm run import:updates
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const ORDER = [
  'update_auth_email.sql',
  'update_mysql.sql',
  'update_facturation.sql',
  'update_infos_sandia.sql',
  'update_email_admin.sql',
  'update_alertes_seuils.sql',
];

function isIgnorable(err) {
  const msg = String(err.message || '');
  const code = err.errno || err.code;
  return (
    code === 1060 ||
    code === 1061 ||
    code === 1050 ||
    code === 1062 ||
    /Duplicate column/i.test(msg) ||
    /Duplicate key name/i.test(msg) ||
    /already exists/i.test(msg)
  );
}

/** Enlève commentaires et découpe en statements. */
function splitStatements(sql) {
  let cleaned = sql
    .replace(/CREATE DATABASE[\s\S]*?;/gi, '')
    .replace(/USE\s+\w+\s*;/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '');

  return cleaned
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !/^SELECT\b/i.test(s));
}

async function runFile(conn, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const parts = splitStatements(sql);

  for (const part of parts) {
    const stmt = `${part};`;
    try {
      await conn.query(stmt);
    } catch (e) {
      if (isIgnorable(e)) {
        console.log(`  (ignoré) ${e.message}`);
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'defaultdb';
  const ssl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

  if (!host || !user) {
    throw new Error('DB_HOST et DB_USER obligatoires dans backend/.env');
  }

  const dbDir = path.join(__dirname, '../../../database');
  console.log(`Connexion à ${host}:${port} / ${database} (ssl=${ssl})…`);

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
  });

  try {
    for (const name of ORDER) {
      const filePath = path.join(dbDir, name);
      if (!fs.existsSync(filePath)) {
        console.log(`Skip (absent) : ${name}`);
        continue;
      }
      console.log(`→ ${name}`);
      await runFile(conn, filePath);
      console.log(`  OK`);
    }
    console.log('OK — mises à jour appliquées.');
    console.log('Ensuite : npm run seed:admin');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('Échec import updates:', e.message);
  process.exit(1);
});
