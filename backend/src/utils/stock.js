/**
 * Stock médicament = somme des lots disponibles.
 * Appareil = colonne quantite.
 */

async function stockMedicament(connection, medicamentId) {
  const [rows] = await connection.execute(
    `SELECT COALESCE(SUM(quantite_disponible), 0) AS stock
     FROM lots_medicaments
     WHERE medicament_id = ?`,
    [medicamentId]
  );
  return Number(rows[0]?.stock || 0);
}

async function stockAppareil(connection, appareilId) {
  const [rows] = await connection.execute(
    `SELECT quantite FROM appareils_medicaux WHERE id = ? LIMIT 1`,
    [appareilId]
  );
  if (!rows[0]) throw new Error('Appareil introuvable.');
  return Number(rows[0].quantite || 0);
}

/**
 * Décrémente le stock médicament (FIFO sur lots) et journalise.
 * Retourne le lot_id principal utilisé (premier lot touché).
 */
async function decrementerStockMedicament(connection, medicamentId, quantite, utilisateurId, referenceType, referenceId) {
  let reste = Number(quantite);
  if (reste <= 0) throw new Error('Quantité invalide.');

  const disponible = await stockMedicament(connection, medicamentId);
  if (disponible < reste) {
    throw new Error(`Stock insuffisant (disponible : ${disponible}).`);
  }

  const [lots] = await connection.execute(
    `SELECT id, quantite_disponible
     FROM lots_medicaments
     WHERE medicament_id = ? AND quantite_disponible > 0
     ORDER BY date_peremption ASC, id ASC
     FOR UPDATE`,
    [medicamentId]
  );

  let premierLotId = null;

  for (const lot of lots) {
    if (reste <= 0) break;
    const prise = Math.min(Number(lot.quantite_disponible), reste);
    await connection.execute(
      `UPDATE lots_medicaments
       SET quantite_disponible = quantite_disponible - ?
       WHERE id = ?`,
      [prise, lot.id]
    );
    if (!premierLotId) premierLotId = lot.id;
    reste -= prise;
  }

  if (reste > 0) {
    throw new Error('Stock insuffisant après répartition des lots.');
  }

  await connection.execute(
    `INSERT INTO mouvements_stock (
       type_mouvement, type_produit, medicament_id, lot_id, quantite, sens,
       reference_type, reference_id, utilisateur_id
     ) VALUES ('sortie_vente', 'medicament', ?, ?, ?, 'sortie', ?, ?, ?)`,
    [medicamentId, premierLotId, quantite, referenceType, referenceId, utilisateurId || null]
  );

  return premierLotId;
}

async function decrementerStockAppareil(connection, appareilId, quantite, utilisateurId, referenceType, referenceId) {
  const disponible = await stockAppareil(connection, appareilId);
  if (disponible < quantite) {
    throw new Error(`Stock appareil insuffisant (disponible : ${disponible}).`);
  }

  await connection.execute(
    `UPDATE appareils_medicaux
     SET quantite = quantite - ?
     WHERE id = ?`,
    [quantite, appareilId]
  );

  await connection.execute(
    `INSERT INTO mouvements_stock (
       type_mouvement, type_produit, appareil_id, quantite, sens,
       reference_type, reference_id, utilisateur_id
     ) VALUES ('sortie_vente', 'appareil', ?, ?, 'sortie', ?, ?, ?)`,
    [appareilId, quantite, referenceType, referenceId, utilisateurId || null]
  );
}

module.exports = {
  stockMedicament,
  stockAppareil,
  decrementerStockMedicament,
  decrementerStockAppareil,
};
