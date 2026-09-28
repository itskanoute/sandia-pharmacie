/**
 * routes/medicaments.js — Catalogue médicaments et stock agrégé (lots).
 * Préfixe API : /api/medicaments
 */
const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { stockMedicament } = require('../utils/stock');

const router = express.Router();
router.use(authentifier);

/** GET / — Liste avec recherche q, filtre statut (défaut : actif) et stock_disponible calculé. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const statut = String(req.query.statut || '').trim();

    let sql = `
      SELECT m.*,
             COALESCE(s.stock, 0) AS stock_disponible
      FROM medicaments m
      LEFT JOIN (
        SELECT medicament_id, SUM(quantite_disponible) AS stock
        FROM lots_medicaments
        GROUP BY medicament_id
      ) s ON s.medicament_id = m.id
      WHERE 1=1`;
    const params = [];

    if (q) {
      sql += ` AND (m.nom LIKE ? OR m.reference LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    if (statut) {
      sql += ` AND m.statut = ?`;
      params.push(statut);
    } else {
      sql += ` AND m.statut = 'actif'`;
    }

    sql += ` ORDER BY m.nom ASC`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  })
);

/** GET /:id — Fiche + stock et liste des lots triés par péremption. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT * FROM medicaments WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Médicament introuvable.' });

    const stock = await stockMedicament(pool, req.params.id);
    const [lots] = await pool.execute(
      `SELECT id, numero_lot, date_peremption, quantite_disponible, quantite_initiale
       FROM lots_medicaments WHERE medicament_id = ? ORDER BY date_peremption ASC`,
      [req.params.id]
    );

    res.json({ ...rows[0], stock_disponible: stock, lots });
  })
);

/** POST / — Création ; forme/dosage en UPDATE optionnel si migration facturation appliquée. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const nom = String(req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ message: 'Le nom est obligatoire.' });

    const [result] = await pool.execute(
      `INSERT INTO medicaments (
         nom, reference, categorie_id, description,
         prix_achat, prix_client, prix_revendeur, seuil_alerte, unite_gestion, statut
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nom,
        String(req.body.reference || '').trim() || null,
        req.body.categorie_id || null,
        String(req.body.description || '').trim() || null,
        Number(req.body.prix_achat) || 0,
        Number(req.body.prix_client) || 0,
        Number(req.body.prix_revendeur) || 0,
        Number(req.body.seuil_alerte) || 0,
        String(req.body.unite_gestion || 'boîte').trim() || 'boîte',
        req.body.statut === 'inactif' ? 'inactif' : 'actif',
      ]
    );

    // Colonnes optionnelles (après import update_facturation.sql)
    try {
      await pool.execute(
        `UPDATE medicaments SET forme = ?, dosage = ? WHERE id = ?`,
        [
          String(req.body.forme || '').trim() || null,
          String(req.body.dosage || '').trim() || null,
          result.insertId,
        ]
      );
    } catch {
      /* colonnes absentes : ignorer */
    }

    const [rows] = await pool.execute(`SELECT * FROM medicaments WHERE id = ?`, [result.insertId]);
    res.status(201).json({ ...rows[0], stock_disponible: 0 });
  })
);

/** PUT /:id — Mise à jour prix, seuil, statut ; retourne stock recalculé. */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const nom = String(req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ message: 'Le nom est obligatoire.' });

    const [result] = await pool.execute(
      `UPDATE medicaments SET
         nom = ?, reference = ?, categorie_id = ?,
         description = ?, prix_achat = ?, prix_client = ?, prix_revendeur = ?,
         seuil_alerte = ?, unite_gestion = ?, statut = ?
       WHERE id = ?`,
      [
        nom,
        String(req.body.reference || '').trim() || null,
        req.body.categorie_id || null,
        String(req.body.description || '').trim() || null,
        Number(req.body.prix_achat) || 0,
        Number(req.body.prix_client) || 0,
        Number(req.body.prix_revendeur) || 0,
        Number(req.body.seuil_alerte) || 0,
        String(req.body.unite_gestion || 'boîte').trim() || 'boîte',
        ['actif', 'archive', 'inactif'].includes(req.body.statut) ? req.body.statut : 'actif',
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Médicament introuvable.' });
    }

    try {
      await pool.execute(
        `UPDATE medicaments SET forme = ?, dosage = ? WHERE id = ?`,
        [
          String(req.body.forme || '').trim() || null,
          String(req.body.dosage || '').trim() || null,
          req.params.id,
        ]
      );
    } catch {
      /* colonnes absentes : ignorer */
    }

    const [rows] = await pool.execute(`SELECT * FROM medicaments WHERE id = ?`, [req.params.id]);
    const stock = await stockMedicament(pool, req.params.id);
    res.json({ ...rows[0], stock_disponible: stock });
  })
);

/** Router médicaments → /api/medicaments */
module.exports = router;
