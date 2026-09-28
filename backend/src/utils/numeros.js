/**
 * Génère le prochain numéro (ex. PF-000001) via sequences_numerotation.
 * À appeler dans une transaction (connexion dédiée).
 */
/** Incrémente atomiquement la séquence (verrou FOR UPDATE) et formate le numéro. */
async function prochainNumero(connection, codeSequence) {
  const [rows] = await connection.execute(
    `SELECT code, prefixe, prochain_numero
     FROM sequences_numerotation
     WHERE code = ?
     FOR UPDATE`,
    [codeSequence]
  );

  if (!rows[0]) {
    throw new Error(`Séquence introuvable : ${codeSequence}. Importe database/update_facturation.sql`);
  }

  const { prefixe, prochain_numero: n } = rows[0];
  const numero = `${prefixe}-${String(n).padStart(6, '0')}`;

  await connection.execute(
    `UPDATE sequences_numerotation
     SET prochain_numero = prochain_numero + 1
     WHERE code = ?`,
    [codeSequence]
  );

  return numero;
}

/** Export utilitaire numérotation facturation / ventes. */
module.exports = { prochainNumero };
