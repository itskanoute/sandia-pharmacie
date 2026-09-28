/**
 * routes/lots.js — Consultation lots médicaments et entrée manuelle de stock.
 * Préfixe API : /api/lots
 */
const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(authentifier);

/** GET / — Lots avec jours_restants et drapeaux alerte péremption / stock lot. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { JOURS_ALERTE_PEREMPTION_DEFAUT, SEUIL_STOCK_LOT } = require('../config/alertes');
    const jours = Number(req.query.alerte_jours) || JOURS_ALERTE_PEREMPTION_DEFAUT;
    const [rows] = await pool.execute(
      `SELECT l.*, m.nom AS medicament_nom, m.reference AS medicament_reference,
              DATEDIFF(l.date_peremption, CURDATE()) AS jours_restants
       FROM lots_medicaments l
       INNER JOIN medicaments m ON m.id = l.medicament_id
       WHERE l.quantite_disponible > 0
       ORDER BY l.date_peremption ASC`
    );
    res.json(
      rows.map((r) => ({
        ...r,
        alerte_peremption: Number(r.jours_restants) <= jours,
        alerte_stock_lot: Number(r.quantite_disponible) <= SEUIL_STOCK_LOT,
      }))
    );
  })
);

/** Entrée de stock : crée un lot (augmente le stock disponible). */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const medicamentId = Number(req.body.medicament_id);
    const numeroLot = String(req.body.numero_lot || '').trim();
    const datePeremption = req.body.date_peremption;
    const quantite = Number(req.body.quantite);

    if (!medicamentId || !numeroLot || !datePeremption) {
      return res.status(400).json({
        message: 'médicament, numéro de lot et date de péremption obligatoires.',
      });
    }
    if (!Number.isFinite(quantite) || quantite <= 0) {
      return res.status(400).json({ message: 'Quantité invalide.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [meds] = await connection.execute(
        `SELECT id FROM medicaments WHERE id = ? LIMIT 1`,
        [medicamentId]
      );
      if (!meds[0]) {
        await connection.rollback();
        return res.status(404).json({ message: 'Médicament introuvable.' });
      }

      const [result] = await connection.execute(
        `INSERT INTO lots_medicaments (
           medicament_id, numero_lot, date_reception, date_peremption,
           quantite_initiale, quantite_disponible
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          medicamentId,
          numeroLot,
          req.body.date_reception || new Date().toISOString().slice(0, 10),
          datePeremption,
          quantite,
          quantite,
        ]
      );

      await connection.execute(
        `INSERT INTO mouvements_stock (
           type_produit, medicament_id, lot_id, type_mouvement, quantite, sens,
           reference_type, reference_id, utilisateur_id, motif
         ) VALUES ('medicament', ?, ?, 'entree_autre', ?, 'entree', 'lot', ?, ?, ?)`,
        [
          medicamentId,
          result.insertId,
          quantite,
          result.insertId,
          req.utilisateur.id,
          String(req.body.motif || 'Entrée manuelle de lot').trim(),
        ]
      );

      await connection.commit();

      // Si le lot est déjà dans la fenêtre de péremption → e-mail immédiat aux admins
      try {
        const { lireJoursPeremption, notifierAlertesAdmin } = require('../services/alertesService');
        const jours = await lireJoursPeremption();
        const restants = Math.ceil(
          (new Date(datePeremption).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );
        if (restants <= jours) {
          notifierAlertesAdmin().catch((e) =>
            console.warn('[ALERTES] Après entrée lot:', e.message)
          );
        }
      } catch (e) {
        console.warn('[ALERTES] Skip notif lot:', e.message);
      }

      const [rows] = await pool.execute(
        `SELECT l.*, m.nom AS medicament_nom
         FROM lots_medicaments l
         INNER JOIN medicaments m ON m.id = l.medicament_id
         WHERE l.id = ?`,
        [result.insertId]
      );
      res.status(201).json(rows[0]);
    } catch (erreur) {
      await connection.rollback();
      if (erreur.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Ce numéro de lot existe déjà pour ce médicament.' });
      }
      throw erreur;
    } finally {
      connection.release();
    }
  })
);

/** Router lots → /api/lots */
module.exports = router;
