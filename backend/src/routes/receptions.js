const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { prochainNumero } = require('../utils/numeros');

const router = express.Router();
router.use(authentifier);

async function assurerSequence(connection, code, prefixe) {
  await connection.execute(
    `INSERT IGNORE INTO sequences_numerotation (code, prefixe, prochain_numero)
     VALUES (?, ?, 1)`,
    [code, prefixe]
  );
}

async function chargerReception(id) {
  const [rows] = await pool.execute(
    `SELECT r.*, c.numero AS commande_numero, f.nom AS fournisseur_nom
     FROM receptions r
     INNER JOIN commandes c ON c.id = r.commande_id
     LEFT JOIN fournisseurs f ON f.id = c.fournisseur_id
     WHERE r.id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  const [lignes] = await pool.execute(
    `SELECT * FROM lignes_reception WHERE reception_id = ? ORDER BY id`,
    [id]
  );
  return { ...rows[0], lignes };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(
      `SELECT r.id, r.numero, r.date_reception, r.statut, r.commande_id,
              c.numero AS commande_numero, f.nom AS fournisseur_nom
       FROM receptions r
       INNER JOIN commandes c ON c.id = r.commande_id
       LEFT JOIN fournisseurs f ON f.id = c.fournisseur_id
       ORDER BY r.date_reception DESC, r.id DESC`
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const rec = await chargerReception(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Réception introuvable.' });
    res.json(rec);
  })
);

/** Crée une réception à partir d'une commande (lignes préremplies). */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const commandeId = Number(req.body.commande_id);
    if (!commandeId) {
      return res.status(400).json({ message: 'commande_id obligatoire.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [cmds] = await connection.execute(
        `SELECT * FROM commandes WHERE id = ? FOR UPDATE`,
        [commandeId]
      );
      if (!cmds[0]) {
        await connection.rollback();
        return res.status(404).json({ message: 'Commande introuvable.' });
      }

      const [lignesCmd] = await connection.execute(
        `SELECT * FROM lignes_commande WHERE commande_id = ?`,
        [commandeId]
      );

      await assurerSequence(connection, 'reception', 'REC');
      const numero = await prochainNumero(connection, 'reception');

      const [result] = await connection.execute(
        `INSERT INTO receptions (
           commande_id, numero, date_reception, statut, observations, cree_par
         ) VALUES (?, ?, ?, 'en_controle', ?, ?)`,
        [
          commandeId,
          numero,
          req.body.date_reception || new Date().toISOString().slice(0, 10),
          String(req.body.observations || '').trim() || null,
          req.utilisateur.id,
        ]
      );

      for (const l of lignesCmd) {
        await connection.execute(
          `INSERT INTO lignes_reception (
             reception_id, ligne_commande_id, type_produit, medicament_id, appareil_id,
             designation, quantite_commandee, quantite_recue, statut_controle
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en_attente')`,
          [
            result.insertId,
            l.id,
            l.type_produit,
            l.medicament_id,
            l.appareil_id,
            l.designation,
            l.quantite_commandee,
            l.quantite_commandee,
          ]
        );
      }

      await connection.commit();
      res.status(201).json(await chargerReception(result.insertId));
    } catch (erreur) {
      await connection.rollback();
      throw erreur;
    } finally {
      connection.release();
    }
  })
);

/**
 * Valide une réception : met à jour quantités reçues, crée lots / augmente stock appareils.
 * Body: { lignes: [{ id, quantite_recue, numero_lot, date_peremption, etat_produit }] }
 */
router.post(
  '/:id/valider',
  asyncHandler(async (req, res) => {
    const receptionId = Number(req.params.id);
    const majLignes = Array.isArray(req.body.lignes) ? req.body.lignes : [];

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [recs] = await connection.execute(
        `SELECT * FROM receptions WHERE id = ? FOR UPDATE`,
        [receptionId]
      );
      if (!recs[0]) {
        await connection.rollback();
        return res.status(404).json({ message: 'Réception introuvable.' });
      }
      if (recs[0].statut === 'validee') {
        await connection.rollback();
        return res.status(400).json({ message: 'Réception déjà validée.' });
      }

      const [lignes] = await connection.execute(
        `SELECT * FROM lignes_reception WHERE reception_id = ? FOR UPDATE`,
        [receptionId]
      );

      for (const ligne of lignes) {
        const maj = majLignes.find((x) => Number(x.id) === Number(ligne.id)) || {};
        const qteRecue = Number(
          maj.quantite_recue !== undefined ? maj.quantite_recue : ligne.quantite_recue
        );
        if (!Number.isFinite(qteRecue) || qteRecue < 0) {
          throw Object.assign(new Error('Quantité reçue invalide.'), { status: 400 });
        }

        const ecart = qteRecue !== Number(ligne.quantite_commandee);
        const statutControle = ecart ? 'ecart' : 'conforme';

        await connection.execute(
          `UPDATE lignes_reception SET
             quantite_recue = ?, ecart = ?, statut_controle = ?,
             numero_lot = COALESCE(?, numero_lot),
             date_peremption = COALESCE(?, date_peremption),
             etat_produit = COALESCE(?, etat_produit)
           WHERE id = ?`,
          [
            qteRecue,
            qteRecue - Number(ligne.quantite_commandee),
            statutControle,
            maj.numero_lot || null,
            maj.date_peremption || null,
            maj.etat_produit || null,
            ligne.id,
          ]
        );

        if (qteRecue <= 0) continue;

        if (ligne.type_produit === 'medicament' && ligne.medicament_id) {
          const numeroLot =
            String(maj.numero_lot || ligne.numero_lot || `REC${receptionId}-L${ligne.id}`).trim();
          const datePeremption =
            maj.date_peremption ||
            ligne.date_peremption ||
            new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

          const [lotResult] = await connection.execute(
            `INSERT INTO lots_medicaments (
               medicament_id, numero_lot, date_reception, date_peremption,
               quantite_initiale, quantite_disponible, ligne_reception_id
             ) VALUES (?, ?, CURDATE(), ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               quantite_disponible = quantite_disponible + VALUES(quantite_disponible),
               quantite_initiale = quantite_initiale + VALUES(quantite_initiale)`,
            [
              ligne.medicament_id,
              numeroLot,
              datePeremption,
              qteRecue,
              qteRecue,
              ligne.id,
            ]
          );

          const lotId = lotResult.insertId || null;
          await connection.execute(
            `INSERT INTO mouvements_stock (
               type_produit, medicament_id, lot_id, type_mouvement, quantite, sens,
               reference_type, reference_id, utilisateur_id
             ) VALUES ('medicament', ?, ?, 'entree_reception', ?, 'entree', 'reception', ?, ?)`,
            [
              ligne.medicament_id,
              lotId || null,
              qteRecue,
              receptionId,
              req.utilisateur.id,
            ]
          );
        }

        if (ligne.type_produit === 'appareil' && ligne.appareil_id) {
          await connection.execute(
            `UPDATE appareils_medicaux SET quantite = quantite + ? WHERE id = ?`,
            [qteRecue, ligne.appareil_id]
          );
          await connection.execute(
            `INSERT INTO mouvements_stock (
               type_produit, appareil_id, type_mouvement, quantite, sens,
               reference_type, reference_id, utilisateur_id
             ) VALUES ('appareil', ?, 'entree_reception', ?, 'entree', 'reception', ?, ?)`,
            [ligne.appareil_id, qteRecue, receptionId, req.utilisateur.id]
          );
        }
      }

      await connection.execute(
        `UPDATE receptions SET
           statut = 'validee', validee_par = ?, date_validation = NOW()
         WHERE id = ?`,
        [req.utilisateur.id, receptionId]
      );

      await connection.execute(
        `UPDATE commandes SET statut = 'recue' WHERE id = ?`,
        [recs[0].commande_id]
      );

      await connection.commit();
      res.json({
        message: 'Réception validée. Stock mis à jour.',
        reception: await chargerReception(receptionId),
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
