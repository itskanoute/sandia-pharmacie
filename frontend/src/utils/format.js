/** Formatage FCFA — Mali */
export function formatFcfa(montant) {
  const n = Number(montant) || 0;
  return `${n.toLocaleString('fr-FR')} FCFA`;
}

/** Date affichée style francophone */
export function formatDate(dateIso) {
  if (!dateIso) return '—';
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Bamako' });
}

export function formatDateHeure(dateIso) {
  if (!dateIso) return '—';
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleString('fr-FR', { timeZone: 'Africa/Bamako' });
}
