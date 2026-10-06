import { chargerFactures } from './factureStorage';
import { enrichirFacture, totalPaye } from './paiement';
import {
  commandesMaquette,
  lotsMaquette,
  medicamentsMaquette,
  receptionsMaquette,
} from '../data/maquette';

const VENTES_KEY = 'sandia_ventes_maquette';
const STOCK_KEY = 'sandia_stock_medicaments';

export function chargerVentesLocales() {
  try {
    const raw = localStorage.getItem(VENTES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function chargerStockMedicaments() {
  try {
    const raw = localStorage.getItem(STOCK_KEY);
    if (!raw) {
      const initial = medicamentsMaquette.map((m) => ({
        id: m.id,
        nom: m.nom,
        reference: m.reference,
        seuil: m.seuil,
        stock: m.stock,
      }));
      localStorage.setItem(STOCK_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return medicamentsMaquette.map((m) => ({
      id: m.id,
      nom: m.nom,
      reference: m.reference,
      seuil: m.seuil,
      stock: m.stock,
    }));
  }
}

export function sauvegarderStockMedicaments(liste) {
  localStorage.setItem(STOCK_KEY, JSON.stringify(liste));
}

/** Diminue le stock après vente validée (maquette). */
export function diminuerStockPourVente(lignes) {
  const stock = chargerStockMedicaments();
  const maj = stock.map((s) => {
    const ligne = (lignes || []).find(
      (l) =>
        l.reference === s.reference ||
        l.produit === s.nom ||
        Number(l.id) === Number(s.id)
    );
    if (!ligne) return s;
    const qte = Number(ligne.quantite) || 0;
    return { ...s, stock: Math.max(0, s.stock - qte) };
  });
  sauvegarderStockMedicaments(maj);
  return maj;
}

export function estAujourdhui(dateStr) {
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return d === today;
}

export function calculerStatsFinance() {
  const factures = chargerFactures().map(enrichirFacture);
  const ventes = chargerVentesLocales();

  const facturesJour = factures.filter((f) => estAujourdhui(f.date));
  const paiementsJour = factures.flatMap((f) =>
    (f.paiements || [])
      .filter((p) => estAujourdhui(p.date))
      .map((p) => ({ ...p, client: f.client, facture: f.numero }))
  );

  const totalDettes = factures.reduce((s, f) => s + (f.reste_a_payer || 0), 0);
  const totalEncaisse = factures.reduce((s, f) => s + (f.montant_paye || 0), 0);
  const totalFacture = factures.reduce((s, f) => s + (f.montant_total || 0), 0);
  const totalAvances = factures
    .filter((f) => f.statut_paiement === 'partiellement_paye')
    .reduce((s, f) => s + (f.montant_paye || 0), 0);

  const encaisseJour = paiementsJour.reduce((s, p) => s + (p.montant || 0), 0);
  const caJour = facturesJour.reduce((s, f) => s + (f.montant_total || 0), 0);
  const ventesJour = ventes.filter((v) => estAujourdhui(v.date));

  return {
    factures,
    ventes,
    caJour,
    ventesJourCount: ventesJour.length || facturesJour.length,
    ventesJourMontant: ventesJour.reduce((s, v) => s + (v.montant || 0), 0) || caJour,
    encaisseJour,
    paiementsJour,
    totalDettes,
    totalEncaisse,
    totalFacture,
    totalAvances,
    enAttente: totalDettes,
    nbNonPayees: factures.filter((f) => f.statut_paiement === 'non_paye').length,
    nbPartielles: factures.filter((f) => f.statut_paiement === 'partiellement_paye').length,
    nbPayees: factures.filter((f) => f.statut_paiement === 'paye').length,
    facturesJourCount: facturesJour.length,
    totalAchats: commandesMaquette.reduce((s, c) => s + c.montant, 0),
    produitsVendus: ventes.reduce(
      (s, v) => s + (v.lignes || []).reduce((a, l) => a + (l.quantite || 0), 0),
      0
    ),
    ruptures: chargerStockMedicaments().filter((m) => m.stock === 0).length,
    stockFaible: chargerStockMedicaments().filter(
      (m) => m.stock > 0 && m.stock <= m.seuil
    ).length,
    bientotPerimes: lotsMaquette.filter((l) => l.statut === 'bientot_perime').length,
    perimes: lotsMaquette.filter((l) => l.statut === 'perime').length,
    anomaliesReception: receptionsMaquette.reduce(
      (s, r) => s + (r.lignes || []).filter((l) => l.ecart !== 0).length,
      0
    ),
  };
}

export function dettesDepuisFactures(factures) {
  return (factures || [])
    .map(enrichirFacture)
    .filter((f) => f.reste_a_payer > 0);
}
