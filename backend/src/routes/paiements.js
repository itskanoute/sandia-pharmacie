const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { prochainNumero } = require('../utils/numeros');
const { calculerStatutPaiement } = require('../utils/statutPaiement');
const { chargerFacture } = require('../services/facturesService');

const router = express.Router();
router.use(authentifier);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const factureId = req.query.facture_id;
    const clientId = req.query.client_id;

    let sql = `
      SELECT p.*, f.numero AS facture_numero, c.nom AS client_nom
      FROM paiements p
      INNER JOIN factures f ON f.id = p.facture_id
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE 1=1`;
    const params = [];

    if (factureId) {
      sql += ` AND p.facture_id = ?`;
      params.push(factureId);
    }
    if (clientId) {
      sql += ` AND p.client_id = ?`;
      params.push(clientId);
    }

    sql += ` ORDER BY p.date_paiement DESC, p.id DESC LIMIT 300`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  })
);

/**
 * Enregistre un paiement / avance sur une facture.
 * Body: { facture_id, montant, moyen_paiement, date_paiement, notes }
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const factureId = Number(req.body.facture_id);
    const montant = Number(req.body.montant);

    if (!factureId) {
      return res.status(400).json({ message: 'facture_id obligatoire.' });
    }
    if (!Number.isFinite(montant) || montant <= 0) {
      return res.status(400).json({ message: 'Montant de paiement invalide.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [facRows] = await connection.execute(
        `SELECT * FROM factures WHERE id = ? FOR UPDATE`,
        [factureId]
      );
      const facture = facRows[0];
      if (!facture) {
        await connection.rollback();
        return res.status(404).json({ message: 'Facture introuvable.' });
      }
      if (facture.montant_reste <= 0 || facture.statut_paiement === 'paye') {
        await connection.rollback();
        return res.status(400).json({ message: 'Cette facture est déjà soldée.' });
      }
      if (montant > facture.montant_reste) {
        await connection.rollback();
        return res.status(400).json({
          message: `Montant trop élevé. Reste dû : ${facture.montant_reste} FCFA.`,
        });
      }

      const numero = await prochainNumero(connection, 'paiement');
      const datePaiement = req.body.date_paiement
        ? new Date(req.body.date_paiement)
        : new Date();
      const moyen = String(req.body.moyen_paiement || facture.moyen_paiement || '').trim() || null;

      const [payResult] = await connection.execute(
        `INSERT INTO paiements (
           numero, facture_id, client_id, montant, date_paiement,
           moyen_paiement, notes, enregistre_par
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numero,
          factureId,
          facture.client_id,
          montant,
          datePaiement,
          moyen,
          String(req.body.notes || '').trim() || null,
          req.utilisateur.id,
        ]
      );

      const nouveauPaye = Number(facture.montant_paye) + montant;
      const { montant_paye, montant_reste, statut_paiement } = calculerStatutPaiement(
        facture.montant_total,
        nouveauPaye
      );

      await connection.execute(
        `UPDATE factures SET
           montant_paye = ?, montant_reste = ?, statut_paiement = ?,
           moyen_paiement = COALESCE(?, moyen_paiement)
         WHERE id = ?`,
        [montant_paye, montant_reste, statut_paiement, moyen, factureId]
      );

      await connection.commit();

      const detail = await chargerFacture(factureId);
      res.status(201).json({
        message: 'Paiement enregistré.',
        paiement: {
          id: payResult.insertId,
          numero,
          montant,
          moyen_paiement: moyen,
        },
        facture: detail,
      });
    } catch (erreur) {
      await connection.rollback();
      throw erreur;
    } finally {
      connection.release();
    }
  })
);

module.exports = router;
