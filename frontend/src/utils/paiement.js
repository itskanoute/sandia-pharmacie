/** Calculs paiement / dette — montants en FCFA (entiers) */

export function totalPaye(paiements) {
  return (paiements || []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
}

export function resteAPayer(montantTotal, paiements) {
  const reste = (Number(montantTotal) || 0) - totalPaye(paiements);
  return reste > 0 ? reste : 0;
}

export function statutPaiement(montantTotal, paiements) {
  const paye = totalPaye(paiements);
  const total = Number(montantTotal) || 0;
  if (paye <= 0) return 'non_paye';
  if (paye >= total) return 'paye';
  return 'partiellement_paye';
}

/** Normalise une facture API ou ancienne maquette. */
export function enrichirFacture(facture) {
  if (!facture) return facture;

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

  const paye = totalPaye(facture.paiements);
  const reste = resteAPayer(facture.montant_total, facture.paiements);
  return {
    ...facture,
    montant_paye: paye,
    reste_a_payer: reste,
    statut_paiement: statutPaiement(facture.montant_total, facture.paiements),
  };
}
