/**
 * scripts/seedAdmin.js — Crée ou met à jour le compte admin depuis .env (npm run seed:admin).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, testConnection } = require('../config/db');

/** Upsert utilisateur ADMIN (mot de passe hashé bcrypt). */
async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';
  const fullName = process.env.ADMIN_FULL_NAME || 'Administrateur';
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase() || null;

  if (!password || password.length < 8) {
    throw new Error('ADMIN_PASSWORD doit contenir au moins 8 caractères (.env).');
  }

  await testConnection();

  const [roles] = await pool.execute(
    `SELECT id FROM roles WHERE code = 'ADMIN' LIMIT 1`
  );

  if (!roles[0]) {
    throw new Error(
      'Rôle ADMIN introuvable. Importe d’abord database/schema_mysql.sql.'
    );
  }

  const roleId = roles[0].id;
  const hash = await bcrypt.hash(password, 10);

  const [existants] = await pool.execute(
    `SELECT id FROM utilisateurs WHERE nom_utilisateur = ? LIMIT 1`,
    [username]
  );

  if (existants[0]) {
    try {
      await pool.execute(
        `UPDATE utilisateurs
         SET mot_de_passe_hash = ?, nom_complet = ?, email = COALESCE(?, email),
             role_id = ?, actif = 1
         WHERE id = ?`,
        [hash, fullName, email, roleId, existants[0].id]
      );
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        await pool.execute(
          `UPDATE utilisateurs
           SET mot_de_passe_hash = ?, nom_complet = ?, role_id = ?, actif = 1
           WHERE id = ?`,
          [hash, fullName, roleId, existants[0].id]
        );
        console.warn(
          'Colonne email absente — importe database/update_auth_email.sql puis relance le seed.'
        );
      } else {
        throw err;
      }
    }
    console.log(`Administrateur mis à jour : ${username}`);
  } else {
    try {
      await pool.execute(
        `INSERT INTO utilisateurs (
           role_id, nom_utilisateur, mot_de_passe_hash, nom_complet, email, actif
         ) VALUES (?, ?, ?, ?, ?, 1)`,
        [roleId, username, hash, fullName, email]
      );
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        await pool.execute(
          `INSERT INTO utilisateurs (role_id, nom_utilisateur, mot_de_passe_hash, nom_complet, actif)
           VALUES (?, ?, ?, ?, 1)`,
          [roleId, username, hash, fullName]
        );
        console.warn(
          'Colonne email absente — importe database/update_auth_email.sql.'
        );
      } else {
        throw err;
      }
    }
    console.log(`Administrateur créé : ${username}`);
  }

  console.log('Tu peux te connecter avec ce compte (mot de passe dans backend/.env).');
  if (!email) {
    console.log('Astuce : renseigne ADMIN_EMAIL dans .env pour les codes de connexion.');
  }
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error('Échec seed admin:', erreur.message);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
