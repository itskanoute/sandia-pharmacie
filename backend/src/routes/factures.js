/**
 * routes/factures.js — Consultation factures et liste des dettes clients.
 * Préfixe API : /api/factures (création via ventes ou pro formas).
 */
const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { chargerFacture } = require('../services/facturesService');

const router = express.Router();
router.use(authentifier);

/** GET / — Liste avec filtres statut_paiement et client_id. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const statut = String(req.query.statut_paiement || '').trim();
    const clientId = req.query.client_id;

    let sql = `
      SELECT f.id, f.numero, f.vente_id, f.client_id, f.type_client,
             f.date_facture, f.montant_total, f.montant_paye, f.montant_reste,
             f.statut_paiement, f.moyen_paiement, c.nom AS client_nom
      FROM factures f
      LEFT JOIN clients c ON c.id = f.client_id
      WHERE 1=1`;
    const params = [];

    if (statut) {
      sql += ` AND f.statut_paiement = ?`;
      params.push(statut);
    }
    if (clientId) {
      sql += ` AND f.client_id = ?`;
      params.push(clientId);
    }

    sql += ` ORDER BY f.date_facture DESC, f.id DESC`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  })
);

/** GET /dettes — Factures avec montant_reste > 0 (écran Dettes / relances). */
router.get(
  '/dettes',
  asyncHandler(async (req, res) => {
    const clientId = req.query.client_id;
    let sql = `
      SELECT f.id, f.numero, f.client_id, f.date_facture, f.montant_total,
             f.montant_paye, f.montant_reste, f.statut_paiement, f.moyen_paiement,
             c.nom AS client_nom, c.telephone AS client_telephone
      FROM factures f
      LEFT JOIN clients c ON c.id = f.client_id
      WHERE f.montant_reste > 0 AND f.statut_paiement <> 'paye'`;
    const params = [];

    if (clientId) {
      sql += ` AND f.client_id = ?`;
      params.push(clientId);
    }

    sql += ` ORDER BY f.date_facture ASC, f.id ASC`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  })
);

/** GET /:id — Détail complet (lignes + historique paiements). */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const facture = await chargerFacture(req.params.id);
    if (!facture) return res.status(404).json({ message: 'Facture introuvable.' });
    res.json(facture);
  })
);

/** Router factures → /api/factures */
module.exports = router;
