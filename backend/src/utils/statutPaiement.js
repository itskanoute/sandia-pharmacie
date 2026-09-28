/**
 * statutPaiement.js — Calcul du solde et du statut de paiement d’une facture.
 * Utilisé lors des ventes, pro formas facturés et enregistrements de paiements.
 */

/**
 * Déduit montant payé, reste dû et libellé de statut à partir du total et des encaissements.
 * @returns {{ montant_paye: number, montant_reste: number, statut_paiement: string }}
 */
function calculerStatutPaiement(montantTotal, montantPaye) {
  const total = Number(montantTotal) || 0;
  const paye = Number(montantPaye) || 0;
  const reste = Math.max(0, total - paye);

  let statut = 'non_paye';
  if (paye <= 0) statut = 'non_paye';
  else if (paye >= total) statut = 'paye';
  else statut = 'partiellement_paye';

  return { montant_paye: Math.min(paye, total), montant_reste: reste, statut_paiement: statut };
}

/** Calcul statut facture (payé / partiel / impayé). */
module.exports = { calculerStatutPaiement };
