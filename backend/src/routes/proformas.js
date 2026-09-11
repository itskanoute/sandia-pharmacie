const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { prochainNumero } = require('../utils/numeros');

const router = express.Router();
router.use(authentifier);

async function chargerProforma(id) {
  const [rows] = await pool.execute(
    `SELECT p.*, c.nom AS client_nom, c.telephone AS client_telephone
     FROM proformas p
     LEFT JOIN clients c ON c.id = p.client_id
     WHERE p.id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;

  const [lignes] = await pool.execute(
    `SELECT lp.*,
            COALESCE(m.forme, '') AS forme,
            COALESCE(m.dosage, '') AS dosage
     FROM lignes_proforma lp
     LEFT JOIN medicaments m ON m.id = lp.medicament_id
     WHERE lp.proforma_id = ?
     ORDER BY lp.id ASC`,
    [id]
  );
  return { ...rows[0], lignes };
}

function normaliserLignes(lignes) {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw Object.assign(new Error('Au moins une ligne produit est obligatoire.'), { status: 400 });
  }

  return lignes.map((l) => {
    const type = l.type_produit === 'appareil' ? 'appareil' : 'medicament';
    const quantite = Number(l.quantite);
    const prix = Number(l.prix_unitaire);
    if (!Number.isFinite(quantite) || quantite <= 0) {
      throw Object.assign(new Error('Quantité invalide sur une ligne.'), { status: 400 });
    }
    if (!Number.isFinite(prix) || prix < 0) {
      throw Object.assign(new Error('Prix unitaire invalide.'), { status: 400 });
    }
    const designation = String(l.designation || '').trim();
    if (!designation) {
      throw Object.assign(new Error('Désignation obligatoire sur chaque ligne.'), { status: 400 });
    }
    return {
      type_produit: type,
      medicament_id: type === 'medicament' ? l.medicament_id || null : null,
      appareil_id: type === 'appareil' ? l.appareil_id || null : null,
      designation,
      quantite,
      prix_unitaire: prix,
      montant_ligne: quantite * prix,
    };
  });
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const statut = String(req.query.statut || '').trim();
    let sql = `
      SELECT p.id, p.numero, p.client_id, p.type_client, p.date_proforma,
             p.date_commande, p.date_edition, p.montant_total, p.statut, p.notes,
             c.nom AS client_nom
      FROM proformas p
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE 1=1`;
    const params = [];
    if (statut) {
      sql += ` AND p.statut = ?`;
      params.push(statut);
    }
    sql += ` ORDER BY p.date_proforma DESC, p.id DESC`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const pf = await chargerProforma(req.params.id);
    if (!pf) return res.status(404).json({ message: 'Pro forma introuvable.' });
    res.json(pf);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const lignes = normaliserLignes(req.body.lignes);
    const montantTotal = lignes.reduce((s, l) => s + l.montant_ligne, 0);
    const typeClient = req.body.type_client === 'revendeur' ? 'revendeur' : 'ordinaire';
    const datePf = req.body.date_proforma || new Date().toISOString().slice(0, 10);
    const statut = ['brouillon', 'emis'].includes(req.body.statut) ? req.body.statut : 'emis';

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const numero = await prochainNumero(connection, 'proforma');

      const [result] = await connection.execute(
        `INSERT INTO proformas (
           numero, client_id, type_client, date_proforma, date_commande, date_edition,
           montant_total, statut, notes, cree_par
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numero,
          req.body.client_id || null,
          typeClient,
          datePf,
          req.body.date_commande || datePf,
          req.body.date_edition || datePf,
          montantTotal,
          statut,
          String(req.body.notes || '').trim() || null,
          req.utilisateur.id,
        ]
      );

      const proformaId = result.insertId;
      for (const l of lignes) {
        await connection.execute(
          `INSERT INTO lignes_proforma (
             proforma_id, type_produit, medicament_id, appareil_id,
             designation, quantite, prix_unitaire, montant_ligne
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            proformaId,
            l.type_produit,
            l.medicament_id,
            l.appareil_id,
            l.designation,
            l.quantite,
            l.prix_unitaire,
            l.montant_ligne,
          ]
        );
      }

      await connection.commit();
      const pf = await chargerProforma(proformaId);
      res.status(201).json(pf);
    } catch (erreur) {
      await connection.rollback();
      throw erreur;
    } finally {
      connection.release();
    }
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existant = await chargerProforma(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Pro forma introuvable.' });
    if (existant.statut === 'annule' || existant.statut === 'converti_vente') {
      return res.status(400).json({ message: 'Ce pro forma ne peut plus être modifié.' });
    }

    const lignes = normaliserLignes(req.body.lignes);
    const montantTotal = lignes.reduce((s, l) => s + l.montant_ligne, 0);
    const typeClient = req.body.type_client === 'revendeur' ? 'revendeur' : 'ordinaire';
    const statut = ['brouillon', 'emis', 'annule'].includes(req.body.statut)
      ? req.body.statut
      : existant.statut;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `UPDATE proformas SET
           client_id = ?, type_client = ?, date_proforma = ?, date_commande = ?,
           date_edition = ?, montant_total = ?, statut = ?, notes = ?
         WHERE id = ?`,
        [
          req.body.client_id || null,
          typeClient,
          req.body.date_proforma || existant.date_proforma,
          req.body.date_commande || existant.date_commande,
          req.body.date_edition || existant.date_edition,
          montantTotal,
          statut,
          String(req.body.notes || '').trim() || null,
          req.params.id,
        ]
      );

      await connection.execute(`DELETE FROM lignes_proforma WHERE proforma_id = ?`, [
        req.params.id,
      ]);

      for (const l of lignes) {
        await connection.execute(
          `INSERT INTO lignes_proforma (
             proforma_id, type_produit, medicament_id, appareil_id,
             designation, quantite, prix_unitaire, montant_ligne
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.params.id,
            l.type_produit,
            l.medicament_id,
            l.appareil_id,
            l.designation,
            l.quantite,
            l.prix_unitaire,
            l.montant_ligne,
          ]
        );
      }

      await connection.commit();
      res.json(await chargerProforma(req.params.id));
    } catch (erreur) {
      await connection.rollback();
      throw erreur;
    } finally {
      connection.release();
    }
  })
);

/**
 * Transforme un pro forma en vente + facture (baisse le stock).
 * Body: { moyen_paiement, montant_paye_initial }
 */
router.post(
  '/:id/facturer',
  asyncHandler(async (req, res) => {
    const { prochainNumero } = require('../utils/numeros');
    const { calculerStatutPaiement } = require('../utils/statutPaiement');
    const {
      decrementerStockMedicament,
      decrementerStockAppareil,
    } = require('../utils/stock');

    const pf = await chargerProforma(req.params.id);
    if (!pf) return res.status(404).json({ message: 'Pro forma introuvable.' });
    if (pf.statut === 'converti_vente') {
      return res.status(400).json({ message: 'Ce pro forma a déjà été facturé.' });
    }
    if (pf.statut === 'annule') {
      return res.status(400).json({ message: 'Pro forma annulé.' });
    }
    if (!pf.lignes?.length) {
      return res.status(400).json({ message: 'Pro forma sans lignes.' });
    }

    const moyenPaiement = String(req.body.moyen_paiement || '').trim() || null;
    if (!moyenPaiement) {
      return res.status(400).json({ message: 'Choisissez un moyen de paiement.' });
    }

    const montantTotal = Number(pf.montant_total) || 0;
    const montantPayeInitial = Math.min(
      Math.max(0, Number(req.body.montant_paye_initial) || 0),
      montantTotal
    );
    const dateVente = new Date();
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
         ) VALUES (?, ?, ?, ?, ?, 0, ?, 'validee', ?, ?)`,
        [
          numeroVente,
          pf.client_id,
          pf.type_client || 'ordinaire',
          dateVente,
          montantTotal,
          montantTotal,
          `Depuis pro forma ${pf.numero}`,
          req.utilisateur.id,
        ]
      );
      const venteId = venteResult.insertId;

      for (const l of pf.lignes) {
        let lotId = null;
        if (l.type_produit === 'medicament' && l.medicament_id) {
          lotId = await decrementerStockMedicament(
            connection,
            l.medicament_id,
            l.quantite,
            req.utilisateur.id,
            'vente',
            venteId
          );
        } else if (l.type_produit === 'appareil' && l.appareil_id) {
          await decrementerStockAppareil(
            connection,
            l.appareil_id,
            l.quantite,
            req.utilisateur.id,
            'vente',
            venteId
          );
        } else {
          throw Object.assign(
            new Error('Ligne pro forma invalide (produit manquant).'),
            { status: 400 }
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

      const { montant_paye, montant_reste, statut_paiement } = calculerStatutPaiement(
        montantTotal,
        montantPayeInitial
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
          pf.client_id,
          pf.type_client || 'ordinaire',
          dateStr,
          pf.date_commande || dateStr,
          dateStr,
          montantTotal,
          montant_paye,
          montant_reste,
          statut_paiement,
          moyenPaiement,
          `Depuis pro forma ${pf.numero}`,
          req.utilisateur.id,
        ]
      );
      const factureId = facResult.insertId;

      for (const l of pf.lignes) {
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
            l.forme || null,
            l.dosage || null,
            l.quantite,
            l.prix_unitaire,
            l.montant_ligne,
          ]
        );
      }

      if (montantPayeInitial > 0) {
        const numeroPay = await prochainNumero(connection, 'paiement');
        await connection.execute(
          `INSERT INTO paiements (
             numero, facture_id, client_id, montant, date_paiement,
             moyen_paiement, notes, enregistre_par
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            numeroPay,
            factureId,
            pf.client_id,
            montantPayeInitial,
            dateVente,
            moyenPaiement,
            `Paiement depuis pro forma ${pf.numero}`,
            req.utilisateur.id,
          ]
        );
      }

      await connection.execute(
        `UPDATE proformas SET statut = 'converti_vente' WHERE id = ?`,
        [pf.id]
      );

      await connection.commit();

      setImmediate(() => {
        const { notifierAlertesAdmin } = require('../services/alertesService');
        notifierAlertesAdmin().catch(() => {});
      });

      res.status(201).json({
        message: `Facture ${numeroFacture} créée depuis le pro forma ${pf.numero}.`,
        vente: { id: venteId, numero: numeroVente },
        facture: {
          id: factureId,
          numero: numeroFacture,
          montant_total: montantTotal,
          montant_paye,
          montant_reste,
          statut_paiement,
          moyen_paiement: moyenPaiement,
        },
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
