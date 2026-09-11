import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { apiCreerAdmin } from '../api';

const INITIAL = {
  nom_complet: '',
  nom_utilisateur: '',
  email: '',
  telephone: '',
  mot_de_passe: '',
  confirmation: '',
};

export default function CreerCompte() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [chargement, setChargement] = useState(false);

  function maj(champ, valeur) {
    setForm((f) => ({ ...f, [champ]: valeur }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErreur('');
    setSucces('');

    if (form.mot_de_passe !== form.confirmation) {
      setErreur('La confirmation du mot de passe ne correspond pas.');
      return;
    }
    if (form.mot_de_passe.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setChargement(true);
    try {
      const data = await apiCreerAdmin({
        nom_complet: form.nom_complet.trim(),
        nom_utilisateur: form.nom_utilisateur.trim(),
        email: form.email.trim(),
        telephone: form.telephone.trim(),
        mot_de_passe: form.mot_de_passe,
        confirmation: form.confirmation,
      });
      const id = data.admin?.nom_utilisateur || form.nom_utilisateur.trim();
      setSucces(
        `${data.message || 'Compte créé.'} Connecte-toi avec l’identifiant « ${id} » (ou ton e-mail).`
      );
      setTimeout(() => navigate('/connexion'), 2200);
    } catch (err) {
      setErreur(err.message || 'Création impossible.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="page-connexion">
      <div className="panneau-connexion panneau-large">
        <Logo variant="login" />
        <h1>Créer un compte administrateur</h1>
        <p className="sous-titre">SAN-DIA DISTRIBUTION</p>
        <p className="message-info">
          Choisis un <strong>identifiant court</strong> (ex. coumba) + ton e-mail.
          À la connexion, utilise cet identifiant ou ton e-mail — pas seulement ton prénom.
        </p>

        <form onSubmit={handleSubmit} className="formulaire">
          <label htmlFor="nom_complet">Nom complet (affichage)</label>
          <input
            id="nom_complet"
            value={form.nom_complet}
            onChange={(e) => maj('nom_complet', e.target.value)}
            required
          />

          <label htmlFor="nom_utilisateur">Identifiant de connexion</label>
          <input
            id="nom_utilisateur"
            autoComplete="username"
            placeholder="ex. coumba (pas le prénom seul si tu veux un autre id)"
            value={form.nom_utilisateur}
            onChange={(e) => maj('nom_utilisateur', e.target.value)}
            required
          />

          <label htmlFor="email">E-mail (code de connexion + alertes)</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => maj('email', e.target.value)}
            required
          />

          <label htmlFor="telephone">Téléphone</label>
          <input
            id="telephone"
            autoComplete="tel"
            value={form.telephone}
            onChange={(e) => maj('telephone', e.target.value)}
          />

          <label htmlFor="mot_de_passe">Mot de passe</label>
          <input
            id="mot_de_passe"
            type="password"
            autoComplete="new-password"
            value={form.mot_de_passe}
            onChange={(e) => maj('mot_de_passe', e.target.value)}
            required
            minLength={8}
          />

          <label htmlFor="confirmation">Confirmer le mot de passe</label>
          <input
            id="confirmation"
            type="password"
            autoComplete="new-password"
            value={form.confirmation}
            onChange={(e) => maj('confirmation', e.target.value)}
            required
            minLength={8}
          />

          {erreur ? <p className="message-erreur">{erreur}</p> : null}
          {succes ? <p className="message-succes">{succes}</p> : null}

          <button type="submit" disabled={chargement}>
            {chargement ? 'Création…' : 'Créer mon compte admin'}
          </button>

          <p className="lien-auth">
            Déjà un compte ? <Link to="/connexion">Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
