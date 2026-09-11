import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { apiAlertes, apiNotifierAlertes } from '../api';
import { formatDate, formatFcfa } from '../utils/format';

export default function Alertes() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function charger() {
    setData(await apiAlertes());
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  async function envoyerParMail() {
    setEnvoi(true);
    setErreur('');
    setMessage('');
    try {
      const r = await apiNotifierAlertes();
      setMessage(r.message);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (!data && !erreur) {
    return (
      <div className="page">
        <PageHeader titre="Alertes" />
        <p className="chargement">Chargement…</p>
      </div>
    );
  }

  const jours = data?.seuils?.jours_alerte_peremption || 150;
  const seuilLot = data?.seuils?.seuil_stock_lot || 50;
  const lots = data?.lots || [];

  return (
    <div className="page">
      <PageHeader
        titre="Alertes"
        sousTitre={`Péremption ${jours} j · lots ≤ ${seuilLot} · e-mails à tous les admins`}
        actions={
          <button
            type="button"
            className="bouton-principal"
            disabled={envoi}
            onClick={envoyerParMail}
          >
            {envoi ? 'Envoi…' : 'Envoyer aussi par e-mail'}
          </button>
        }
      />

      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {!data ? null : (
        <>
          <h3>Stock produit ≤ {seuilLot}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Stock</th>
                  <th>Seuil</th>
                  <th>Niveau</th>
                </tr>
              </thead>
              <tbody>
                {data.stock.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Aucune alerte stock.</td>
                  </tr>
                ) : (
                  data.stock.map((s) => (
                    <tr key={s.id}>
                      <td>{s.nom}</td>
                      <td>{s.stock_disponible}</td>
                      <td>{s.seuil_alerte}</td>
                      <td>
                        <Badge tone={s.niveau === 'critique' ? 'critique' : 'attention'}>
                          {s.niveau}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3>Lots ≤ {seuilLot} unités restantes</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Lot</th>
                  <th>Reste</th>
                  <th>Péremption</th>
                  <th>Niveau</th>
                </tr>
              </thead>
              <tbody>
                {lots.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Aucun lot sous le seuil {seuilLot}.</td>
                  </tr>
                ) : (
                  lots.map((l) => (
                    <tr key={l.id}>
                      <td>{l.medicament_nom}</td>
                      <td>{l.numero_lot}</td>
                      <td>{l.quantite_disponible}</td>
                      <td>{formatDate(l.date_peremption)}</td>
                      <td>
                        <Badge tone={l.niveau === 'critique' ? 'critique' : 'attention'}>
                          {l.niveau}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3>Péremption ≤ {jours} jours (~5 mois)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Lot</th>
                  <th>Date</th>
                  <th>Jours</th>
                  <th>Qté</th>
                </tr>
              </thead>
              <tbody>
                {data.peremption.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Aucune alerte péremption.</td>
                  </tr>
                ) : (
                  data.peremption.map((p) => (
                    <tr key={p.id}>
                      <td>{p.medicament_nom}</td>
                      <td>{p.numero_lot}</td>
                      <td>{formatDate(p.date_peremption)}</td>
                      <td>
                        <Badge tone={p.niveau === 'critique' ? 'critique' : 'attention'}>
                          {p.jours_restants} j
                        </Badge>
                      </td>
                      <td>{p.quantite_disponible}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3>Dettes</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Facture</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Reste</th>
                </tr>
              </thead>
              <tbody>
                {data.dettes.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Aucune dette.</td>
                  </tr>
                ) : (
                  data.dettes.map((d) => (
                    <tr key={d.id}>
                      <td>{d.numero}</td>
                      <td>{d.client_nom || '—'}</td>
                      <td>{formatDate(d.date_facture)}</td>
                      <td>{formatFcfa(d.montant_reste)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
