/**
 * Medicaments.jsx — Catalogue des médicaments : liste, recherche, création et modification.
 */
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Badge, libelleStatut, statutTone } from '../components/Badge';
import { apiCreerMedicament, apiMajMedicament, apiMedicaments } from '../api';
import { formatFcfa } from '../utils/format';

// Valeurs initiales du formulaire création médicament
const VIDE = {
  nom: '',
  reference: '',
  forme: '',
  dosage: '',
  prix_achat: 0,
  prix_client: 0,
  prix_revendeur: 0,
  seuil_alerte: 50,
  unite_gestion: 'boîte',
};

export default function Medicaments() {
  const [liste, setListe] = useState([]); // catalogue affiché dans le tableau
  const [recherche, setRecherche] = useState(''); // filtre texte API ?q=
  const [form, setForm] = useState(null); // null = pas de panneau formulaire
  // id MySQL en cours d’édition (null = création)
  const [editionId, setEditionId] = useState(null);
  const [erreur, setErreur] = useState(''); // message API ou validation
  const [chargement, setChargement] = useState(true); // spinner tableau

  // GET /api/medicaments avec filtre texte optionnel
  async function charger(q = '') {
    setChargement(true);
    setErreur('');
    try {
      setListe(await apiMedicaments(q));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  // Montage : charge la liste sans filtre
  useEffect(() => {
    charger();
  }, []);

  function ouvrirNouveau() {
    setEditionId(null);
    setForm({ ...VIDE });
  }

  // Préremplit le formulaire à partir d’une ligne du tableau
  function ouvrirEdit(m) {
    setEditionId(m.id);
    setForm({
      nom: m.nom || '',
      reference: m.reference || '',
      forme: m.forme || '',
      dosage: m.dosage || '',
      prix_achat: m.prix_achat || 0,
      prix_client: m.prix_client || 0,
      prix_revendeur: m.prix_revendeur || 0,
      seuil_alerte: m.seuil_alerte ?? 50,
      unite_gestion: m.unite_gestion || 'boîte',
      statut: m.statut || 'actif',
    });
  }

  function fermerForm() {
    setForm(null);
    setEditionId(null);
  }

  // POST ou PUT selon mode création / édition
  async function enregistrer(e) {
    e.preventDefault();
    setErreur('');
    try {
      if (editionId) await apiMajMedicament(editionId, form);
      else await apiCreerMedicament(form);
      fermerForm();
      await charger(recherche);
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="page page-medicaments">
      <PageHeader
        titre="Médicaments"
        sousTitre="Catalogue · prix FCFA · stock par lots"
        pdfCible="#zone-pdf"
        pdfNom="medicaments"
        actions={
          !form ? (
            <button type="button" className="bouton-principal" onClick={ouvrirNouveau}>
              + Ajouter un médicament
            </button>
          ) : null
        }
      />

      <div className="barre-outils">
        <input
          type="search"
          placeholder="Rechercher un médicament…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && charger(recherche)}
        />
        <button type="button" className="bouton-secondaire" onClick={() => charger(recherche)}>
          Rechercher
        </button>
      </div>

      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {form ? (
        <form className="med-formulaire" onSubmit={enregistrer}>
          <div className="med-formulaire-tete">
            <div>
              <h2>{editionId ? 'Modifier le médicament' : 'Nouveau médicament'}</h2>
              <p>Identité du produit, puis les prix en FCFA.</p>
            </div>
            <button type="button" className="bouton-secondaire" onClick={fermerForm}>
              Fermer
            </button>
          </div>

          <div className="med-bloc">
            <h3 className="med-bloc-titre">Identité</h3>
            <div className="med-grille med-grille--identite">
              <label className="med-champ med-champ--large">
                Nom du médicament
                <input
                  required
                  placeholder="Ex. Amoxicilline"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                />
              </label>
              <label className="med-champ">
                Référence
                <input
                  placeholder="Ex. AMOX-500"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                />
              </label>
              <label className="med-champ">
                Forme
                <input
                  placeholder="Comprimé, sirop…"
                  value={form.forme}
                  onChange={(e) => setForm({ ...form, forme: e.target.value })}
                />
              </label>
              <label className="med-champ">
                Dosage
                <input
                  placeholder="Ex. 500 mg"
                  value={form.dosage}
                  onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                />
              </label>
              <label className="med-champ">
                Unité
                <select
                  value={form.unite_gestion}
                  onChange={(e) => setForm({ ...form, unite_gestion: e.target.value })}
                >
                  <option value="boîte">Boîte</option>
                  <option value="flacon">Flacon</option>
                  <option value="unité">Unité</option>
                  <option value="plaquette">Plaquette</option>
                </select>
              </label>
            </div>
          </div>

          <div className="med-bloc">
            <h3 className="med-bloc-titre">Prix (FCFA)</h3>
            <div className="med-grille med-grille--prix">
              <label className="med-champ">
                Prix d’achat
                <input
                  type="number"
                  min="0"
                  value={form.prix_achat}
                  onChange={(e) => setForm({ ...form, prix_achat: Number(e.target.value) })}
                />
              </label>
              <label className="med-champ">
                Prix client
                <input
                  type="number"
                  min="0"
                  value={form.prix_client}
                  onChange={(e) => setForm({ ...form, prix_client: Number(e.target.value) })}
                />
              </label>
              <label className="med-champ">
                Prix revendeur
                <input
                  type="number"
                  min="0"
                  value={form.prix_revendeur}
                  onChange={(e) => setForm({ ...form, prix_revendeur: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>

          <div className="med-bloc">
            <h3 className="med-bloc-titre">Alerte stock</h3>
            <div className="med-grille med-grille--alerte">
              <label className="med-champ">
                Seuil d’alerte
                <input
                  type="number"
                  min="0"
                  value={form.seuil_alerte}
                  onChange={(e) => setForm({ ...form, seuil_alerte: Number(e.target.value) })}
                />
                <span className="med-aide">Alerte quand le stock total tombe à ce nombre ou moins (défaut 50).</span>
              </label>
              {editionId ? (
                <label className="med-champ">
                  Statut
                  <select
                    value={form.statut || 'actif'}
                    onChange={(e) => setForm({ ...form, statut: e.target.value })}
                  >
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </label>
              ) : null}
            </div>
          </div>

          <div className="med-form-pied">
            <button type="button" className="bouton-secondaire" onClick={fermerForm}>
              Annuler
            </button>
            <button type="submit" className="bouton-principal">
              {editionId ? 'Enregistrer les modifications' : 'Enregistrer le médicament'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="med-liste" id="zone-pdf">
        <div className="med-liste-tete">
          <h2>Catalogue</h2>
          <span className="meta">{liste.length} médicament(s)</span>
        </div>
        <div className="table-wrap med-table">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Référence</th>
                <th>Stock</th>
                <th>Prix client</th>
                <th>Prix revendeur</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {chargement ? (
                <tr>
                  <td colSpan={7}>Chargement…</td>
                </tr>
              ) : liste.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="med-vide">
                      <strong>Aucun médicament</strong>
                      <p>Ajoute le premier produit du catalogue.</p>
                      <button type="button" className="bouton-principal" onClick={ouvrirNouveau}>
                        + Ajouter un médicament
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                liste.map((m) => {
                  const stock = Number(m.stock_disponible || 0);
                  return (
                    <tr key={m.id}>
                      <td>
                        <strong className="med-nom">{m.nom}</strong>
                        <div className="meta">
                          {m.unite_gestion}
                          {m.forme ? ` · ${m.forme}` : ''}
                          {m.dosage ? ` · ${m.dosage}` : ''}
                        </div>
                      </td>
                      <td>
                        {m.reference ? (
                          <code className="med-code">{m.reference}</code>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {stock === 0 ? (
                          <Badge tone="critique">Rupture</Badge>
                        ) : stock <= Number(m.seuil_alerte || 0) ? (
                          <Badge tone="attention">{stock}</Badge>
                        ) : (
                          stock
                        )}
                      </td>
                      <td>{formatFcfa(m.prix_client)}</td>
                      <td>{formatFcfa(m.prix_revendeur)}</td>
                      <td>
                        <Badge tone={statutTone(m.statut)}>{libelleStatut(m.statut)}</Badge>
                      </td>
                      <td>
                        <button type="button" className="lien-action" onClick={() => ouvrirEdit(m)}>
                          Modifier
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
