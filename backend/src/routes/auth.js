/**
 * Authentification SAN-DIA : statut, création d’admins, login + code e-mail, JWT.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { envoyerCodeConnexion } = require('../services/email');
const { assertJwtSecret, autoriseCodeDev } = require('../config/security');

const router = express.Router();
const JWT_SECRET = assertJwtSecret();

/** Anti brute-force sur login / OTP / bootstrap admin */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives. Réessaie dans 15 minutes.' },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_OTP_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de code. Réessaie plus tard.' },
});

/** Échecs OTP par utilisateur (mémoire process) — invalide le code après N essais */
const echecsOtp = new Map();
const MAX_OTP_ESSAIS = 5;

function compterEchecOtp(utilisateurId) {
  const n = (echecsOtp.get(utilisateurId) || 0) + 1;
  echecsOtp.set(utilisateurId, n);
  return n;
}

function resetEchecsOtp(utilisateurId) {
  echecsOtp.delete(utilisateurId);
}

/** Masque l’e-mail pour l’UI (ex. ab***@domaine.com). */
function masquerEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [local, domaine] = email.split('@');
  const debut = local.slice(0, Math.min(2, local.length));
  return `${debut}***@${domaine}`;
}

/** Code OTP 6 chiffres pour la double authentification e-mail. */
function genererCode() {
  return String(crypto.randomInt(100000, 999999));
}

/** Émet le JWT session après validation du code. */
function creerToken(utilisateur) {
  return jwt.sign(
    {
      id: utilisateur.id,
      nom_utilisateur: utilisateur.nom_utilisateur,
      role: utilisateur.role_code,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

/** Nombre d’admins actifs (bootstrap / contrôle création publique). */
async function compterAdminsActifs() {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS n
     FROM utilisateurs u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE r.code = 'ADMIN' AND u.actif = 1`
  );
  return Number(rows[0]?.n || 0);
}

/** Champs utilisateur renvoyés au frontend (sans hash mot de passe). */
function profilPublic(u) {
  return {
    id: u.id,
    nom_utilisateur: u.nom_utilisateur,
    nom_complet: u.nom_complet,
    email: u.email || null,
    telephone: u.telephone || null,
    role: u.role_code,
    role_libelle: u.role_libelle,
  };
}

/** Indique si un administrateur existe déjà (pour afficher création de compte). */
router.get('/statut', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS n
       FROM utilisateurs u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE r.code = 'ADMIN' AND u.actif = 1`
    );
    res.json({
      admin_existe: Number(rows[0].n) > 0,
      nb_admins: Number(rows[0].n),
    });
  } catch (erreur) {
    console.error('Erreur statut:', erreur.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

/** Logique partagée création admin (premier compte ou POST /admins). */
async function insererCompteAdmin(body) {
  const nomComplet = String(body.nom_complet || '').trim();
  const nomUtilisateur = String(body.nom_utilisateur || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const telephone = String(body.telephone || '').trim() || null;
  const motDePasse = String(body.mot_de_passe || '');
  const confirmation = String(body.confirmation || '');

  if (!nomComplet || !nomUtilisateur || !email || !motDePasse) {
    const err = new Error(
      'Nom complet, nom d’utilisateur, e-mail et mot de passe obligatoires.'
    );
    err.status = 400;
    throw err;
  }
  if (!email.includes('@')) {
    const err = new Error('Adresse e-mail invalide.');
    err.status = 400;
    throw err;
  }
  if (motDePasse.length < 8) {
    const err = new Error('Le mot de passe doit contenir au moins 8 caractères.');
    err.status = 400;
    throw err;
  }
  if (motDePasse !== confirmation) {
    const err = new Error('La confirmation du mot de passe ne correspond pas.');
    err.status = 400;
    throw err;
  }

  const [roles] = await pool.execute(`SELECT id FROM roles WHERE code = 'ADMIN' LIMIT 1`);
  if (!roles[0]) {
    const err = new Error('Rôle ADMIN introuvable. Importez d’abord le schéma MySQL.');
    err.status = 500;
    throw err;
  }

  const hash = await bcrypt.hash(motDePasse, 10);

  try {
    const [result] = await pool.execute(
      `INSERT INTO utilisateurs (
         role_id, nom_utilisateur, mot_de_passe_hash, nom_complet, email, telephone, actif
       ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [roles[0].id, nomUtilisateur, hash, nomComplet, email, telephone]
    );
    return {
      id: result.insertId,
      nom_utilisateur: nomUtilisateur,
      nom_complet: nomComplet,
      email,
      telephone,
    };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const e = new Error('Ce nom d’utilisateur ou cet e-mail est déjà utilisé.');
      e.status = 409;
      throw e;
    }
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      const e = new Error(
        'Colonne e-mail absente. Importez database/update_auth_email.sql dans phpMyAdmin.'
      );
      e.status = 500;
      throw e;
    }
    throw err;
  }
}

/**
 * Bootstrap UNIQUEMENT : créer le 1er admin tant qu’aucun n’existe.
 * Dès qu’un admin existe → 403 (utiliser POST /admins authentifié).
 */
router.post('/creer-admin', authLimiter, async (req, res) => {
  try {
    const nb = await compterAdminsActifs();
    if (nb > 0) {
      return res.status(403).json({
        message:
          'Un administrateur existe déjà. Connecte-toi puis ajoute un compte depuis Administrateurs.',
      });
    }
    const cree = await insererCompteAdmin(req.body);
    return res.status(201).json({
      message:
        'Compte administrateur créé. Vous recevrez le code de connexion et les alertes sur cet e-mail.',
      admin: {
        id: cree.id,
        nom_utilisateur: cree.nom_utilisateur,
        nom_complet: cree.nom_complet,
        email: cree.email,
      },
    });
  } catch (erreur) {
    if (erreur.status) {
      return res.status(erreur.status).json({ message: erreur.message });
    }
    console.error('Erreur creer-admin:', erreur.message);
    return res.status(500).json({ message: 'Erreur lors de la création du compte.' });
  }
});

/** Liste des administrateurs (connecté). */
router.get(
  '/admins',
  authentifier,
  async (_req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.nom_utilisateur, u.nom_complet, u.email, u.telephone, u.actif, u.created_at
         FROM utilisateurs u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE r.code = 'ADMIN'
         ORDER BY u.nom_complet ASC`
      );
      res.json(rows);
    } catch (erreur) {
      console.error('Erreur liste admins:', erreur.message);
      res.status(500).json({ message: 'Erreur lors du chargement des administrateurs.' });
    }
  }
);

/** Ajouter un administrateur depuis l’espace connecté. */
router.post('/admins', authentifier, async (req, res) => {
  try {
    if (req.utilisateur?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Réservé aux administrateurs.' });
    }
    const cree = await insererCompteAdmin(req.body);
    return res.status(201).json({
      message: `Compte créé pour ${cree.nom_complet}. Les alertes iront aussi à ${cree.email}.`,
      admin: cree,
    });
  } catch (erreur) {
    if (erreur.status) {
      return res.status(erreur.status).json({ message: erreur.message });
    }
    console.error('Erreur post admins:', erreur.message);
    return res.status(500).json({ message: 'Erreur lors de la création du compte.' });
  }
});

/**
 * Étape 1 : identifiants. Seul un ADMIN actif peut se connecter.
 * Envoie un code par e-mail (pas de JWT encore).
 */
router.post('/login', authLimiter, async (req, res) => {
  const messageIdIncorrect =
    'Identifiants incorrects. Vérifie l’identifiant (ou l’e-mail) et le mot de passe.';

  try {
    const identifiant = String(
      req.body.nom_utilisateur || req.body.identifiant || req.body.email || ''
    ).trim();
    const motDePasse = String(req.body.mot_de_passe || '');

    if (!identifiant || !motDePasse) {
      return res.status(400).json({
        message: 'Identifiant (ou e-mail) et mot de passe obligatoires.',
      });
    }

    let utilisateur;
    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.nom_utilisateur, u.mot_de_passe_hash, u.nom_complet,
                u.email, u.telephone, u.actif, r.code AS role_code, r.libelle AS role_libelle
         FROM utilisateurs u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE LOWER(u.nom_utilisateur) = LOWER(?)
            OR LOWER(COALESCE(u.email, '')) = LOWER(?)
         LIMIT 1`,
        [identifiant, identifiant]
      );
      utilisateur = rows[0];
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        return res.status(503).json({
          message:
            'Mise à jour base manquante : importe database/update_auth_email.sql dans phpMyAdmin, puis ajoute un e-mail à l’admin.',
        });
      }
      throw err;
    }

    // Message générique : évite l’énumération d’utilisateurs
    if (!utilisateur || !Number(utilisateur.actif)) {
      return res.status(401).json({ message: messageIdIncorrect });
    }

    const motDePasseValide = await bcrypt.compare(
      motDePasse,
      utilisateur.mot_de_passe_hash
    );
    if (!motDePasseValide) {
      return res.status(401).json({ message: messageIdIncorrect });
    }

    if (utilisateur.role_code !== 'ADMIN') {
      return res.status(403).json({
        message: 'Seuls les administrateurs peuvent se connecter pour le moment.',
      });
    }

    if (!utilisateur.email) {
      return res.status(400).json({
        message:
          'Aucune adresse e-mail sur ce compte. Un admin doit renseigner l’e-mail dans Administrateurs.',
      });
    }

    const code = genererCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expireAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      await pool.execute(
        `UPDATE codes_connexion SET utilise = 1
         WHERE utilisateur_id = ? AND utilise = 0`,
        [utilisateur.id]
      );
      await pool.execute(
        `INSERT INTO codes_connexion (utilisateur_id, code_hash, expire_at)
         VALUES (?, ?, ?)`,
        [utilisateur.id, codeHash, expireAt]
      );
      resetEchecsOtp(utilisateur.id);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {
        return res.status(503).json({
          message:
            'Tables auth e-mail manquantes. Importez database/update_auth_email.sql dans phpMyAdmin.',
        });
      }
      throw err;
    }

    let envoi;
    try {
      envoi = await envoyerCodeConnexion(
        utilisateur.email,
        code,
        utilisateur.nom_complet
      );
    } catch (err) {
      return res.status(503).json({ message: err.message });
    }

    const reponse = {
      etape: 'verification_code',
      message: `Un code a été envoyé à ${masquerEmail(utilisateur.email)}.`,
      utilisateur_id: utilisateur.id,
      email_masque: masquerEmail(utilisateur.email),
    };

    // Code visible UNIQUEMENT hors production + AUTH_ALLOW_DEV_CODE=true
    if (envoi.mode === 'dev' && autoriseCodeDev()) {
      reponse.dev_code = code;
      reponse.message +=
        ' (mode démo local : code aussi affiché ici car e-mail non configuré)';
    }

    return res.json(reponse);
  } catch (erreur) {
    console.error('Erreur login:', erreur.message);
    return res.status(500).json({
      message: 'Erreur serveur lors de la connexion.',
    });
  }
});

/**
 * Étape 2 : vérification du code e-mail → JWT.
 */
router.post('/verifier-code', otpLimiter, async (req, res) => {
  try {
    const utilisateurId = Number(req.body.utilisateur_id);
    const code = String(req.body.code || '').trim();

    if (!utilisateurId || !code) {
      return res.status(400).json({ message: 'Code et utilisateur obligatoires.' });
    }

    // Refuse les codes non numériques / trop longs (anti fuzzing)
    if (!/^\d{6}$/.test(code)) {
      return res.status(401).json({ message: 'Code incorrect.' });
    }

    const [users] = await pool.execute(
      `SELECT u.id, u.nom_utilisateur, u.nom_complet, u.email, u.telephone,
              u.actif, r.code AS role_code, r.libelle AS role_libelle
       FROM utilisateurs u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       LIMIT 1`,
      [utilisateurId]
    );
    const utilisateur = users[0];
    if (!utilisateur || !utilisateur.actif || utilisateur.role_code !== 'ADMIN') {
      return res.status(401).json({ message: 'Session invalide.' });
    }

    const [codes] = await pool.execute(
      `SELECT id, code_hash, expire_at
       FROM codes_connexion
       WHERE utilisateur_id = ? AND utilise = 0
       ORDER BY id DESC
       LIMIT 1`,
      [utilisateurId]
    );
    const enregistre = codes[0];
    if (!enregistre) {
      return res.status(401).json({ message: 'Aucun code en attente. Reconnectez-vous.' });
    }
    if (new Date(enregistre.expire_at) < new Date()) {
      await pool.execute(`UPDATE codes_connexion SET utilise = 1 WHERE id = ?`, [
        enregistre.id,
      ]);
      return res.status(401).json({ message: 'Code expiré. Reconnectez-vous.' });
    }

    const ok = await bcrypt.compare(code, enregistre.code_hash);
    if (!ok) {
      const n = compterEchecOtp(utilisateurId);
      if (n >= MAX_OTP_ESSAIS) {
        await pool.execute(`UPDATE codes_connexion SET utilise = 1 WHERE id = ?`, [
          enregistre.id,
        ]);
        resetEchecsOtp(utilisateurId);
        return res.status(401).json({
          message: 'Trop d’essais incorrects. Demande un nouveau code.',
        });
      }
      return res.status(401).json({ message: 'Code incorrect.' });
    }

    await pool.execute(`UPDATE codes_connexion SET utilise = 1 WHERE id = ?`, [
      enregistre.id,
    ]);
    resetEchecsOtp(utilisateurId);

    const token = creerToken(utilisateur);
    return res.json({
      message: 'Connexion réussie.',
      token,
      utilisateur: profilPublic(utilisateur),
    });
  } catch (erreur) {
    console.error('Erreur verifier-code:', erreur.message);
    return res.status(500).json({ message: 'Erreur lors de la vérification.' });
  }
});

/** GET /me — Profil de l’utilisateur connecté (JWT). */
router.get('/me', authentifier, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.nom_utilisateur, u.nom_complet, u.email, u.telephone, u.actif,
              r.code AS role_code, r.libelle AS role_libelle
       FROM utilisateurs u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       LIMIT 1`,
      [req.utilisateur.id]
    );

    const utilisateur = rows[0];

    if (!utilisateur || !utilisateur.actif) {
      return res.status(401).json({ message: 'Utilisateur introuvable ou inactif.' });
    }

    return res.json(profilPublic(utilisateur));
  } catch (erreur) {
    console.error('Erreur /me:', erreur.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});

/** Montage sous /api/auth dans server.js */
module.exports = router;
