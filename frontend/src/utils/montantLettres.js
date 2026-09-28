/** Montant en lettres (français) — FCFA pour documents commerciaux */

// Table 0–19 (mots simples)
const UNITES = [
  '',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
];
// Dizaines (index 7 et 9 = soixante-dix / quatre-vingt-dix en français)
const DIZAINES = [
  '',
  '',
  'vingt',
  'trente',
  'quarante',
  'cinquante',
  'soixante',
  'soixante',
  'quatre-vingt',
  'quatre-vingt',
];

// Conversion 0–999 en mots (règles françaises vingt/trente/soixante…)
function belowThousand(n) {
  if (n === 0) return '';
  if (n < 20) return UNITES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    // 70–79 et 90–99 : base 60 ou 80 + reste
    if (d === 7 || d === 9) {
      const base = d === 7 ? 60 : 80;
      const reste = n - base;
      if (d === 8 && u === 0) return 'quatre-vingts';
      return `${DIZAINES[d]}${reste ? `-${UNITES[reste] || belowThousand(reste)}` : ''}`;
    }
    if (u === 0) return DIZAINES[d] + (d === 8 ? 's' : '');
    if (u === 1 && d !== 8) return `${DIZAINES[d]} et un`;
    return `${DIZAINES[d]}-${UNITES[u]}`;
  }
  const c = Math.floor(n / 100);
  const r = n % 100;
  const cents =
    c === 1 ? 'cent' : `${UNITES[c]} cent${c > 1 && r === 0 ? 's' : ''}`;
  return r ? `${cents} ${belowThousand(r)}` : cents;
}

// Montant entier FCFA → phrase « … francs CFA » pour les documents
export function montantEnLettres(montant) {
  let n = Math.round(Number(montant) || 0);
  if (n === 0) return 'zéro franc CFA';

  const parts = [];
  const millions = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const milliers = Math.floor(n / 1000);
  n %= 1000;

  if (millions) {
    parts.push(
      millions === 1
        ? 'un million'
        : `${belowThousand(millions)} millions`
    );
  }
  if (milliers) {
    parts.push(
      milliers === 1 ? 'mille' : `${belowThousand(milliers)} mille`
    );
  }
  if (n) parts.push(belowThousand(n));

  const texte = parts.join(' ').replace(/\s+/g, ' ').trim();
  const capitalise = texte.charAt(0).toUpperCase() + texte.slice(1);
  return `${capitalise} francs CFA`;
}

/** Affichage date JJ-MM-AAAA comme sur le modèle papier */
export function formatDateDoc(dateIso) {
  if (!dateIso) return '—';
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) {
    // Chaîne SQL YYYY-MM-DD sans timezone
    const m = String(dateIso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return dateIso;
  }
  const jj = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aaaa = d.getFullYear();
  return `${jj}-${mm}-${aaaa}`;
}

/** Date + heure : 16-07-2026 20:23 (Africa/Bamako) */
export function formatDateHeureDoc(dateIso) {
  if (!dateIso) return '—';
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return formatDateDoc(dateIso);
  const date = formatDateDoc(dateIso);
  const heure = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Bamako',
  });
  return `${date} ${heure}`;
}

/** Nombre sans suffixe FCFA (colonnes P.U / montant ligne document) */
export function formatNombre(montant) {
  return (Number(montant) || 0).toLocaleString('fr-FR');
}
