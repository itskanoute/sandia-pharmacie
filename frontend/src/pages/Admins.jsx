import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { apiAdmins, apiCreerAdminConnecte } from '../api';

const FORM_VIDE = {
  nom_complet: '',
  nom_utilisateur: '',
  email: '',
  telephone: '',
  mot_de_passe: '',
  confirmation: '',
};

export default function Admins() {
  const [liste, setListe] = useState([]);
  const [form, setForm] = useState(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [chargement, setChargement] = useState(false);

  async function charger() {
    setListe(await apiAdmins());
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  async function enregistrer(e) {
    e.preventDefault();
    setErreur('');
    setMessage('');
    if (form.mot_de_passe !== form.confirmation) {
      setErreur('La confirmation du mot de passe ne correspond pas.');
      return;
    }
    setChargement(true);
    try {
      const data = await apiCreerAdminConnecte(form);
      setMessage(data.message);
      setForm(null);
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        titre="Administrateurs"
        sousTitre="Chaque compte a son e-mail : connexion par code + alertes"
        actions={
          !form ? (
            <button
              type="button"
              className="bouton-principal"
              onClick={() => setForm({ ...FORM_VIDE })}
            >
              + Nouvel admin
            </button>
          ) : null
        }
      />

      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      <p className="message-info">
        Les alertes (stock, lots, péremption, dettes) sont envoyées à{' '}
        <strong>tous</strong> les administrateurs actifs qui ont un e-mail.
      </p>

      {form ? (
        <form className="carte-formulaire" onSubmit={enregistrer}>
          <div className="formulaire-tete">
            <div>
              <h3>Nouveau compte administrateur</h3>
              <p>Identifiant + e-mail pour connexion et alertes.</p>
            </div>
          </div>
          <div className="grille-form">
            <label>
              Nom complet
              <input
                required
                value={form.nom_complet}
                onChange={(e) => setForm({ ...form, nom_complet: e.target.value })}
              />
            </label>
            <label>
              Identifiant de connexion
              <input
                required
                placeholder="ex. coumba"
                value={form.nom_utilisateur}
                onChange={(e) => setForm({ ...form, nom_utilisateur: e.target.value })}
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                required
                placeholder="pour le code et les alertes"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Téléphone
              <input
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              />
            </label>
            <label>
              Mot de passe
              <input
                type="password"
                required
                minLength={8}
                value={form.mot_de_passe}
                onChange={(e) => setForm({ ...form, mot_de_passe: e.target.value })}
              />
            </label>
            <label>
              Confirmation
              <input
                type="password"
                required
                minLength={8}
                value={form.confirmation}
                onChange={(e) => setForm({ ...form, confirmation: e.target.value })}
              />
            </label>
          </div>
          <div className="actions-form">
            <button type="button" className="bouton-secondaire" onClick={() => setForm(null)}>
              Annuler
            </button>
            <button type="submit" className="bouton-principal" disabled={chargement}>
              {chargement ? 'Création…' : 'Créer le compte'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Identifiant</th>
              <th>E-mail</th>
              <th>Téléphone</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr>
                <td colSpan={5}>Aucun administrateur.</td>
              </tr>
            ) : (
              liste.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.nom_complet}</strong>
                  </td>
                  <td>{a.nom_utilisateur}</td>
                  <td>{a.email || '—'}</td>
                  <td>{a.telephone || '—'}</td>
                  <td>
                    {Number(a.actif) === 1 ? (
                      <Badge tone="ok">Actif</Badge>
                    ) : (
                      <Badge tone="critique">Inactif</Badge>
                    )}
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
