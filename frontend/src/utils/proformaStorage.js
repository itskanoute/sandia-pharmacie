import { proformasMaquette } from '../data/maquette';

const STORAGE_KEY = 'sandia_proformas_maquette';

export function chargerProformas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(proformasMaquette));
      return structuredClone(proformasMaquette);
    }
    return JSON.parse(raw);
  } catch {
    return structuredClone(proformasMaquette);
  }
}

export function sauvegarderProformas(liste) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(liste));
}
