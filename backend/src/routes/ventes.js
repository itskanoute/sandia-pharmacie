const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { prochainNumero } = require('../utils/numeros');
const { calculerStatutPaiement } = require('../utils/statutPaiement');
const {
  decrementerStockMedicament,
  decrementerStockAppareil,
} = require('../utils/stock');

const router = express.Router();
router.use(authentifier);

function normaliserLignes(lignes) {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw Object.assign(new Error('Le panier est vide.'), { status: 400 });
  }

  return lignes.map((l) => {
    const type = l.type_produit === 'appareil' ? 'appareil' : 'medicament';
    const quantite = Number(l.quantite);
    const prix = Number(l.prix_unitaire);
    if (!Number.isFinite(quantite) || quantite <= 0) {
      throw Object.assign(new Error('Quantité invalide.'), { status: 400 });
    }
    if (!Number.isFinite(prix) || prix < 0) {
      throw Object.assign(new Error('Prix unitaire invalide.'), { status: 400 });
    }
    const designation = String(l.designation || '').trim();
    if (!designation) {
      throw Object.assign(new Error('Désignation obligatoire.'), { status: 400 });
    }
    if (type === 'medicament' && !l.medicament_id) {
      throw Object.assign(new Error('medicament_id manquant.'), { status: 400 });
    }
    if (type === 'appareil' && !l.appareil_id) {
      throw Object.assign(new Error('appareil_id manquant.'), { status: 400 });
    }
    return {
      type_produit: type,
      medicament_id: type === 'medicament' ? Number(l.medicament_id) : null,
      appareil_id: type === 'appareil' ? Number(l.appareil_id) : null,
      designation,
      forme: String(l.forme || '').trim() || null,
      dosage: String(l.dosage || '').trim() || null,
      quantite,
      prix_unitaire: prix,
      montant_ligne: quantite * prix,
    };
  });
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(
      `SELECT v.id, v.numero, v.client_id, v.type_client, v.date_vente,
              v.montant_brut, v.remise, v.montant_total, v.statut,
              c.nom AS client_nom
       FROM ventes v
       LEFT JOIN clients c ON c.id = v.client_id
       ORDER BY v.date_vente DESC, v.id DESC
       LIMIT 200`
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT v.*, c.nom AS client_nom
       FROM ventes v
       LEFT JOIN clients c ON c.id = v.client_id
       WHERE v.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Vente introuvable.' });

    const [lignes] = await pool.execute(
      `SELECT * FROM lignes_vente WHERE vente_id = ? ORDER BY id ASC`,
      [req.params.id]
    );
    res.json({ ...rows[0], lignes });
  })
);

/**
 * Valide une vente : baisse le stock, crée vente + facture (+ paiement initial optionnel).
 * Body: { client_id, type_client, remise, notes, moyen_paiement, montant_paye_initial, lignes: [...] }
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const lignes = normaliserLignes(req.body.lignes);
    const montantBrut = lignes.reduce((s, l) => s + l.montant_ligne, 0);
    const remise = Math.max(0, Number(req.body.remise) || 0);
    const montantTotal = Math.max(0, montantBrut - remise);
    const typeClient = req.body.type_client === 'revendeur' ? 'revendeur' : 'ordinaire';
    const moyenPaiement = String(req.body.moyen_paiement || '').trim() || null;
    const montantPayeInitial = Math.max(0, Number(req.body.montant_paye_initial) || 0);
    const dateVente = req.body.date_vente ? new Date(req.body.date_vente) : new Date();
    const dateStr = dateVente.toISOString().slice(0, 10);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const numeroVente = await prochainNumero(connection, 'vente');
      const numeroFacture = await prochainNumero(connection, 'facture');

      const [venteResult] = await connection.execute(
        `INSERT INTO ventes (
           numero, client_id, type_client, date_vente,
           montant_brut, remise, montant_total, statut, notes, vendeur_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'validee', ?, ?)`,
        [
          numeroVente,
          req.body.client_id || null,
          typeClient,
          dateVente,
          montantBrut,
          remise,
          montantTotal,
          String(req.body.notes || '').trim() || null,
          req.utilisateur.id,
        ]
      );
      const venteId = venteResult.insertId;

      for (const l of lignes) {
        let lotId = null;
        if (l.type_produit === 'medicament') {
          lotId = await decrementerStockMedicament(
            connection,
            l.medicament_id,
            l.quantite,
            req.utilisateur.id,
            'vente',
            venteId
          );
        } else {
          await decrementerStockAppareil(
            connection,
            l.appareil_id,
            l.quantite,
            req.utilisateur.id,
            'vente',
            venteId
          );
        }

        await connection.execute(
          `INSERT INTO lignes_vente (
             vente_id, type_produit, medicament_id, appareil_id, lot_id,
             designation, quantite, prix_unitaire, montant_ligne
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            venteId,
            l.type_produit,
            l.medicament_id,
            l.appareil_id,
            lotId,
            l.designation,
            l.quantite,
            l.prix_unitaire,
            l.montant_ligne,
          ]
        );
      }

      const paye = Math.min(montantPayeInitial, montantTotal);
      const { montant_paye, montant_reste, statut_paiement } = calculerStatutPaiement(
        montantTotal,
        paye
      );

      const [facResult] = await connection.execute(
        `INSERT INTO factures (
           numero, vente_id, client_id, type_client, date_facture,
           date_commande, date_edition, montant_total, montant_paye, montant_reste,
           statut_paiement, moyen_paiement, notes, cree_par
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numeroFacture,
          venteId,
          req.body.client_id || null,
          typeClient,
          dateStr,
          req.body.date_commande || dateStr,
          dateStr,
          montantTotal,
          montant_paye,
          montant_reste,
          statut_paiement,
          moyenPaiement,
          String(req.body.notes || '').trim() || null,
          req.utilisateur.id,
        ]
      );
      const factureId = facResult.insertId;

      for (const l of lignes) {
        await connection.execute(
          `INSERT INTO lignes_facture (
             facture_id, type_produit, medicament_id, appareil_id,
             designation, forme, dosage, quantite, prix_unitaire, montant_ligne
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            factureId,
            l.type_produit,
            l.medicament_id,
            l.appareil_id,
            l.designation,
            l.forme,
            l.dosage,
            l.quantite,
            l.prix_unitaire,
            l.montant_ligne,
          ]
        );
      }

      let paiement = null;
      if (paye > 0) {
        const numeroPay = await prochainNumero(connection, 'paiement');
        const [payResult] = await connection.execute(
          `INSERT INTO paiements (
             numero, facture_id, client_id, montant, date_paiement,
             moyen_paiement, notes, enregistre_par
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            numeroPay,
            factureId,
            req.body.client_id || null,
            paye,
            dateVente,
            moyenPaiement,
            'Paiement à la validation de vente',
            req.utilisateur.id,
          ]
        );
        paiement = { id: payResult.insertId, numero: numeroPay, montant: paye };
      }

      await connection.commit();

      // Alerte e-mail admin si stock bas après la vente (en arrière-plan)
      setImmediate(() => {
        const { notifierAlertesAdmin } = require('../services/alertesService');
        notifierAlertesAdmin().catch((e) =>
          console.warn('[ALERTES après vente]', e.message)
        );
      });

      res.status(201).json({
        message: 'Vente validée. Stock mis à jour. Facture créée.',
        vente: { id: venteId, numero: numeroVente, montant_total: montantTotal },
        facture: {
          id: factureId,
          numero: numeroFacture,
          montant_total: montantTotal,
          montant_paye,
          montant_reste,
          statut_paiement,
          moyen_paiement: moyenPaiement,
        },
        paiement,
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
