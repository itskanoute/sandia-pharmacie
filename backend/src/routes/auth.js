const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { envoyerCodeConnexion } = require('../services/email');

const router = express.Router();

function masquerEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [local, domaine] = email.split('@');
  const debut = local.slice(0, Math.min(2, local.length));
  return `${debut}***@${domaine}`;
}

function genererCode() {
  return String(crypto.randomInt(100000, 999999));
}

function creerToken(utilisateur) {
  return jwt.sign(
    {
      id: utilisateur.id,
      nom_utilisateur: utilisateur.nom_utilisateur,
      role: utilisateur.role_code,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

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
 * Création d’un compte administrateur (plusieurs admins autorisés).
 * Chaque admin a son e-mail → code de connexion + alertes.
 */
router.post('/creer-admin', async (req, res) => {
  try {
    const cree = await insererCompteAdmin(req.body);
    return res.status(201).json({
      message:
        'Compte administrateur créé. Vous recevrez le code de connexion et les alertes sur cet e-mail.',
      admin: cree,
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
router.post('/login', async (req, res) => {
  try {
    const identifiant = String(
      req.body.nom_utilisateur || req.body.identifiant || req.body.email || ''
    )
      .trim();
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

    if (!utilisateur || !Number(utilisateur.actif)) {
      // Aide si la personne tape son prénom / nom complet au lieu de l'identifiant
      const [homonymes] = await pool.execute(
        `SELECT nom_utilisateur, email
         FROM utilisateurs
         WHERE actif = 1 AND LOWER(nom_complet) = LOWER(?)
         LIMIT 3`,
        [identifiant]
      );
      if (homonymes.length) {
        const exemples = homonymes
          .map((h) => h.nom_utilisateur || h.email)
          .filter(Boolean)
          .join(' » ou « ');
        return res.status(401).json({
          message: `« ${identifiant} » est un nom affiché, pas l’identifiant de connexion. Connecte-toi avec : « ${exemples} » (ou ton e-mail).`,
        });
      }
      return res.status(401).json({
        message:
          'Identifiants incorrects. Vérifie l’identifiant (ou l’e-mail) et le mot de passe, ou crée un compte.',
      });
    }

    const motDePasseValide = await bcrypt.compare(
      motDePasse,
      utilisateur.mot_de_passe_hash
    );
    if (!motDePasseValide) {
      return res.status(401).json({
        message: 'Mot de passe incorrect pour ce compte.',
      });
    }

    if (utilisateur.role_code !== 'ADMIN') {
      return res.status(403).json({
        message: 'Seuls les administrateurs peuvent se connecter pour le moment.',
      });
    }

    if (!utilisateur.email) {
      return res.status(400).json({
        message:
          'Aucune adresse e-mail sur ce compte. Un admin doit renseigner l’e-mail dans Administrateurs / phpMyAdmin.',
      });
    }

    const code = genererCode();
    const codeHash = await bcrypt.hash(code, 8);
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

    if (envoi.mode === 'dev') {
      reponse.dev_code = code;
      reponse.message +=
        ' (mode démo : code aussi affiché ici car SMTP non configuré)';
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
router.post('/verifier-code', async (req, res) => {
  try {
    const utilisateurId = Number(req.body.utilisateur_id);
    const code = String(req.body.code || '').trim();

    if (!utilisateurId || !code) {
      return res.status(400).json({ message: 'Code et utilisateur obligatoires.' });
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
      return res.status(401).json({ message: 'Code expiré. Reconnectez-vous.' });
    }

    const ok = await bcrypt.compare(code, enregistre.code_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Code incorrect.' });
    }

    await pool.execute(`UPDATE codes_connexion SET utilise = 1 WHERE id = ?`, [
      enregistre.id,
    ]);

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

module.exports = router;
