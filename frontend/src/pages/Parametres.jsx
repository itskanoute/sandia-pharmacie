/**
 * Parametres.jsx — Identité de la pharmacie, coordonnées et options de facturation.
 */
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { apiMajParametres, apiParametres } from '../api';
import { SANDIA_DEFAUT } from '../data/sandia';

export default function Parametres() {
  // Objet paramètres fusionné avec SANDIA_DEFAUT
  const [form, setForm] = useState(null); // champs identité pharmacie
  const [message, setMessage] = useState(''); // succès enregistrement
  const [erreur, setErreur] = useState('');

  // Lecture des paramètres pharmacie au montage
  useEffect(() => {
    apiParametres()
      .then((data) => setForm({ ...SANDIA_DEFAUT, ...data }))
      .catch((e) => setErreur(e.message));
  }, []);

  // PUT /api/parametres — identité et seuils d’alerte
  async function enregistrer(e) {
    e.preventDefault();
    try {
      const data = await apiMajParametres(form);
      setForm({ ...SANDIA_DEFAUT, ...data });
      setMessage('Paramètres SAN-DIA enregistrés.');
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (!form && !erreur) {
    return (
      <div className="page">
        <PageHeader titre="Paramètres" />
        <p className="chargement">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader titre="Paramètres" sousTitre="Identité SAN-DIA sur factures et pro forma" />
      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {form ? (
        <form className="carte-formulaire form-parametres" onSubmit={enregistrer}>
          <div className="formulaire-tete">
            <div>
              <h3>Identité de la pharmacie</h3>
              <p>Ces infos apparaissent sur les factures et pro forma.</p>
            </div>
          </div>

          <div className="formulaire-bloc">
            <p className="formulaire-bloc-titre">Coordonnées</p>
            <div className="grille-form">
              <label>
                Nom
                <input
                  value={form.nom_pharmacie || ''}
                  onChange={(e) => setForm({ ...form, nom_pharmacie: e.target.value })}
                />
              </label>
              <label>
                Activité
                <input
                  value={form.activite || ''}
                  onChange={(e) => setForm({ ...form, activite: e.target.value })}
                />
              </label>
              <label>
                Adresse
                <input
                  value={form.adresse || ''}
                  onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                />
              </label>
              <label>
                Téléphone
                <input
                  value={form.telephone || ''}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="formulaire-bloc">
            <p className="formulaire-bloc-titre">Mentions légales</p>
            <div className="grille-form">
              <label>
                Libellé NINA
                <input
                  value={form.nina_libelle || ''}
                  onChange={(e) => setForm({ ...form, nina_libelle: e.target.value })}
                />
              </label>
              <label>
                NINA
                <input
                  value={form.nina || ''}
                  onChange={(e) => setForm({ ...form, nina: e.target.value })}
                />
              </label>
              <label>
                NIF
                <input
                  value={form.nif || ''}
                  onChange={(e) => setForm({ ...form, nif: e.target.value })}
                />
              </label>
              <label>
                Centre des impôts
                <input
                  value={form.centre_impots || ''}
                  onChange={(e) => setForm({ ...form, centre_impots: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="formulaire-bloc">
            <p className="formulaire-bloc-titre">Alertes</p>
            <div className="grille-form">
              <label>
                Jours alerte péremption (5 mois = 150)
                <input
                  type="number"
                  min="1"
                  value={form.jours_alerte_peremption || 150}
                  onChange={(e) =>
                    setForm({ ...form, jours_alerte_peremption: Number(e.target.value) })
                  }
                />
                <span className="formulaire-aide">
                  Les lots qui expirent dans ce délai apparaissent en alerte.
                </span>
              </label>
            </div>
          </div>

          <div className="actions-form">
            <button type="submit" className="bouton-principal">
              Enregistrer
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
