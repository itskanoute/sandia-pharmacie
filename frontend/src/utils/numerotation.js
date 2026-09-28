/**
 * Numérotation document visible client : PF-000001, FAC-000001
 * (indépendante de l’id technique interne)
 */

// Formate un numéro avec préfixe et 6 chiffres (ex. PF-000042)
export function formaterNumero(prefixe, sequence) {
  const n = Math.max(1, Number(sequence) || 1);
  return `${prefixe}-${String(n).padStart(6, '0')}`;
}

// Récupère la partie numérique finale d’un numéro PF-000042
export function extraireSequence(numero) {
  if (!numero || typeof numero !== 'string') return 0;
  const match = numero.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

// Propose le prochain numéro visible client à partir de la liste existante
export function prochainNumero(prefixe, documents) {
  // Parcourt tous les documents pour trouver la séquence max
  const max = (documents || []).reduce((acc, doc) => {
    const seq = extraireSequence(doc.numero);
    return seq > acc ? seq : acc;
  }, 0);
  return formaterNumero(prefixe, max + 1);
}
