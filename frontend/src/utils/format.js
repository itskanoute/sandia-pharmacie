/** Formatage FCFA — Mali (affichage tableaux et KPI) */

/** Montant numérique → chaîne « 1 234 FCFA » locale fr-FR */
export function formatFcfa(montant) {
  // NaN ou vide → 0
  const n = Number(montant) || 0;
  return `${n.toLocaleString('fr-FR')} FCFA`;
}

/** Date ISO → JJ/MM/AAAA (fuseau Bamako) pour listes */
export function formatDate(dateIso) {
  // Valeur absente : tiret d’affichage
  if (!dateIso) return '—';
  const d = new Date(dateIso);
  // Date invalide : renvoyer la chaîne brute
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Bamako' });
}

/** Horodatage complet (mouvements stock, paiements) */
export function formatDateHeure(dateIso) {
  if (!dateIso) return '—';
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleString('fr-FR', { timeZone: 'Africa/Bamako' });
}
