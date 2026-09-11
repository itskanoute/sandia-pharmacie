import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { apiCreerFournisseur, apiFournisseurs, apiMajFournisseur } from '../api';

export default function Fournisseurs() {
  const [liste, setListe] = useState([]);
  const [form, setForm] = useState(null);
  const [erreur, setErreur] = useState('');

  async function charger() {
    setListe(await apiFournisseurs());
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  async function enregistrer(e) {
    e.preventDefault();
    try {
      if (form.id) await apiMajFournisseur(form.id, form);
      else await apiCreerFournisseur(form);
      setForm(null);
      await charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="page">
      <PageHeader
        titre="Fournisseurs"
        actions={
          <button
            type="button"
            className="bouton-principal"
            onClick={() => setForm({ nom: '', telephone: '', email: '', adresse: '', contact_nom: '' })}
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
              <h3>{form.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h3>
              <p>Coordonnées pour commandes et réceptions.</p>
            </div>
          </div>
          <div className="grille-form">
            <label>Nom<input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></label>
            <label>Téléphone<input value={form.telephone || ''} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></label>
            <label>E-mail<input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Contact<input value={form.contact_nom || ''} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} /></label>
            <label>Adresse<input value={form.adresse || ''} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></label>
          </div>
          <div className="actions-form">
            <button type="button" className="bouton-secondaire" onClick={() => setForm(null)}>Annuler</button>
            <button type="submit" className="bouton-principal">Enregistrer</button>
          </div>
        </form>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Téléphone</th><th>Contact</th><th></th></tr></thead>
          <tbody>
            {liste.map((f) => (
              <tr key={f.id}>
                <td>{f.nom}</td>
                <td>{f.telephone || '—'}</td>
                <td>{f.contact_nom || '—'}</td>
                <td>
                  <button type="button" className="lien-action" onClick={() => setForm({ ...f })}>
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
