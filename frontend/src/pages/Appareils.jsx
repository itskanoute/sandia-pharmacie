/**
 * Appareils.jsx — Matériel médical : inventaire, prix et seuils d’alerte.
 */
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Badge, libelleStatut, statutTone } from '../components/Badge';
import { apiAppareils, apiCreerAppareil, apiMajAppareil } from '../api';
import { formatFcfa } from '../utils/format';

// Modèle formulaire appareil médical
const VIDE = {
  nom: '',
  reference: '',
  type_appareil: '',
  marque: '',
  modele: '',
  quantite: 0,
  prix_client: 0,
  prix_revendeur: 0,
  prix_achat: 0,
  seuil_alerte: 1,
};

export default function Appareils() {
  const [liste, setListe] = useState([]); // inventaire appareils
  const [form, setForm] = useState(null); // panneau création / édition
  const [editionId, setEditionId] = useState(null); // id MySQL si modification
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true); // chargement initial tableau

  // Inventaire matériel médical depuis l’API
  async function charger() {
    setChargement(true);
    try {
      setListe(await apiAppareils());
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  async function enregistrer(e) {
    e.preventDefault();
    try {
      // Branche création vs mise à jour
      if (editionId) await apiMajAppareil(editionId, form);
      else await apiCreerAppareil(form);
      setForm(null);
      await charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="page">
      <PageHeader
        titre="Appareils médicaux"
        sousTitre="Stock · prix FCFA"
        pdfCible="#zone-pdf"
        pdfNom="appareils"
        actions={
          <button
            type="button"
            className="bouton-principal"
            onClick={() => {
              setEditionId(null);
              setForm({ ...VIDE });
            }}
          >
            + Ajouter
          </button>
        }
      />

      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {form ? (
        <form className="carte-formulaire" onSubmit={enregistrer}>
          <div className="formulaire-tete">
            <div>
              <h3>{editionId ? 'Modifier l’appareil' : 'Nouvel appareil'}</h3>
              <p>Identité, stock et prix en FCFA.</p>
            </div>
          </div>
          <div className="formulaire-bloc">
            <p className="formulaire-bloc-titre">Identité</p>
            <div className="grille-form">
              <label>Nom<input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></label>
              <label>Référence<input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></label>
              <label>Type<input value={form.type_appareil} onChange={(e) => setForm({ ...form, type_appareil: e.target.value })} /></label>
              <label>Marque<input value={form.marque} onChange={(e) => setForm({ ...form, marque: e.target.value })} /></label>
            </div>
          </div>
          <div className="formulaire-bloc">
            <p className="formulaire-bloc-titre">Stock & prix</p>
            <div className="grille-form">
              <label>Quantité<input type="number" min="0" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: Number(e.target.value) })} /></label>
              <label>Prix client<input type="number" min="0" value={form.prix_client} onChange={(e) => setForm({ ...form, prix_client: Number(e.target.value) })} /></label>
              <label>Prix revendeur<input type="number" min="0" value={form.prix_revendeur} onChange={(e) => setForm({ ...form, prix_revendeur: Number(e.target.value) })} /></label>
            </div>
          </div>
          <div className="actions-form">
            <button type="button" className="bouton-secondaire" onClick={() => setForm(null)}>Annuler</button>
            <button type="submit" className="bouton-principal">Enregistrer</button>
          </div>
        </form>
      ) : null}

      <div className="table-wrap" id="zone-pdf">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Référence</th>
              <th>Stock</th>
              <th>Prix client</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {chargement ? (
              <tr><td colSpan={6}>Chargement…</td></tr>
            ) : liste.length === 0 ? (
              <tr><td colSpan={6}>Aucun appareil.</td></tr>
            ) : (
              liste.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.nom}</strong><div className="meta">{a.marque || ''}</div></td>
                  <td>{a.reference || '—'}</td>
                  <td>{a.quantite}</td>
                  <td>{formatFcfa(a.prix_client)}</td>
                  <td><Badge tone={statutTone(a.statut)}>{libelleStatut(a.statut)}</Badge></td>
                  <td>
                    <button
                      type="button"
                      className="lien-action"
                      onClick={() => {
                        setEditionId(a.id);
                        setForm({
                          nom: a.nom,
                          reference: a.reference || '',
                          type_appareil: a.type_appareil || '',
                          marque: a.marque || '',
                          modele: a.modele || '',
                          quantite: a.quantite || 0,
                          prix_client: a.prix_client || 0,
                          prix_revendeur: a.prix_revendeur || 0,
                          prix_achat: a.prix_achat || 0,
                          seuil_alerte: a.seuil_alerte || 0,
                          statut: a.statut,
                        });
                      }}
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
