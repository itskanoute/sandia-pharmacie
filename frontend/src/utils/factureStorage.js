import { facturesMaquette } from '../data/maquette';
import { enrichirFacture } from './paiement';

const STORAGE_KEY = 'sandia_factures_maquette';

export function chargerFactures() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = facturesMaquette.map(enrichirFacture);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return structuredClone(initial);
    }
    return JSON.parse(raw).map(enrichirFacture);
  } catch {
    return structuredClone(facturesMaquette).map(enrichirFacture);
  }
}

export function sauvegarderFactures(liste) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(liste.map(enrichirFacture)));
}
