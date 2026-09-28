/**
 * Lots.jsx — Suivi des lots et dates de péremption ; création et filtres d’alerte.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { apiCreerLot, apiLots, apiMedicaments } from '../api';
import { formatDate } from '../utils/format';

// État initial formulaire création de lot
const FORM_VIDE = {
  medicament_id: '',
  numero_lot: '',
  date_peremption: '',
  quantite: 1,
};

export default function Lots() {
  const [lots, setLots] = useState([]); // tous les lots API
  const [medicaments, setMedicaments] = useState([]); // select création lot
  const [formOuvert, setFormOuvert] = useState(false); // panneau formulaire visible
  const [form, setForm] = useState(FORM_VIDE);
  const [filtre, setFiltre] = useState(''); // recherche nom / n° lot
  const [filtreAlerte, setFiltreAlerte] = useState('tous'); // tous | peremption | stock | ok
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [chargement, setChargement] = useState(false);

  async function charger() {
    const [l, m] = await Promise.all([apiLots(), apiMedicaments()]);
    setLots(l);
    setMedicaments(m);
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  // Compteurs alertes péremption / stock bas pour les filtres
  const stats = useMemo(() => {
    const peremp = lots.filter((l) => l.alerte_peremption).length;
    const stockBas = lots.filter((l) => l.alerte_stock_lot).length;
    const ok = lots.filter((l) => !l.alerte_peremption && !l.alerte_stock_lot).length;
    return { total: lots.length, peremp, stockBas, ok };
  }, [lots]);

  // Filtre texte + type d’alerte (péremption, stock, OK)
  const lotsFiltres = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    return lots.filter((l) => {
      if (filtreAlerte === 'peremption' && !l.alerte_peremption) return false;
      if (filtreAlerte === 'stock' && !l.alerte_stock_lot) return false;
      if (filtreAlerte === 'ok' && (l.alerte_peremption || l.alerte_stock_lot)) return false;
      if (!q) return true;
      return (
        String(l.medicament_nom || '').toLowerCase().includes(q) ||
        String(l.numero_lot || '').toLowerCase().includes(q)
      );
    });
  }, [lots, filtre, filtreAlerte]);

  function ouvrirForm() {
    setErreur('');
    setMessage('');
    setForm({
      ...FORM_VIDE,
      medicament_id: medicaments[0]?.id || '',
    });
    setFormOuvert(true);
  }

  function fermerForm() {
    setFormOuvert(false);
    setForm(FORM_VIDE);
  }

  // POST /api/lots — incrémente le stock du médicament
  async function enregistrer(e) {
    e.preventDefault();
    setChargement(true);
    setErreur('');
    setMessage('');
    try {
      await apiCreerLot({
        ...form,
        medicament_id: Number(form.medicament_id),
        quantite: Number(form.quantite),
      });
      setMessage('Lot enregistré — stock mis à jour.');
      fermerForm();
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="page page-lots">
      <PageHeader
        titre="Lots & péremption"
        sousTitre="Entrée de stock · suivi des dates · alertes (5 mois / 50 unités)"
        pdfCible="#zone-pdf"
        pdfNom="lots"
        actions={
          !formOuvert ? (
            <button type="button" className="bouton-principal" onClick={ouvrirForm}>
              + Entrée de lot
            </button>
          ) : null
        }
      />

      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {formOuvert ? (
        <form className="lots-formulaire" onSubmit={enregistrer}>
          <div className="lots-formulaire-tete">
            <div>
              <h2>Nouvelle entrée de stock</h2>
              <p>Renseigne le lot reçu — la quantité s’ajoute au stock du médicament.</p>
            </div>
            <button type="button" className="bouton-secondaire" onClick={fermerForm}>
              Fermer
            </button>
          </div>

          <div className="lots-form-grille">
            <label className="lots-champ lots-champ--large">
              Médicament
              <select
                required
                value={form.medicament_id}
                onChange={(e) => setForm({ ...form, medicament_id: e.target.value })}
              >
                <option value="">Choisir un médicament…</option>
                {medicaments.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="lots-champ">
              N° de lot
              <input
                required
                placeholder="Ex. LOT-2026-01"
                value={form.numero_lot}
                onChange={(e) => setForm({ ...form, numero_lot: e.target.value })}
              />
            </label>
            <label className="lots-champ">
              Date de péremption
              <input
                type="date"
                required
                value={form.date_peremption}
                onChange={(e) => setForm({ ...form, date_peremption: e.target.value })}
              />
            </label>
            <label className="lots-champ">
              Quantité reçue
              <input
                type="number"
                min="1"
                required
                value={form.quantite}
                onChange={(e) => setForm({ ...form, quantite: e.target.value })}
              />
            </label>
          </div>

          <div className="lots-form-pied">
            <p className="meta">
              Pas le bon médicament ?{' '}
              <Link to="/medicaments">Gérer le catalogue</Link>
            </p>
            <div className="actions-form">
              <button type="button" className="bouton-secondaire" onClick={fermerForm}>
                Annuler
              </button>
              <button type="submit" className="bouton-principal" disabled={chargement}>
                {chargement ? 'Enregistrement…' : 'Enregistrer le lot'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div id="zone-pdf">
      <div className="lots-stats">
        <div className="lots-stat">
          <span className="lots-stat-valeur">{stats.total}</span>
          <span className="lots-stat-label">Lots actifs</span>
        </div>
        <div className={`lots-stat ${stats.peremp ? 'lots-stat--attention' : ''}`}>
          <span className="lots-stat-valeur">{stats.peremp}</span>
          <span className="lots-stat-label">Péremption ≤ 5 mois</span>
        </div>
        <div className={`lots-stat ${stats.stockBas ? 'lots-stat--attention' : ''}`}>
          <span className="lots-stat-valeur">{stats.stockBas}</span>
          <span className="lots-stat-label">Reste ≤ 50</span>
        </div>
        <div className="lots-stat lots-stat--ok">
          <span className="lots-stat-valeur">{stats.ok}</span>
          <span className="lots-stat-label">Sans alerte</span>
        </div>
      </div>

      <section className="lots-liste">
        <div className="lots-liste-tete">
          <h2>Lots en stock</h2>
          <div className="lots-filtres">
            <input
              type="search"
              className="lots-recherche"
              placeholder="Rechercher médicament ou n° lot…"
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
            />
            <div className="lots-pills" role="group" aria-label="Filtrer les alertes">
              {[
                { id: 'tous', label: 'Tous' },
                { id: 'peremption', label: 'Péremption' },
                { id: 'stock', label: 'Stock bas' },
                { id: 'ok', label: 'OK' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`lots-pill ${filtreAlerte === p.id ? 'actif' : ''}`}
                  onClick={() => setFiltreAlerte(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {lots.length === 0 ? (
          <div className="lots-vide">
            <strong>Aucun lot enregistré</strong>
            <p>Ajoute une première entrée de stock pour suivre les quantités et les dates de péremption.</p>
            <button type="button" className="bouton-principal" onClick={ouvrirForm}>
              + Première entrée de lot
            </button>
          </div>
        ) : lotsFiltres.length === 0 ? (
          <div className="lots-vide lots-vide--filtre">
            <strong>Aucun résultat</strong>
            <p>Modifie la recherche ou le filtre d’alerte.</p>
          </div>
        ) : (
          <div className="table-wrap lots-table">
            <table>
              <thead>
                <tr>
                  <th>Médicament</th>
                  <th>N° lot</th>
                  <th>Péremption</th>
                  <th>Quantité</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {lotsFiltres.map((l) => {
                  const perime = Number(l.jours_restants) <= 0;
                  const alerte = l.alerte_peremption || l.alerte_stock_lot;
                  return (
                    <tr key={l.id} className={alerte ? 'lots-ligne-alerte' : ''}>
                      <td>
                        <strong className="lots-nom">{l.medicament_nom}</strong>
                      </td>
                      <td>
                        <code className="lots-code">{l.numero_lot}</code>
                      </td>
                      <td>
                        <div className="lots-date-cell">
                          <span>{formatDate(l.date_peremption)}</span>
                          {l.alerte_peremption ? (
                            <Badge tone={perime ? 'critique' : 'attention'}>
                              {perime ? 'Périmé' : `${l.jours_restants} j`}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="lots-qte-cell">
                          <span className="lots-qte">{l.quantite_disponible}</span>
                          {l.alerte_stock_lot ? (
                            <Badge
                              tone={
                                Number(l.quantite_disponible) <= 10 ? 'critique' : 'attention'
                              }
                            >
                              ≤ 50
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {!alerte ? (
                          <Badge tone="ok">OK</Badge>
                        ) : perime ? (
                          <Badge tone="critique">Urgent</Badge>
                        ) : (
                          <Badge tone="attention">À surveiller</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
