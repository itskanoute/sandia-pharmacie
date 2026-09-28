/**
 * Dashboard.jsx — Tableau de bord : indicateurs clés, alertes récentes et raccourcis.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { apiDashboard, getUtilisateurStocke } from '../api';
import { formatDate, formatFcfa } from '../utils/format';

export default function Dashboard() {
  // Agrégats renvoyés par GET /api/stats/dashboard
  const [data, setData] = useState(null); // KPI + alertes dashboard
  const [erreur, setErreur] = useState('');
  const utilisateur = getUtilisateurStocke(); // prénom accueil (cache local)
  const prenom = utilisateur?.nom_complet || utilisateur?.nom_utilisateur || 'Administrateur';

  // Chargement unique des indicateurs au montage
  useEffect(() => {
    apiDashboard()
      .then(setData)
      .catch((e) => setErreur(e.message));
  }, []);

  // Affichage d’erreur si l’API dashboard échoue
  if (erreur) {
    return (
      <div className="page">
        <PageHeader titre="Tableau de bord" />
        <p className="message-erreur">{erreur}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <PageHeader titre="Tableau de bord" />
        <p className="chargement">Chargement…</p>
      </div>
    );
  }

  // Compteurs pour le bandeau d’alertes et les listes
  const nbStock = (data.alertes_stock || []).length;
  const nbPeremp = (data.alertes_peremption || []).length;
  const nbDettes = (data.dettes_recentes || []).length;
  const totalAlertes = nbStock + nbPeremp + nbDettes;

  return (
    <div className="page">
      <PageHeader
        titre={`Bonjour, ${prenom}`}
        sousTitre="Vue commune SAN-DIA — tous les admins voient les mêmes chiffres de la pharmacie"
        pdfCible="#zone-pdf"
        pdfNom="dashboard"
      />

      <p className="message-info">
        Ce n’est pas un tableau personnel : stock, ventes, clients et dettes sont{' '}
        <strong>partagés</strong> entre tous les administrateurs. Ce qui change par compte :
        ton e-mail (code de connexion + alertes reçues).
      </p>

      {totalAlertes > 0 ? (
        <div className="bandeau-alertes-site">
          <strong>Alertes sur le site</strong>
          <p>
            {nbStock > 0 ? `${nbStock} stock · ` : ''}
            {nbPeremp > 0 ? `${nbPeremp} péremption · ` : ''}
            {nbDettes > 0 ? `${nbDettes} dette(s)` : ''}
          </p>
          <Link to="/alertes">Ouvrir la page Alertes</Link>
        </div>
      ) : (
        <p className="message-succes">
          Aucune alerte stock / lots / péremption / dette pour le moment.
        </p>
      )}

      <div id="zone-pdf">
      {/* Indicateurs chiffrés exportables en PDF */}
      <div className="kpi-grid">
        <div className="kpi">
          <span>Encaissements</span>
          <strong>{formatFcfa(data.encaissements)}</strong>
        </div>
        <div className="kpi">
          <span>Dettes clients</span>
          <strong>{formatFcfa(data.dettes)}</strong>
        </div>
        <div className="kpi">
          <span>Ventes</span>
          <strong>{data.nb_ventes}</strong>
          <div className="meta">{formatFcfa(data.montant_ventes)}</div>
        </div>
        <div className="kpi">
          <span>Clients</span>
          <strong>{data.nb_clients}</strong>
        </div>
      </div>

      <div className="deux-colonnes">
        <section className="carte-formulaire">
          <h3>Alertes stock</h3>
          <ul>
            {nbStock === 0 ? (
              <li className="meta">Aucune</li>
            ) : (
              data.alertes_stock.map((a) => (
                <li key={a.id}>
                  {a.nom} —{' '}
                  <Badge tone={Number(a.stock) === 0 ? 'critique' : 'attention'}>
                    stock {a.stock}
                  </Badge>
                </li>
              ))
            )}
          </ul>
          <Link to="/stock">Voir le stock</Link>
        </section>

        <section className="carte-formulaire">
          <h3>Péremption (≤ 5 mois)</h3>
          <ul>
            {nbPeremp === 0 ? (
              <li className="meta">Aucune</li>
            ) : (
              data.alertes_peremption.map((p) => (
                <li key={p.id}>
                  {p.medicament_nom} · lot {p.numero_lot} · {formatDate(p.date_peremption)}{' '}
                  <Badge tone={Number(p.jours_restants) <= 0 ? 'critique' : 'attention'}>
                    {p.jours_restants} j
                  </Badge>
                </li>
              ))
            )}
          </ul>
          <Link to="/lots">Voir les lots</Link>
        </section>
      </div>

      <section className="carte-formulaire">
        <h3>Dettes clients</h3>
        <ul>
          {nbDettes === 0 ? (
            <li className="meta">Aucune</li>
          ) : (
            data.dettes_recentes.map((d) => (
              <li key={d.id}>
                {d.numero} — {d.client_nom || 'Client'} — {formatFcfa(d.montant_reste)}
              </li>
            ))
          )}
        </ul>
        <Link to="/dettes">Gérer les dettes</Link>
      </section>
      </div>
    </div>
  );
}
