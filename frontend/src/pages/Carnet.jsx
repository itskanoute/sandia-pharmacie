/**
 * Page Carnet : notes internes (CRUD), recherche texte et export PDF de la liste.
 */
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import {
  apiCreerNote,
  apiMajNote,
  apiNotes,
  apiSupprimerNote,
} from '../api';
import { formatDateHeure } from '../utils/format';

// Note vide pour ouverture formulaire
const VIDE = { titre: '', contenu: '' };

export default function Carnet() {
  const [liste, setListe] = useState([]);
  const [recherche, setRecherche] = useState('');
  // Formulaire note (null = liste seule)
  const [form, setForm] = useState(null);
  const [editionId, setEditionId] = useState(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [chargement, setChargement] = useState(true);

  // GET /api/notes avec recherche optionnelle
  async function charger(q = '') {
    setChargement(true);
    setErreur('');
    try {
      setListe(await apiNotes(q));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  // Chargement initial des notes
  useEffect(() => {
    charger();
  }, []);

  function ouvrirNouveau() {
    setEditionId(null);
    setForm({ ...VIDE });
    setMessage('');
  }

  function ouvrirEdit(n) {
    setEditionId(n.id);
    setForm({ titre: n.titre || '', contenu: n.contenu || '' });
    setMessage('');
  }

  function fermerForm() {
    setForm(null);
    setEditionId(null);
  }

  // Crée ou met à jour une note via /api/notes
  async function enregistrer(e) {
    e.preventDefault();
    setErreur('');
    setMessage('');
    try {
      if (editionId) await apiMajNote(editionId, form);
      else await apiCreerNote(form);
      setMessage(editionId ? 'Note mise à jour.' : 'Note enregistrée.');
      fermerForm();
      await charger(recherche);
    } catch (err) {
      setErreur(err.message);
    }
  }

  // DELETE /api/notes/:id après confirmation
  async function supprimer(id) {
    if (!window.confirm('Supprimer cette note ?')) return;
    setErreur('');
    try {
      await apiSupprimerNote(id);
      if (editionId === id) fermerForm();
      await charger(recherche);
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <div className="page page-carnet">
      <PageHeader
        titre="Carnet"
        sousTitre="Notes internes · mémos · rappels pharmacie"
        pdfCible="#zone-pdf"
        pdfNom="carnet-notes"
        actions={
          !form ? (
            <button type="button" className="bouton-principal" onClick={ouvrirNouveau}>
              + Nouvelle note
            </button>
          ) : null
        }
      />

      <div className="barre-outils no-print">
        <input
          type="search"
          placeholder="Rechercher dans le carnet…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && charger(recherche)}
        />
        <button type="button" className="bouton-secondaire" onClick={() => charger(recherche)}>
          Rechercher
        </button>
      </div>

      {message ? <p className="message-succes no-print">{message}</p> : null}
      {erreur ? <p className="message-erreur no-print">{erreur}</p> : null}

      {form ? (
        <form className="carte-formulaire no-print" onSubmit={enregistrer}>
          <h2>{editionId ? 'Modifier la note' : 'Nouvelle note'}</h2>
          <label>
            Titre
            <input
              required
              maxLength={200}
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              placeholder="Ex. Commande fournisseur à rappeler"
            />
          </label>
          <label>
            Contenu
            <textarea
              required
              rows={10}
              value={form.contenu}
              onChange={(e) => setForm({ ...form, contenu: e.target.value })}
              placeholder="Écris ta note ici…"
            />
          </label>
          <div className="actions-form">
            <button type="button" className="bouton-secondaire" onClick={fermerForm}>
              Annuler
            </button>
            <button type="submit" className="bouton-principal">
              Enregistrer
            </button>
          </div>
        </form>
      ) : null}

      <div id="zone-pdf">
        <h3 className="carnet-liste-titre">
          Notes ({liste.length})
        </h3>
        {chargement ? (
          <p className="chargement">Chargement…</p>
        ) : liste.length === 0 ? (
          <p className="meta">Aucune note pour le moment. Ajoute la première.</p>
        ) : (
          <div className="carnet-grille">
            {liste.map((n) => (
              <article key={n.id} className="carnet-carte">
                <header className="carnet-carte-tete">
                  <h4>{n.titre}</h4>
                  <span className="meta">{formatDateHeure(n.updated_at)}</span>
                </header>
                <p className="carnet-contenu">{n.contenu}</p>
                <div className="actions-form no-print">
                  <button type="button" className="lien-action" onClick={() => ouvrirEdit(n)}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="lien-action lien-danger"
                    onClick={() => supprimer(n.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
