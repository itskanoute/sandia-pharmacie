import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { apiFinance } from '../api';
import { formatDateHeure, formatFcfa } from '../utils/format';

export default function Finance() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    apiFinance()
      .then(setData)
      .catch((e) => setErreur(e.message));
  }, []);

  if (erreur) {
    return (
      <div className="page">
        <PageHeader titre="Finance" />
        <p className="message-erreur">{erreur}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <PageHeader titre="Finance" />
        <p className="chargement">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader titre="Finance" sousTitre="Encaissements · créances (FCFA)" />
      <div className="kpi-grid">
        <div className="kpi"><span>Chiffre d’affaires facturé</span><strong>{formatFcfa(data.chiffre_affaires)}</strong></div>
        <div className="kpi"><span>Encaissements</span><strong>{formatFcfa(data.encaissements)}</strong></div>
        <div className="kpi"><span>Créances</span><strong>{formatFcfa(data.creances)}</strong></div>
      </div>

      <h3>Paiements récents</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>N°</th>
              <th>Facture</th>
              <th>Client</th>
              <th>Montant</th>
              <th>Moyen</th>
            </tr>
          </thead>
          <tbody>
            {(data.paiements_recents || []).length === 0 ? (
              <tr><td colSpan={6}>Aucun paiement.</td></tr>
            ) : (
              data.paiements_recents.map((p) => (
                <tr key={p.id}>
                  <td>{formatDateHeure(p.date_paiement)}</td>
                  <td>{p.numero || '—'}</td>
                  <td>{p.facture_numero}</td>
                  <td>{p.client_nom || '—'}</td>
                  <td>{formatFcfa(p.montant)}</td>
                  <td>{p.moyen_paiement || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
