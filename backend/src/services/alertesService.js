/**
 * Agrégation des alertes métier (stock, lots, péremption, dettes)
 * et notification par e-mail à tous les administrateurs actifs.
 */
const { pool } = require('../config/db');
const { envoyerAlertesAdmin } = require('./email');
const {
  JOURS_ALERTE_PEREMPTION_DEFAUT,
  SEUIL_STOCK_LOT,
} = require('../config/alertes');

/** Lit le seuil péremption depuis parametres (sinon constante config). */
async function lireJoursPeremption() {
  const [rows] = await pool.execute(
    `SELECT jours_alerte_peremption FROM parametres ORDER BY id ASC LIMIT 1`
  );
  const j = Number(rows[0]?.jours_alerte_peremption);
  return j > 0 ? j : JOURS_ALERTE_PEREMPTION_DEFAUT;
}

/** Charge les quatre listes d’alertes avec seuils lus en base / config. */
async function chargerAlertesCompletes() {
  const joursPeremption = await lireJoursPeremption();
  const seuil = SEUIL_STOCK_LOT;

  // Médicaments actifs dont la somme des lots ≤ seuil stock
  const [stock] = await pool.execute(
    `SELECT m.id, m.nom, m.reference, ? AS seuil_alerte,
            COALESCE(s.stock, 0) AS stock_disponible,
            CASE WHEN COALESCE(s.stock, 0) = 0 THEN 'critique' ELSE 'attention' END AS niveau
     FROM medicaments m
     LEFT JOIN (
       SELECT medicament_id, SUM(quantite_disponible) AS stock
       FROM lots_medicaments GROUP BY medicament_id
     ) s ON s.medicament_id = m.id
     WHERE m.statut = 'actif' AND COALESCE(s.stock, 0) <= ?
     ORDER BY stock_disponible ASC`,
    [seuil, seuil]
  );

  // Lots individuels encore en stock mais sous le seuil unitaire
  const [lots] = await pool.execute(
    `SELECT l.id, l.numero_lot, l.quantite_disponible, l.date_peremption,
            m.nom AS medicament_nom, m.reference AS medicament_reference,
            ? AS seuil_alerte,
            CASE WHEN l.quantite_disponible <= 10 THEN 'critique' ELSE 'attention' END AS niveau
     FROM lots_medicaments l
     INNER JOIN medicaments m ON m.id = l.medicament_id
     WHERE l.quantite_disponible > 0 AND l.quantite_disponible <= ?
     ORDER BY l.quantite_disponible ASC, l.date_peremption ASC`,
    [seuil, seuil]
  );

  // Lots dont la date de péremption est dans la fenêtre joursPeremption
  const [peremption] = await pool.execute(
    `SELECT l.id, l.numero_lot, l.date_peremption, l.quantite_disponible,
            m.nom AS medicament_nom,
            DATEDIFF(l.date_peremption, CURDATE()) AS jours_restants,
            CASE WHEN DATEDIFF(l.date_peremption, CURDATE()) <= 0 THEN 'critique' ELSE 'attention' END AS niveau
     FROM lots_medicaments l
     INNER JOIN medicaments m ON m.id = l.medicament_id
     WHERE l.quantite_disponible > 0
       AND DATEDIFF(l.date_peremption, CURDATE()) <= ?
     ORDER BY l.date_peremption ASC`,
    [joursPeremption]
  );

  // Factures avec solde client restant dû
  const [dettes] = await pool.execute(
    `SELECT f.id, f.numero, f.montant_reste, f.date_facture, c.nom AS client_nom
     FROM factures f
     LEFT JOIN clients c ON c.id = f.client_id
     WHERE f.montant_reste > 0
     ORDER BY f.montant_reste DESC`
  );

  return {
    stock,
    lots,
    peremption,
    dettes,
    seuils: {
      jours_alerte_peremption: joursPeremption,
      seuil_stock_lot: seuil,
    },
  };
}

/** Tous les admins actifs avec e-mail (pour alertes). */
async function emailsAdminsActifs() {
  const [rows] = await pool.execute(
    `SELECT u.id, u.email, u.nom_complet
     FROM utilisateurs u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE r.code = 'ADMIN' AND u.actif = 1
       AND u.email IS NOT NULL AND u.email <> ''
     ORDER BY u.id ASC`
  );
  return rows;
}

/** @deprecated — préfère emailsAdminsActifs */
async function emailAdminActif() {
  const liste = await emailsAdminsActifs();
  return liste[0] || null;
}

/**
 * Envoie les alertes à TOUS les administrateurs actifs (chaque e-mail de compte).
 */
async function notifierAlertesAdmin() {
  const admins = await emailsAdminsActifs();
  if (!admins.length) {
    throw new Error(
      'Aucun e-mail admin trouvé. Créez des comptes admin avec une adresse e-mail.'
    );
  }

  const alertes = await chargerAlertesCompletes();
  const totalAlertes =
    alertes.stock.length +
    alertes.lots.length +
    alertes.peremption.length +
    alertes.dettes.length;

  if (totalAlertes === 0) {
    return {
      mode: 'aucune',
      total: 0,
      admin_emails: admins.map((a) => a.email),
      admin_email: admins.map((a) => a.email).join(', '),
      details: { stock: 0, lots: 0, peremption: 0, dettes: 0 },
    };
  }

  // Envoi individuel : un e-mail par compte admin (échec isolé par destinataire)
  const envois = [];
  for (const admin of admins) {
    try {
      const resultat = await envoyerAlertesAdmin(admin.email, alertes);
      envois.push({ email: admin.email, ...resultat });
    } catch (e) {
      envois.push({ email: admin.email, mode: 'erreur', erreur: e.message });
    }
  }

  const ok = envois.filter((e) => e.mode !== 'erreur' && e.mode !== 'aucune');
  const mode = ok[0]?.mode || envois[0]?.mode || 'envoye';

  return {
    mode,
    total: totalAlertes,
    admin_emails: admins.map((a) => a.email),
    admin_email: admins.map((a) => a.email).join(', '),
    nb_destinataires: admins.length,
    envois,
    details: {
      stock: alertes.stock.length,
      lots: alertes.lots.length,
      peremption: alertes.peremption.length,
      dettes: alertes.dettes.length,
    },
  };
}

/** Exports pour stats, server.js (cron) et tests manuels. */
module.exports = {
  chargerAlertesCompletes,
  emailAdminActif,
  emailsAdminsActifs,
  notifierAlertesAdmin,
  lireJoursPeremption,
};
