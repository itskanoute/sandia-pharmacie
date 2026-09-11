/**
 * Numérotation document visible client : PF-000001, FAC-000001
 * (indépendante de l'id technique interne)
 */
export function formaterNumero(prefixe, sequence) {
  const n = Math.max(1, Number(sequence) || 1);
  return `${prefixe}-${String(n).padStart(6, '0')}`;
}

export function extraireSequence(numero) {
  if (!numero || typeof numero !== 'string') return 0;
  const match = numero.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

export function prochainNumero(prefixe, documents) {
  const max = (documents || []).reduce((acc, doc) => {
    const seq = extraireSequence(doc.numero);
    return seq > acc ? seq : acc;
  }, 0);
  return formaterNumero(prefixe, max + 1);
}
