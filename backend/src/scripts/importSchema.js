/**
 * Importe database/schema_mysql.sql vers la base distante (ex. Aiven).
 *
 * Usage :
 *   1. Mets temporairement les infos Aiven dans backend/.env (DB_*)
 *   2. Ajoute DB_SSL=true
 *   3. npm run import:schema
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

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

  const schemaPath = path.join(__dirname, '../../../database/schema_mysql.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Fichier introuvable : ${schemaPath}`);
  }

  let sql = fs.readFileSync(schemaPath, 'utf8');
  // Sur Aiven on utilise souvent defaultdb : on ignore CREATE DATABASE / USE
  sql = sql
    .replace(/CREATE DATABASE[\s\S]*?;/gi, '')
    .replace(/USE\s+\w+\s*;/gi, '');

  console.log(`Connexion à ${host}:${port} / base ${database} (ssl=${ssl})…`);

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
    await conn.query(sql);
    console.log('OK — schéma importé.');
    console.log('Ensuite : npm run seed:admin');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('Échec import:', e.message);
  process.exit(1);
});
