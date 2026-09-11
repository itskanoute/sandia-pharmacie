import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { apiLogin, apiVerifierCode, sauvegarderSession } from '../api';

export default function Connexion({ onConnexion }) {
  const navigate = useNavigate();
  const [etape, setEtape] = useState('identifiants');
  const [nomUtilisateur, setNomUtilisateur] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [utilisateurId, setUtilisateurId] = useState(null);
  const [emailMasque, setEmailMasque] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [chargement, setChargement] = useState(false);

  async function handleIdentifiants(event) {
    event.preventDefault();
    setErreur('');
    setInfo('');
    setDevCode('');
    setChargement(true);

    try {
      const data = await apiLogin(nomUtilisateur.trim(), motDePasse);
      setUtilisateurId(data.utilisateur_id);
      setEmailMasque(data.email_masque || '');
      setInfo(data.message || 'Code envoyé par e-mail.');
      if (data.dev_code) setDevCode(data.dev_code);
      setEtape('code');
    } catch (err) {
      setErreur(err.message || 'Identifiants incorrects.');
    } finally {
      setChargement(false);
    }
  }

  async function handleCode(event) {
    event.preventDefault();
    setErreur('');
    setChargement(true);

    try {
      const data = await apiVerifierCode(utilisateurId, code.trim());
      sauvegarderSession(data.token, data.utilisateur);
      onConnexion?.(data.utilisateur);
      navigate('/');
    } catch (err) {
      setErreur(err.message || 'Code incorrect.');
    } finally {
      setChargement(false);
    }
  }

  function revenir() {
    setEtape('identifiants');
    setCode('');
    setErreur('');
    setInfo('');
    setDevCode('');
    setUtilisateurId(null);
  }

  return (
    <div className="page-connexion">
      <div className="panneau-connexion">
        <Logo variant="login" />
        <h1>Connexion</h1>
        <p className="sous-titre">SAN-DIA DISTRIBUTION</p>

        {etape === 'identifiants' ? (
          <form onSubmit={handleIdentifiants} className="formulaire">
            <label htmlFor="nom_utilisateur">Identifiant ou e-mail</label>
            <input
              id="nom_utilisateur"
              autoComplete="username"
              value={nomUtilisateur}
              onChange={(e) => setNomUtilisateur(e.target.value)}
              required
            />

            <label htmlFor="mot_de_passe">Mot de passe</label>
            <input
              id="mot_de_passe"
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />

            {erreur ? <p className="message-erreur">{erreur}</p> : null}

            <button type="submit" disabled={chargement}>
              {chargement ? 'Vérification…' : 'Continuer'}
            </button>

            <p className="lien-auth">
              Nouvel administrateur ?{' '}
              <Link to="/creer-compte">Créer un compte</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleCode} className="formulaire">
            <p className="message-info">
              {info || `Saisissez le code envoyé à ${emailMasque}.`}
            </p>

            {devCode ? (
              <p className="message-info">Code (démo) : <strong>{devCode}</strong></p>
            ) : null}

            <label htmlFor="code">Code reçu par e-mail</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
            />

            {erreur ? <p className="message-erreur">{erreur}</p> : null}

            <button type="submit" disabled={chargement}>
              {chargement ? 'Vérification…' : 'Valider le code'}
            </button>

            <button type="button" className="bouton-secondaire" onClick={revenir}>
              Retour
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
