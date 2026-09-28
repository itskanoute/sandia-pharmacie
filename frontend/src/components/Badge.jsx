/**
 * Composants utilitaires de badges : couleur et libellés des statuts métier.
 */

// Affiche une pastille colorée (stock, paiement, commande, etc.)
export function Badge({ children, tone = 'neutre' }) {
  // tone → classe CSS badge-ok | badge-attention | …
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// Convertit un code statut API en variante CSS (ok, attention, critique…)
export function statutTone(statut) {
  // Table de correspondance code métier → ton visuel
  const map = {
    actif: 'ok',
    disponible: 'ok',
    valide: 'ok',
    validee: 'ok',
    emis: 'ok',
    conforme: 'ok',
    ok: 'ok',
    stock_faible: 'attention',
    bientot_perime: 'attention',
    attention: 'attention',
    en_controle: 'attention',
    commandee: 'info',
    partiellement_recue: 'attention',
    brouillon: 'neutre',
    emis: 'ok',
    converti_vente: 'info',
    annule: 'critique',
    non_paye: 'critique',
    partiellement_paye: 'attention',
    paye: 'ok',
    rupture: 'critique',
    perime: 'critique',
    critique: 'critique',
    indisponible: 'critique',
    annulee: 'critique',
    defectueux: 'critique',
    ordinaire: 'info',
    revendeur: 'ok',
  };
  // Statut inconnu → pastille neutre
  return map[statut] || 'neutre';
}

// Libellé français lisible pour les tableaux et documents
export function libelleStatut(statut) {
  const map = {
    actif: 'Actif',
    archive: 'Archivé',
    disponible: 'Disponible',
    vendu: 'Vendu',
    defectueux: 'Défectueux',
    retourne: 'Retourné',
    reserve: 'Réservé',
    indisponible: 'Indisponible',
    valide: 'Valide',
    bientot_perime: 'Bientôt périmé',
    perime: 'Périmé',
    en_controle: 'En contrôle',
    validee: 'Validée',
    rejetee: 'Rejetée',
    annulee: 'Annulée',
    commandee: 'Commandée',
    partiellement_recue: 'Partiellement reçue',
    recue: 'Reçue',
    brouillon: 'Brouillon',
    emis: 'Émis',
    converti_vente: 'Converti en vente',
    annule: 'Annulé',
    non_paye: 'Non payé',
    partiellement_paye: 'Partiellement payé',
    paye: 'Payé',
    ordinaire: 'Client ordinaire',
    revendeur: 'Revendeur',
    rupture: 'Rupture',
    stock_faible: 'Stock faible',
    entree_reception: 'Entrée (réception)',
    sortie_vente: 'Sortie (vente)',
  };
  // Fallback : afficher le code brut si non mappé
  return map[statut] || statut;
}
