import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Badge, libelleStatut, statutTone } from '../components/Badge';
import { apiDashboard, apiFinance } from '../api';
import { formatDate, formatFcfa } from '../utils/format';
import { exporterRapportExcel, exporterRapportPdf } from '../utils/exportRapport';

export default function Rapports() {
  const [dash, setDash] = useState(null);
  const [finance, setFinance] = useState(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([apiDashboard(), apiFinance()])
      .then(([d, f]) => {
        setDash(d);
        setFinance(f);
      })
      .catch((e) => setErreur(e.message));
  }, []);

  function exporterPdf() {
    setErreur('');
    setMessage('');
    try {
      exporterRapportPdf(dash, finance);
      setMessage('Fenêtre d’impression ouverte — choisis « Enregistrer au format PDF ».');
    } catch (e) {
      setErreur(e.message);
    }
  }

  function exporterExcel() {
    setErreur('');
    setMessage('');
    try {
      exporterRapportExcel(dash, finance);
      setMessage('Fichier Excel téléchargé.');
    } catch (e) {
      setErreur(e.message);
    }
  }

  if (erreur && !dash) {
    return (
      <div className="page">
        <PageHeader titre="Rapports" />
        <p className="message-erreur">{erreur}</p>
      </div>
    );
  }

  if (!dash || !finance) {
    return (
      <div className="page">
        <PageHeader titre="Rapports" />
        <p className="chargement">Chargement…</p>
      </div>
    );
  }

  const paiements = finance.paiements_recents || [];

  return (
    <div className="page page-rapports">
      <PageHeader
        titre="Rapports"
        sousTitre="Synthèse d’activité · export PDF et Excel"
        actions={
          <div className="actions-form">
            <button type="button" className="bouton-secondaire" onClick={exporterExcel}>
              Exporter Excel
            </button>
            <button type="button" className="bouton-principal" onClick={exporterPdf}>
              Exporter PDF
            </button>
          </div>
        }
      />

      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      <div className="kpi-grid">
        <div className="kpi">
          <span>CA facturé</span>
          <strong>{formatFcfa(finance.chiffre_affaires)}</strong>
        </div>
        <div className="kpi">
          <span>Encaissé</span>
          <strong>{formatFcfa(finance.encaissements)}</strong>
        </div>
        <div className="kpi">
          <span>Créances</span>
          <strong>{formatFcfa(finance.creances)}</strong>
        </div>
        <div className="kpi">
          <span>Ventes validées</span>
          <strong>{dash.nb_ventes}</strong>
        </div>
        <div className="kpi">
          <span>Factures</span>
          <strong>{dash.nb_factures}</strong>
        </div>
        <div className="kpi">
          <span>Clients actifs</span>
          <strong>{dash.nb_clients}</strong>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Répartition des factures</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Statut</th>
                <th>Nombre</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {(finance.par_statut || []).length === 0 ? (
                <tr>
                  <td colSpan={3}>Aucune facture.</td>
                </tr>
              ) : (
                (finance.par_statut || []).map((s) => (
                  <tr key={s.statut_paiement}>
                    <td>
                      <Badge tone={statutTone(s.statut_paiement)}>
                        {libelleStatut(s.statut_paiement)}
                      </Badge>
                    </td>
                    <td>{s.nb}</td>
                    <td>{formatFcfa(s.montant)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Paiements récents</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Date</th>
                <th>Client</th>
                <th>Facture</th>
                <th>Moyen</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {paiements.length === 0 ? (
                <tr>
                  <td colSpan={6}>Aucun paiement.</td>
                </tr>
              ) : (
                paiements.map((p) => (
                  <tr key={p.id}>
                    <td>{p.numero}</td>
                    <td>{formatDate(p.date_paiement)}</td>
                    <td>{p.client_nom || '—'}</td>
                    <td>{p.facture_numero || '—'}</td>
                    <td>{p.moyen_paiement || '—'}</td>
                    <td>{formatFcfa(p.montant)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
