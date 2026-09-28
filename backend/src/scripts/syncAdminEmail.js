/**
 * scripts/syncAdminEmail.js — Synchronise l’e-mail du compte admin avec ADMIN_EMAIL (.env).
 * Appelé au démarrage du serveur.
 */
require('dotenv').config();
const { pool } = require('../config/db');

/**
 * Aligne l'e-mail admin MySQL avec ADMIN_EMAIL du .env
 * (évite d'envoyer les codes/alertes vers une ancienne adresse).
 */
async function synchroniserEmailAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const username = process.env.ADMIN_USERNAME || 'admin';
  if (!email || !email.includes('@')) {
    console.warn('[AUTH] ADMIN_EMAIL absent dans .env — e-mail admin non synchronisé.');
    return;
  }

  try {
    const [result] = await pool.execute(
      `UPDATE utilisateurs
       SET email = ?
       WHERE nom_utilisateur = ?`,
      [email, username]
    );
    if (result.affectedRows > 0) {
      console.log(`[AUTH] E-mail admin synchronisé → ${email}`);
    } else {
      console.warn(`[AUTH] Utilisateur ${username} introuvable pour sync e-mail.`);
    }
  } catch (erreur) {
    if (erreur.code === 'ER_BAD_FIELD_ERROR') {
      console.warn(
        '[AUTH] Colonne email absente. Importe database/update_auth_email.sql'
      );
    } else {
      console.warn('[AUTH] Sync e-mail admin:', erreur.message);
    }
  }
}

/** Export pour server.js (démarrage). */
module.exports = { synchroniserEmailAdmin };
