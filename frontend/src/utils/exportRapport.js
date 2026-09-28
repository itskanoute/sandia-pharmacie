/**
 * exportRapport.js — Construction des données et export Excel / PDF HTML du rapport d’activité.
 */
import * as XLSX from 'xlsx';
import { libelleStatut } from '../components/Badge';
import { formatFcfa } from './format';
import { SANDIA_DEFAUT } from '../data/sandia';

// Suffixe AAAA-MM-JJ pour les noms de fichiers exportés
// Suffixe AAAA-MM-JJ pour les noms de fichiers exportés
function dateFichier() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0'); // zero-padding mois/jour
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Téléchargement côté client via lien temporaire (fallback popup bloquée)
function telechargerBlob(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Construit les lignes du rapport à partir du dashboard + finance. */
/** Agrège dashboard + finance en structures prêtes pour Excel / HTML PDF */
export function construireDonneesRapport(dash, finance) {
  // Lignes KPI (montants ou compteurs)
  const indicateurs = [
    { indicateur: 'CA facturé', valeur: Number(finance.chiffre_affaires) || 0, monetaire: true },
    { indicateur: 'Encaissé', valeur: Number(finance.encaissements) || 0, monetaire: true },
    { indicateur: 'Créances', valeur: Number(finance.creances) || 0, monetaire: true },
    { indicateur: 'Ventes validées', valeur: Number(dash.nb_ventes) || 0, monetaire: false },
    { indicateur: 'Factures', valeur: Number(dash.nb_factures) || 0, monetaire: false },
    { indicateur: 'Clients actifs', valeur: Number(dash.nb_clients) || 0, monetaire: false },
  ];

  // Tableau pour feuille Excel « Factures »
  const repartition = (finance.par_statut || []).map((s) => ({
    statut: libelleStatut(s.statut_paiement),
    nombre: Number(s.nb) || 0,
    montant: Number(s.montant) || 0,
  }));

  const paiements = (finance.paiements_recents || []).map((p) => ({
    numero: p.numero,
    date: p.date_paiement,
    client: p.client_nom || '—',
    facture: p.facture_numero || '—',
    moyen: p.moyen_paiement || '—',
    montant: Number(p.montant) || 0,
  }));

  return { indicateurs, repartition, paiements };
}

/** Export Excel (.xlsx) — 3 feuilles. */
/** Export Excel (.xlsx) — 3 feuilles : Synthèse, Factures, Paiements */
export function exporterRapportExcel(dash, finance) {
  const { repartition, paiements } = construireDonneesRapport(dash, finance);
  const wb = XLSX.utils.book_new(); // classeur vide

  const ws1 = XLSX.utils.aoa_to_sheet([
    ['SAN-DIA DISTRIBUTION'],
    ['Rapport d’activité'],
    [`Exporté le ${new Date().toLocaleString('fr-FR')}`],
    [],
    ['Indicateur', 'Montant (FCFA) / Nombre'],
    ['CA facturé', Number(finance.chiffre_affaires) || 0],
    ['Encaissé', Number(finance.encaissements) || 0],
    ['Créances', Number(finance.creances) || 0],
    ['Ventes validées', Number(dash.nb_ventes) || 0],
    ['Factures', Number(dash.nb_factures) || 0],
    ['Clients actifs', Number(dash.nb_clients) || 0],
  ]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Synthèse');

  const ws2 = XLSX.utils.json_to_sheet(
    repartition.map((r) => ({
      Statut: r.statut,
      Nombre: r.nombre,
      'Montant (FCFA)': r.montant,
    }))
  );
  XLSX.utils.book_append_sheet(wb, ws2, 'Factures');

  const ws3 = XLSX.utils.json_to_sheet(
    paiements.map((p) => ({
      'N° paiement': p.numero,
      Date: p.date,
      Client: p.client,
      Facture: p.facture,
      Moyen: p.moyen,
      'Montant (FCFA)': p.montant,
    }))
  );
  XLSX.utils.book_append_sheet(wb, ws3, 'Paiements');

  XLSX.writeFile(wb, `rapport-sandia-${dateFichier()}.xlsx`);
}

/** Ouvre une fenêtre d’impression → Enregistrer en PDF. */
export function exporterRapportPdf(dash, finance) {
  const { indicateurs, repartition, paiements } = construireDonneesRapport(dash, finance);
  const nom = SANDIA_DEFAUT.nom_pharmacie;
  const dateStr = new Date().toLocaleString('fr-FR');

  const lignesInd = indicateurs
    .map((i) => {
      const val = i.monetaire ? formatFcfa(i.valeur) : String(i.valeur);
      return `<tr><td>${i.indicateur}</td><td style="text-align:right;font-weight:600">${val}</td></tr>`;
    })
    .join('');

  const lignesRep = repartition.length
    ? repartition
        .map(
          (r) =>
            `<tr><td>${r.statut}</td><td style="text-align:right">${r.nombre}</td><td style="text-align:right">${formatFcfa(r.montant)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="3">Aucune facture</td></tr>';

  const lignesPay = paiements.length
    ? paiements
        .slice(0, 30)
        .map(
          (p) =>
            `<tr><td>${p.numero}</td><td>${p.date || '—'}</td><td>${p.client}</td><td>${p.facture}</td><td>${p.moyen}</td><td style="text-align:right">${formatFcfa(p.montant)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="6">Aucun paiement</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport SAN-DIA ${dateFichier()}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Candara, sans-serif; color: #1a2a23; margin: 24px; font-size: 13px; }
    h1 { margin: 0 0 4px; font-size: 20px; color: #0a4d38; }
    .meta { color: #5a6d64; margin: 0 0 20px; }
    h2 { font-size: 14px; margin: 22px 0 8px; color: #0f6b4c; border-bottom: 2px solid #0f6b4c; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #d3ddd7; padding: 7px 9px; text-align: left; }
    th { background: #e7f3ed; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #5a6d64; }
    .pied { margin-top: 28px; font-size: 11px; color: #5a6d64; }
    @media print {
      body { margin: 12px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 14px;background:#0f6b4c;color:#fff;border:none;border-radius:8px;cursor:pointer;font:inherit">
    Imprimer / Enregistrer en PDF
  </button>
  <h1>${nom}</h1>
  <p class="meta">Rapport d’activité · Bamako / Mali · Exporté le ${dateStr}</p>

  <h2>Indicateurs</h2>
  <table>
    <thead><tr><th>Indicateur</th><th>Valeur</th></tr></thead>
    <tbody>${lignesInd}</tbody>
  </table>

  <h2>Répartition des factures</h2>
  <table>
    <thead><tr><th>Statut</th><th>Nombre</th><th>Montant</th></tr></thead>
    <tbody>${lignesRep}</tbody>
  </table>

  <h2>Paiements récents</h2>
  <table>
    <thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Facture</th><th>Moyen</th><th>Montant</th></tr></thead>
    <tbody>${lignesPay}</tbody>
  </table>

  <p class="pied">Document généré par SAN-DIA DISTRIBUTION — à usage interne.</p>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 350);
    };
  </script>
</body>
</html>`;

  const fenetre = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!fenetre) {
    telechargerBlob(
      new Blob([html], { type: 'text/html;charset=utf-8' }),
      `rapport-sandia-${dateFichier()}.html`
    );
    throw new Error(
      'Popup bloquée. Autorise les popups pour le PDF, ou ouvre le fichier HTML téléchargé puis Imprimer → PDF.'
    );
  }
  fenetre.document.open();
  fenetre.document.write(html);
  fenetre.document.close();
}
