/**
 * routes/stock.js — Vue synthétique stock (médicaments par lots, appareils, mouvements récents).
 * Préfixe API : /api/stock
 */
const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(authentifier);

/**
 * GET / — Agrège stock médicaments (somme lots), quantités appareils et 50 derniers mouvements.
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    // Stock médicament = somme quantite_disponible par medicament_id
    const [medicaments] = await pool.execute(
      `SELECT m.id, m.nom, m.reference, m.seuil_alerte, m.unite_gestion, m.statut,
              COALESCE(s.stock, 0) AS stock_disponible
       FROM medicaments m
       LEFT JOIN (
         SELECT medicament_id, SUM(quantite_disponible) AS stock
         FROM lots_medicaments GROUP BY medicament_id
       ) s ON s.medicament_id = m.id
       WHERE m.statut = 'actif'
       ORDER BY m.nom ASC`
    );

    const [appareils] = await pool.execute(
      `SELECT id, nom, reference, quantite, seuil_alerte, etat, statut
       FROM appareils_medicaux
       WHERE statut = 'actif'
       ORDER BY nom ASC`
    );

    const [mouvements] = await pool.execute(
      `SELECT ms.*, m.nom AS medicament_nom, a.nom AS appareil_nom
       FROM mouvements_stock ms
       LEFT JOIN medicaments m ON m.id = ms.medicament_id
       LEFT JOIN appareils_medicaux a ON a.id = ms.appareil_id
       ORDER BY ms.created_at DESC
       LIMIT 50`
    );

    res.json({ medicaments, appareils, mouvements });
  })
);

/** Router stock → /api/stock */
module.exports = router;
