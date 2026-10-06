/**
 * Revendeurs.jsx — Revendeurs : liste, création, ventes au tarif revendeur et dettes.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Badge } from '../components/Badge';
import {
  apiClients,
  apiCreerClient,
  apiCreerVente,
  apiDettes,
  apiMedicaments,
  apiVentes,
} from '../api';
import { formatDateHeure, formatFcfa } from '../utils/format';

const MOYENS = ['Espèce', 'Orange Money', 'Moov Money', 'Wave', 'Chèque', 'Virement'];

export default function Revendeurs() {
  // Parcours vente dédié aux clients revendeurs (tarif prix_revendeur)
  const [revendeurs, setRevendeurs] = useState([]); // clients type revendeur
  const [medicaments, setMedicaments] = useState([]);
  const [historique, setHistorique] = useState([]); // ventes revendeur uniquement
  const [dettes, setDettes] = useState([]); // dettes du revendeur sélectionné
  const [clientId, setClientId] = useState(''); // revendeur actif caisse
  const [recherche, setRecherche] = useState('');
  const [panier, setPanier] = useState([]); // lignes vente en cours
  const [montantPaye, setMontantPaye] = useState('');
  const [moyenPaiement, setMoyenPaiement] = useState('Espèce');
  const [nouveau, setNouveau] = useState(null);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  async function charger() {
    const [r, m, v] = await Promise.all([
      apiClients('', 'revendeur'),
      apiMedicaments(),
      apiVentes(),
    ]);
    setRevendeurs(r);
    setMedicaments(m);
    setHistorique(v.filter((x) => x.type_client === 'revendeur'));
    if (!clientId && r[0]) setClientId(String(r[0].id));
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  // Dettes du revendeur sélectionné
  useEffect(() => {
    if (!clientId) {
      setDettes([]);
      return;
    }
    apiDettes(clientId)
      .then(setDettes)
      .catch(() => setDettes([]));
  }, [clientId]);

  const produits = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const base = medicaments;
    if (!q) return base;
    return base.filter(
      (m) =>
        m.nom.toLowerCase().includes(q) ||
        String(m.reference || '').toLowerCase().includes(q)
    );
  }, [medicaments, recherche]);

  const revendeur = revendeurs.find((c) => String(c.id) === String(clientId));

  function ajouter(produit) {
    const stock = Number(produit.stock_disponible);
    if (stock <= 0) {
      setErreur(`${produit.nom} est en rupture de stock.`);
      return;
    }
    const prix = Number(produit.prix_revendeur || 0);
    if (prix <= 0) {
      setErreur(
        `${produit.nom} n’a pas de prix revendeur. Renseigne-le dans Médicaments.`
      );
      return;
    }
    setErreur('');
    setPanier((prev) => {
      const existant = prev.find((l) => l.id === produit.id);
      if (existant) {
        if (existant.quantite >= stock) return prev;
        return prev.map((l) =>
          l.id === produit.id ? { ...l, quantite: l.quantite + 1 } : l
        );
      }
      return [
        ...prev,
        {
          id: produit.id,
          nom: produit.nom,
          forme: produit.forme || '',
          dosage: produit.dosage || '',
          prix,
          quantite: 1,
          stock,
        },
      ];
    });
  }

  const total = panier.reduce((s, l) => s + l.prix * l.quantite, 0);

  // Enregistre la vente revendeur (même API que la page Ventes)
  async function valider() {
    if (!clientId) {
      setErreur('Choisissez un revendeur.');
      return;
    }
    if (!panier.length) return;
    const payeSaisi = montantPaye === '' ? total : Math.round(Number(montantPaye));
    if (Number.isNaN(payeSaisi) || payeSaisi < 0 || payeSaisi > total) {
      setErreur('Montant payé invalide.');
      return;
    }

    setChargement(true);
    setErreur('');
    setMessage('');
    try {
      const data = await apiCreerVente({
        client_id: Number(clientId),
        type_client: 'revendeur',
        moyen_paiement: moyenPaiement,
        montant_paye_initial: payeSaisi,
        lignes: panier.map((l) => ({
          type_produit: 'medicament',
          medicament_id: l.id,
          designation: l.nom,
          forme: l.forme,
          dosage: l.dosage,
          quantite: l.quantite,
          prix_unitaire: l.prix,
        })),
      });
      setMessage(
        `Vente revendeur OK · Facture ${data.facture.numero} · ${formatFcfa(data.vente.montant_total)}`
      );
      setPanier([]);
      setMontantPaye('');
      await charger();
      const d = await apiDettes(clientId);
      setDettes(d);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  async function creerRevendeur(e) {
    e.preventDefault();
    try {
      const cree = await apiCreerClient({
        ...nouveau,
        type_client: 'revendeur',
      });
      setNouveau(null);
      await charger();
      setClientId(String(cree.id));
      setMessage(`Revendeur « ${cree.nom} » créé.`);
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="page">
      <PageHeader
        titre="Revendeurs"
        sousTitre="Vente au prix revendeur · clients professionnels"
        pdfCible="#zone-pdf"
        pdfNom="revendeurs"
        actions={
          <button
            type="button"
            className="bouton-principal"
            onClick={() =>
              setNouveau({ nom: '', telephone: '', adresse: '', informations: '' })
            }
          >
            + Nouveau revendeur
          </button>
        }
      />

      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {nouveau ? (
        <form className="carte-formulaire" onSubmit={creerRevendeur}>
          <div className="formulaire-tete">
            <div>
              <h3>Nouveau revendeur</h3>
              <p>Client professionnel au tarif revendeur.</p>
            </div>
          </div>
          <div className="grille-form">
            <label>
              Nom
              <input
                required
                value={nouveau.nom}
                onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })}
              />
            </label>
            <label>
              Téléphone
              <input
                value={nouveau.telephone}
                onChange={(e) => setNouveau({ ...nouveau, telephone: e.target.value })}
              />
            </label>
            <label>
              Adresse
              <input
                value={nouveau.adresse}
                onChange={(e) => setNouveau({ ...nouveau, adresse: e.target.value })}
              />
            </label>
          </div>
          <div className="actions-form">
            <button type="button" className="bouton-secondaire" onClick={() => setNouveau(null)}>
              Annuler
            </button>
            <button type="submit" className="bouton-principal">
              Enregistrer
            </button>
          </div>
        </form>
      ) : null}

      {revendeurs.length === 0 ? (
        <div className="bandeau-alertes-site">
          <strong>Aucun revendeur</strong>
          <p>Crée un revendeur pour vendre au tarif professionnel.</p>
        </div>
      ) : null}

      <div id="zone-pdf">
      <div className="caisse-grid">
        <div>
          <div className="barre-outils">
            <label style={{ flex: 1 }}>
              Revendeur
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Choisir…</option>
                {revendeurs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                    {c.telephone ? ` · ${c.telephone}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="search"
              placeholder="Produit…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          {revendeur ? (
            <p className="message-info">
              Prix <strong>revendeur</strong> appliqués pour {revendeur.nom}.
            </p>
          ) : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Stock</th>
                  <th>Prix revendeur</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {produits.map((p) => {
                  const stock = Number(p.stock_disponible);
                  const rupture = stock <= 0;
                  return (
                    <tr key={p.id}>
                      <td>{p.nom}</td>
                      <td>
                        {rupture ? (
                          <Badge tone="critique">0</Badge>
                        ) : (
                          stock
                        )}
                      </td>
                      <td>{formatFcfa(p.prix_revendeur)}</td>
                      <td>
                        {rupture ? (
                          <span className="meta">Rupture</span>
                        ) : (
                          <button
                            type="button"
                            className="lien-action"
                            onClick={() => ajouter(p)}
                          >
                            Ajouter
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panier-panel">
          <h3>Panier revendeur</h3>
          {panier.length === 0 ? (
            <p className="meta panier-vide">Vide — ajoute des produits depuis le catalogue</p>
          ) : (
            <ul className="liste-panier">
              {panier.map((l) => (
                <li key={l.id}>
                  <div className="panier-ligne-info">
                    <strong>{l.nom}</strong>
                    <div className="meta">
                      {l.quantite} × {formatFcfa(l.prix)} = {formatFcfa(l.prix * l.quantite)}
                    </div>
                  </div>
                  <input
                    className="input-qte"
                    type="number"
                    min="1"
                    max={l.stock}
                    value={l.quantite}
                    aria-label={`Quantité ${l.nom}`}
                    onChange={(e) =>
                      setPanier((prev) =>
                        prev
                          .map((x) =>
                            x.id === l.id
                              ? {
                                  ...x,
                                  quantite: Math.max(
                                    0,
                                    Math.min(l.stock, Number(e.target.value) || 0)
                                  ),
                                }
                              : x
                          )
                          .filter((x) => x.quantite > 0)
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="panier-total">
            <span>Total</span>
            <strong>{formatFcfa(total)}</strong>
          </div>

          <div className="panier-paiement">
            <label>
              Moyen de paiement
              <select value={moyenPaiement} onChange={(e) => setMoyenPaiement(e.target.value)}>
                {MOYENS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Montant payé maintenant
              <input
                type="number"
                min="0"
                max={total}
                placeholder={String(total)}
                value={montantPaye}
                onChange={(e) => setMontantPaye(e.target.value)}
              />
            </label>
          </div>

          <button
            type="button"
            className="bouton-principal panier-valider"
            disabled={!panier.length || !clientId || chargement}
            onClick={valider}
          >
            {chargement ? 'Validation…' : 'Valider vente revendeur'}
          </button>
          <p className="meta panier-liens">
            <Link to="/factures">Voir factures</Link>
            <span aria-hidden="true"> · </span>
            <Link to="/dettes">Dettes</Link>
          </p>
        </div>
      </div>

      {clientId ? (
        <section className="carte-formulaire">
          <h3>Dettes de {revendeur?.nom || 'ce revendeur'}</h3>
          {dettes.length === 0 ? (
            <p className="meta">Aucune dette.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Facture</th>
                    <th>Reste</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {dettes.map((d) => (
                    <tr key={d.id}>
                      <td>{d.numero}</td>
                      <td>{formatFcfa(d.montant_reste)}</td>
                      <td>{d.statut_paiement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <h3>Historique ventes revendeurs</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Client</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            {historique.length === 0 ? (
              <tr>
                <td colSpan={4}>Aucune vente revendeur.</td>
              </tr>
            ) : (
              historique.map((v) => (
                <tr key={v.id}>
                  <td>{v.numero}</td>
                  <td>{formatDateHeure(v.date_vente)}</td>
                  <td>{v.client_nom || '—'}</td>
                  <td>{formatFcfa(v.montant_total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
