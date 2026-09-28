/**
 * routes/commandes.js — Commandes fournisseurs (achats).
 * Préfixe API : /api/commandes
 */
const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { prochainNumero } = require('../utils/numeros');

const router = express.Router();
router.use(authentifier);

/** Crée la ligne sequences_numerotation si absente (première commande). */
async function assurerSequence(connection, code, prefixe) {
  await connection.execute(
    `INSERT IGNORE INTO sequences_numerotation (code, prefixe, prochain_numero)
     VALUES (?, ?, 1)`,
    [code, prefixe]
  );
}

/** Charge en-tête commande + lignes_commande. */
async function chargerCommande(id) {
  const [rows] = await pool.execute(
    `SELECT c.*, f.nom AS fournisseur_nom
     FROM commandes c
     LEFT JOIN fournisseurs f ON f.id = c.fournisseur_id
     WHERE c.id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  const [lignes] = await pool.execute(
    `SELECT * FROM lignes_commande WHERE commande_id = ? ORDER BY id`,
    [id]
  );
  return { ...rows[0], lignes };
}

/** GET / — Liste des commandes avec nom fournisseur. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(
      `SELECT c.id, c.numero, c.date_commande, c.statut, c.montant_total,
              f.nom AS fournisseur_nom
       FROM commandes c
       LEFT JOIN fournisseurs f ON f.id = c.fournisseur_id
       ORDER BY c.date_commande DESC, c.id DESC`
    );
    res.json(rows);
  })
);

/** GET /:id — Détail commande et lignes. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const cmd = await chargerCommande(req.params.id);
    if (!cmd) return res.status(404).json({ message: 'Commande introuvable.' });
    res.json(cmd);
  })
);

/** POST / — Création transactionnelle (numéro CMD-*, lignes normalisées). */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const fournisseurId = Number(req.body.fournisseur_id);
    const lignes = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    if (!fournisseurId) {
      return res.status(400).json({ message: 'fournisseur_id obligatoire.' });
    }
    if (!lignes.length) {
      return res.status(400).json({ message: 'Au moins une ligne obligatoire.' });
    }

    const normalisees = lignes.map((l) => {
      const type = l.type_produit === 'appareil' ? 'appareil' : 'medicament';
      const qte = Number(l.quantite_commandee || l.quantite);
      const prix = Number(l.prix_achat_unitaire || l.prix_unitaire || 0);
      if (!qte || qte <= 0) {
        throw Object.assign(new Error('Quantité invalide.'), { status: 400 });
      }
      return {
        type_produit: type,
        medicament_id: type === 'medicament' ? l.medicament_id || null : null,
        appareil_id: type === 'appareil' ? l.appareil_id || null : null,
        designation: String(l.designation || '').trim() || 'Produit',
        quantite_commandee: qte,
        prix_achat_unitaire: prix,
        montant_ligne: qte * prix,
      };
    });

    const montantTotal = normalisees.reduce((s, l) => s + l.montant_ligne, 0);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await assurerSequence(connection, 'commande', 'CMD');
      const numero = await prochainNumero(connection, 'commande');

      const [result] = await connection.execute(
        `INSERT INTO commandes (
           fournisseur_id, numero, date_commande, statut, montant_total, notes, cree_par
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          fournisseurId,
          numero,
          req.body.date_commande || new Date().toISOString().slice(0, 10),
          req.body.statut === 'brouillon' ? 'brouillon' : 'commandee',
          montantTotal,
          String(req.body.notes || '').trim() || null,
          req.utilisateur.id,
        ]
      );

      for (const l of normalisees) {
        await connection.execute(
          `INSERT INTO lignes_commande (
             commande_id, type_produit, medicament_id, appareil_id, designation,
             quantite_commandee, prix_achat_unitaire, montant_ligne
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            l.type_produit,
            l.medicament_id,
            l.appareil_id,
            l.designation,
            l.quantite_commandee,
            l.prix_achat_unitaire,
            l.montant_ligne,
          ]
        );
      }

      await connection.commit();
      res.status(201).json(await chargerCommande(result.insertId));
    } catch (erreur) {
      await connection.rollback();
      throw erreur;
    } finally {
      connection.release();
    }
  })
);

/** Router commandes → /api/commandes */
module.exports = router;
