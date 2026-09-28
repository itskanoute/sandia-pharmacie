/**
 * Stock.jsx — Vue consolidée du stock (médicaments et appareils) avec valorisation.
 */
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { apiStock } from '../api';
import { formatDateHeure, formatFcfa } from '../utils/format';

export default function Stock() {
  // Réponse /api/stock : médicaments, appareils, mouvements
  const [data, setData] = useState(null); // medicaments, appareils, mouvements
  const [erreur, setErreur] = useState('');

  // Chargement initial du stock consolidé
  useEffect(() => {
    apiStock()
      .then(setData)
      .catch((e) => setErreur(e.message));
  }, []);

  if (erreur) {
    return (
      <div className="page">
        <PageHeader titre="Stock" />
        <p className="message-erreur">{erreur}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <PageHeader titre="Stock" />
        <p className="chargement">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        titre="Stock"
        sousTitre="Médicaments · appareils · mouvements"
        pdfCible="#zone-pdf"
        pdfNom="stock"
      />

      <div id="zone-pdf">
      {/* Tableaux séparés par type de produit et journal des mouvements */}
      <h3>Médicaments</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Réf.</th><th>Stock</th><th>Seuil</th></tr></thead>
          <tbody>
            {data.medicaments.map((m) => (
              <tr key={m.id}>
                <td>{m.nom}</td>
                <td>{m.reference || '—'}</td>
                <td>
                  {Number(m.stock_disponible) <= Number(m.seuil_alerte) ? (
                    <Badge tone={Number(m.stock_disponible) === 0 ? 'critique' : 'attention'}>
                      {m.stock_disponible}
                    </Badge>
                  ) : (
                    m.stock_disponible
                  )}
                </td>
                <td>{m.seuil_alerte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Appareils</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Stock</th><th>État</th></tr></thead>
          <tbody>
            {data.appareils.map((a) => (
              <tr key={a.id}>
                <td>{a.nom}</td>
                <td>{a.quantite}</td>
                <td>{a.etat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Derniers mouvements</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Produit</th><th>Type</th><th>Qté</th><th>Sens</th></tr></thead>
          <tbody>
            {data.mouvements.map((m) => (
              <tr key={m.id}>
                <td>{formatDateHeure(m.created_at)}</td>
                <td>{m.medicament_nom || m.appareil_nom || '—'}</td>
                <td>{m.type_mouvement}</td>
                <td>{m.quantite}</td>
                <td>{m.sens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
