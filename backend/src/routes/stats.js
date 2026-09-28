/**
 * routes/stats.js — Tableau de bord, finance, alertes et envoi e-mail manuel.
 * Préfixe API : /api/stats
 */
const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

/**
 * Cron hébergement (sans JWT) : réveille Render et envoie les alertes péremption/stock.
 * Header requis : x-cron-secret: <CRON_SECRET>
 * Ex. cron-job.org → POST https://ton-app.onrender.com/api/stats/alertes/cron
 */
router.post(
  '/alertes/cron',
  asyncHandler(async (req, res) => {
    const attendu = String(process.env.CRON_SECRET || '').trim();
    const fourni = String(req.get('x-cron-secret') || req.query.secret || '').trim();
    if (!attendu || fourni !== attendu) {
      return res.status(401).json({ message: 'Non autorisé.' });
    }
    const { executerCycleAlertes } = require('../services/alertesScheduler');
    const resultat = await executerCycleAlertes('cron');
    res.json({
      message:
        resultat.mode === 'aucune'
          ? 'Aucune alerte à envoyer.'
          : `Alertes traitées (${resultat.details?.peremption || 0} péremption).`,
      ...resultat,
    });
  })
);

router.use(authentifier);

/** GET /dashboard — KPI CA, ventes, clients et top alertes (stock, péremption, dettes). */
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [[ca]] = await pool.execute(
      `SELECT COALESCE(SUM(montant_paye), 0) AS encaissements,
              COALESCE(SUM(montant_reste), 0) AS dettes,
              COALESCE(SUM(montant_total), 0) AS facture_total,
              COUNT(*) AS nb_factures
       FROM factures`
    );

    const [[ventes]] = await pool.execute(
      `SELECT COUNT(*) AS nb, COALESCE(SUM(montant_total), 0) AS montant
       FROM ventes WHERE statut = 'validee'`
    );

    const [[clients]] = await pool.execute(
      `SELECT COUNT(*) AS nb FROM clients WHERE actif = 1`
    );

    const { SEUIL_STOCK_LOT } = require('../config/alertes');
    const { lireJoursPeremption } = require('../services/alertesService');
    const joursPeremption = await lireJoursPeremption();

    const [ruptures] = await pool.execute(
      `SELECT m.id, m.nom, ? AS seuil_alerte, COALESCE(s.stock, 0) AS stock
       FROM medicaments m
       LEFT JOIN (
         SELECT medicament_id, SUM(quantite_disponible) AS stock
         FROM lots_medicaments GROUP BY medicament_id
       ) s ON s.medicament_id = m.id
       WHERE m.statut = 'actif' AND COALESCE(s.stock, 0) <= ?
       ORDER BY stock ASC
       LIMIT 10`,
      [SEUIL_STOCK_LOT, SEUIL_STOCK_LOT]
    );

    const [perimes] = await pool.execute(
      `SELECT l.id, l.numero_lot, l.date_peremption, l.quantite_disponible, m.nom AS medicament_nom,
              DATEDIFF(l.date_peremption, CURDATE()) AS jours_restants
       FROM lots_medicaments l
       INNER JOIN medicaments m ON m.id = l.medicament_id
       WHERE l.quantite_disponible > 0
         AND DATEDIFF(l.date_peremption, CURDATE()) <= ?
       ORDER BY l.date_peremption ASC
       LIMIT 10`,
      [joursPeremption]
    );

    const [dettes] = await pool.execute(
      `SELECT f.id, f.numero, f.montant_reste, f.date_facture, c.nom AS client_nom
       FROM factures f
       LEFT JOIN clients c ON c.id = f.client_id
       WHERE f.montant_reste > 0
       ORDER BY f.date_facture ASC
       LIMIT 10`
    );

    res.json({
      encaissements: Number(ca.encaissements),
      dettes: Number(ca.dettes),
      facture_total: Number(ca.facture_total),
      nb_factures: Number(ca.nb_factures),
      nb_ventes: Number(ventes.nb),
      montant_ventes: Number(ventes.montant),
      nb_clients: Number(clients.nb),
      alertes_stock: ruptures,
      alertes_peremption: perimes,
      dettes_recentes: dettes,
    });
  })
);

/** GET /finance — Agrégats factures et 50 derniers paiements. */
router.get(
  '/finance',
  asyncHandler(async (_req, res) => {
    const [[totaux]] = await pool.execute(
      `SELECT COALESCE(SUM(montant_total), 0) AS chiffre_affaires,
              COALESCE(SUM(montant_paye), 0) AS encaissements,
              COALESCE(SUM(montant_reste), 0) AS creances
       FROM factures`
    );

    const [parStatut] = await pool.execute(
      `SELECT statut_paiement, COUNT(*) AS nb, COALESCE(SUM(montant_total), 0) AS montant
       FROM factures
       GROUP BY statut_paiement`
    );

    const [paiements] = await pool.execute(
      `SELECT p.id, p.numero, p.montant, p.date_paiement, p.moyen_paiement,
              f.numero AS facture_numero, c.nom AS client_nom
       FROM paiements p
       INNER JOIN factures f ON f.id = p.facture_id
       LEFT JOIN clients c ON c.id = p.client_id
       ORDER BY p.date_paiement DESC
       LIMIT 50`
    );

    res.json({
      chiffre_affaires: Number(totaux.chiffre_affaires),
      encaissements: Number(totaux.encaissements),
      creances: Number(totaux.creances),
      par_statut: parStatut,
      paiements_recents: paiements,
    });
  })
);

/** GET /alertes — Jeu complet d’alertes (délègue à alertesService). */
router.get(
  '/alertes',
  asyncHandler(async (_req, res) => {
    const { chargerAlertesCompletes } = require('../services/alertesService');
    res.json(await chargerAlertesCompletes());
  })
);

/** Envoie les alertes par e-mail à l'administrateur. */
router.post(
  '/alertes/notifier',
  asyncHandler(async (_req, res) => {
    const { notifierAlertesAdmin } = require('../services/alertesService');
    const resultat = await notifierAlertesAdmin();

    if (resultat.mode === 'aucune') {
      return res.json({
        message: 'Aucune alerte à envoyer pour le moment.',
        ...resultat,
      });
    }

    if (resultat.mode === 'dev') {
      return res.json({
        message: `Alertes préparées pour ${resultat.nb_destinataires || 1} admin(s) : ${resultat.admin_email} (e-mail non configuré : ajoute BREVO_API_KEY sur Render).`,
        ...resultat,
      });
    }

    if (resultat.mode === 'erreur' || resultat.envois?.every((e) => e.mode === 'erreur')) {
      const detail = resultat.envois?.find((e) => e.erreur)?.erreur || 'échec d’envoi';
      return res.status(502).json({
        message: `Échec d’envoi des alertes : ${detail}`,
        ...resultat,
      });
    }

    res.json({
      message: `Alertes envoyées par e-mail à ${resultat.nb_destinataires || 1} administrateur(s) : ${resultat.admin_email}.`,
      ...resultat,
    });
  })
);

/** Router statistiques → /api/stats */
module.exports = router;
