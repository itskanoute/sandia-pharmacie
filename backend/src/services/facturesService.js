/**
 * facturesService.js — Chargement complet d’une facture (en-tête, lignes, paiements).
 */
const { pool } = require('../config/db');

/**
 * Récupère une facture par id avec jointures client/vente et détail des lignes + paiements.
 * @param {number|string} id — Identifiant facture
 * @param {object} [connection=pool] — Connexion ou pool (transactions)
 * @returns {Promise<object|null>}
 */
async function chargerFacture(id, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT f.*, c.nom AS client_nom, c.telephone AS client_telephone,
            c.adresse AS client_adresse, v.numero AS vente_numero
     FROM factures f
     LEFT JOIN clients c ON c.id = f.client_id
     LEFT JOIN ventes v ON v.id = f.vente_id
     WHERE f.id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;

  const [lignes] = await connection.execute(
    `SELECT lf.*,
            COALESCE(lf.forme, m.forme, '') AS forme,
            COALESCE(lf.dosage, m.dosage, '') AS dosage
     FROM lignes_facture lf
     LEFT JOIN medicaments m ON m.id = lf.medicament_id
     WHERE lf.facture_id = ?
     ORDER BY lf.id ASC`,
    [id]
  );
  const [paiements] = await connection.execute(
    `SELECT * FROM paiements WHERE facture_id = ? ORDER BY date_paiement ASC, id ASC`,
    [id]
  );
  return { ...rows[0], lignes, paiements };
}

/** Service lecture facture (routes factures, paiements). */
module.exports = { chargerFacture };
