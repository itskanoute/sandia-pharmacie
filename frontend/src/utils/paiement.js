/** Calculs paiement / dette — montants en FCFA (entiers) */

// Somme des encaissements enregistrés sur une facture
export function totalPaye(paiements) {
  return (paiements || []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
}

// Solde dû après déduction des paiements (minimum 0)
export function resteAPayer(montantTotal, paiements) {
  const reste = (Number(montantTotal) || 0) - totalPaye(paiements);
  return reste > 0 ? reste : 0;
}

// Code statut : non_paye | partiellement_paye | paye
export function statutPaiement(montantTotal, paiements) {
  const paye = totalPaye(paiements);
  const total = Number(montantTotal) || 0;
  // Aucun encaissement
  if (paye <= 0) return 'non_paye';
  // Soldé ou trop-perçu compté comme payé
  if (paye >= total) return 'paye';
  return 'partiellement_paye';
}

/** Normalise une facture API ou ancienne maquette pour l’affichage document. */
export function enrichirFacture(facture) {
  if (!facture) return facture;

  // Si le backend a déjà calculé les montants, on les reprend tels quels
  if (
    facture.montant_paye != null &&
    facture.montant_reste != null &&
    facture.statut_paiement
  ) {
    return {
      ...facture,
      reste_a_payer: Number(facture.montant_reste),
      montant_paye: Number(facture.montant_paye),
    };
  }

  // Recalcul côté client à partir du tableau paiements[]
  const paye = totalPaye(facture.paiements);
  const reste = resteAPayer(facture.montant_total, facture.paiements);
  return {
    ...facture,
    montant_paye: paye,
    reste_a_payer: reste,
    statut_paiement: statutPaiement(facture.montant_total, facture.paiements),
  };
}
