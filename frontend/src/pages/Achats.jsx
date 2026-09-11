import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import {
  apiCommandes,
  apiCreerCommande,
  apiFournisseurs,
  apiMedicaments,
} from '../api';
import { formatDate, formatFcfa } from '../utils/format';

export default function Achats() {
  const [commandes, setCommandes] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [medicaments, setMedicaments] = useState([]);
  const [fournisseurId, setFournisseurId] = useState('');
  const [lignes, setLignes] = useState([]);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [chargement, setChargement] = useState(false);

  async function charger() {
    const [c, f, m] = await Promise.all([
      apiCommandes(),
      apiFournisseurs(),
      apiMedicaments(),
    ]);
    setCommandes(c);
    setFournisseurs(f);
    setMedicaments(m);
    if (f[0]) {
      setFournisseurId((prev) => prev || String(f[0].id));
    } else {
      setFournisseurId('');
    }
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  function ajouter(med) {
    setLignes((prev) => {
      const ex = prev.find((l) => l.medicament_id === med.id);
      if (ex) {
        return prev.map((l) =>
          l.medicament_id === med.id
            ? { ...l, quantite: l.quantite + 1 }
            : l
        );
      }
      return [
        ...prev,
        {
          medicament_id: med.id,
          designation: med.nom,
          quantite: 1,
          prix_achat_unitaire: Number(med.prix_achat || 0),
        },
      ];
    });
  }

  async function creer() {
    setErreur('');
    setMessage('');
    if (!fournisseurId) {
      setErreur('Choisissez d’abord un fournisseur (ou créez-en un).');
      return;
    }
    if (!lignes.length) {
      setErreur('Ajoutez au moins un produit à la commande.');
      return;
    }

    setChargement(true);
    try {
      await apiCreerCommande({
        fournisseur_id: Number(fournisseurId),
        lignes: lignes.map((l) => ({
          type_produit: 'medicament',
          medicament_id: l.medicament_id,
          designation: l.designation,
          quantite_commandee: l.quantite,
          prix_achat_unitaire: l.prix_achat_unitaire,
        })),
      });
      setMessage('Commande créée.');
      setLignes([]);
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        titre="Achats / Commandes"
        sousTitre="Commandes fournisseurs"
        actions={
          <Link to="/fournisseurs" className="bouton-secondaire">
            + Fournisseur
          </Link>
        }
      />
      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {fournisseurs.length === 0 ? (
        <div className="bandeau-alertes-site">
          <strong>Aucun fournisseur enregistré</strong>
          <p>
            Impossible de créer une commande sans fournisseur. Crée-en un d’abord.
          </p>
          <Link to="/fournisseurs">Aller à Fournisseurs</Link>
        </div>
      ) : null}

      <div className="carte-formulaire">
        <div className="formulaire-tete">
          <div>
            <h3>Nouvelle commande</h3>
            <p>Choisis le fournisseur puis ajoute les produits.</p>
          </div>
        </div>
        <label>
          Fournisseur
          <select
            value={fournisseurId}
            onChange={(e) => setFournisseurId(e.target.value)}
            disabled={fournisseurs.length === 0}
          >
            {fournisseurs.length === 0 ? (
              <option value="">Aucun fournisseur</option>
            ) : (
              fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Prix achat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {medicaments.map((m) => (
                <tr key={m.id}>
                  <td>{m.nom}</td>
                  <td>{formatFcfa(m.prix_achat)}</td>
                  <td>
                    <button type="button" className="lien-action" onClick={() => ajouter(m)}>
                      Ajouter
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul>
          {lignes.map((l) => (
            <li key={l.medicament_id}>
              {l.designation} × {l.quantite} @ {formatFcfa(l.prix_achat_unitaire)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="bouton-principal"
          disabled={!lignes.length || !fournisseurId || chargement}
          onClick={creer}
        >
          {chargement ? 'Création…' : 'Créer la commande'}
        </button>
        {!fournisseurId ? (
          <p className="meta">Sélectionne un fournisseur pour activer le bouton.</p>
        ) : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Fournisseur</th>
              <th>Total</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {commandes.length === 0 ? (
              <tr>
                <td colSpan={5}>Aucune commande.</td>
              </tr>
            ) : (
              commandes.map((c) => (
                <tr key={c.id}>
                  <td>{c.numero}</td>
                  <td>{formatDate(c.date_commande)}</td>
                  <td>{c.fournisseur_nom}</td>
                  <td>{formatFcfa(c.montant_total)}</td>
                  <td>{c.statut}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
