/**
 * routes/appareils.js — Matériel médical (stock = colonne quantite).
 * Préfixe API : /api/appareils
 */
const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(authentifier);

/** GET / — Appareils actifs, recherche sur nom/référence/marque. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    let sql = `
      SELECT id, nom, type_appareil, reference, marque, modele, numero_serie,
             quantite, prix_achat, prix_client, prix_revendeur, etat,
             seuil_alerte, notes, statut
      FROM appareils_medicaux WHERE statut = 'actif'`;
    const params = [];

    if (q) {
      sql += ` AND (nom LIKE ? OR reference LIKE ? OR marque LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY nom ASC`;

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  })
);

/** GET /:id — Détail appareil. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT * FROM appareils_medicaux WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Appareil introuvable.' });
    res.json(rows[0]);
  })
);

/** POST / — Nouvel appareil (statut actif par défaut). */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const nom = String(req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ message: 'Le nom est obligatoire.' });

    const [result] = await pool.execute(
      `INSERT INTO appareils_medicaux (
         nom, type_appareil, reference, marque, modele, numero_serie,
         quantite, prix_achat, prix_client, prix_revendeur,
         fournisseur_id, etat, seuil_alerte, notes, statut
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nom,
        String(req.body.type_appareil || '').trim() || null,
        String(req.body.reference || '').trim() || null,
        String(req.body.marque || '').trim() || null,
        String(req.body.modele || '').trim() || null,
        String(req.body.numero_serie || '').trim() || null,
        Number(req.body.quantite) || 0,
        Number(req.body.prix_achat) || 0,
        Number(req.body.prix_client) || 0,
        Number(req.body.prix_revendeur) || 0,
        req.body.fournisseur_id || null,
        req.body.etat || 'disponible',
        Number(req.body.seuil_alerte) || 0,
        String(req.body.notes || '').trim() || null,
        'actif',
      ]
    );

    const [rows] = await pool.execute(`SELECT * FROM appareils_medicaux WHERE id = ?`, [
      result.insertId,
    ]);
    res.status(201).json(rows[0]);
  })
);

/** PUT /:id — Mise à jour stock, prix, fournisseur, statut. */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const nom = String(req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ message: 'Le nom est obligatoire.' });

    const [result] = await pool.execute(
      `UPDATE appareils_medicaux SET
         nom = ?, type_appareil = ?, reference = ?, marque = ?, modele = ?,
         numero_serie = ?, quantite = ?, prix_achat = ?, prix_client = ?,
         prix_revendeur = ?, fournisseur_id = ?, etat = ?, seuil_alerte = ?,
         notes = ?, statut = ?
       WHERE id = ?`,
      [
        nom,
        String(req.body.type_appareil || '').trim() || null,
        String(req.body.reference || '').trim() || null,
        String(req.body.marque || '').trim() || null,
        String(req.body.modele || '').trim() || null,
        String(req.body.numero_serie || '').trim() || null,
        Number(req.body.quantite) || 0,
        Number(req.body.prix_achat) || 0,
        Number(req.body.prix_client) || 0,
        Number(req.body.prix_revendeur) || 0,
        req.body.fournisseur_id || null,
        req.body.etat || 'disponible',
        Number(req.body.seuil_alerte) || 0,
        String(req.body.notes || '').trim() || null,
        ['actif', 'archive', 'inactif'].includes(req.body.statut) ? req.body.statut : 'actif',
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Appareil introuvable.' });
    }

    const [rows] = await pool.execute(`SELECT * FROM appareils_medicaux WHERE id = ?`, [
      req.params.id,
    ]);
    res.json(rows[0]);
  })
);

/** Router appareils → /api/appareils */
module.exports = router;
