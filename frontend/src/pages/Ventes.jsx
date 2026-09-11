import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { apiClients, apiCreerVente, apiMedicaments, apiVentes } from '../api';
import { formatDateHeure, formatFcfa } from '../utils/format';

const MOYENS = ['Espèce', 'Orange Money', 'Moov Money', 'Wave', 'Chèque', 'Virement'];

export default function Ventes() {
  const [clients, setClients] = useState([]);
  const [medicaments, setMedicaments] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [typeClient, setTypeClient] = useState('ordinaire');
  const [clientId, setClientId] = useState('');
  const [recherche, setRecherche] = useState('');
  const [panier, setPanier] = useState([]);
  const [montantPaye, setMontantPaye] = useState('');
  const [moyenPaiement, setMoyenPaiement] = useState('Espèce');
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [derniereFacture, setDerniereFacture] = useState(null);
  const [chargement, setChargement] = useState(false);

  async function charger() {
    const [c, m, v] = await Promise.all([apiClients(), apiMedicaments(), apiVentes()]);
    setClients(c);
    setMedicaments(m);
    setHistorique(v);
    if (!clientId && c[0]) setClientId(String(c[0].id));
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  const clientsFiltres = useMemo(
    () => clients.filter((c) => c.type_client === typeClient),
    [clients, typeClient]
  );

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

  const ruptures = useMemo(
    () => medicaments.filter((m) => Number(m.stock_disponible) <= 0),
    [medicaments]
  );

  function prixPour(p) {
    return typeClient === 'revendeur' ? Number(p.prix_revendeur) : Number(p.prix_client);
  }

  function changerType(nouveauType) {
    setTypeClient(nouveauType);
    setClientId('');
    setPanier((prev) =>
      prev.map((l) => {
        const med = medicaments.find((m) => m.id === l.id);
        if (!med) return l;
        return {
          ...l,
          prix:
            nouveauType === 'revendeur'
              ? Number(med.prix_revendeur)
              : Number(med.prix_client),
        };
      })
    );
  }

  function choisirClient(id) {
    setClientId(id);
    if (!id) return;
    const c = clients.find((x) => String(x.id) === String(id));
    if (c && c.type_client !== typeClient) {
      changerType(c.type_client);
      setClientId(id);
    }
  }

  function ajouter(produit) {
    const stock = Number(produit.stock_disponible);
    if (stock <= 0) {
      setErreur(
        `${produit.nom} est en rupture. Ajoutez du stock via Lots ou Réceptions avant de vendre.`
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
          forme: produit.forme || produit.unite_gestion || '',
          dosage: produit.dosage || '',
          prix: prixPour(produit),
          quantite: 1,
          stock,
        },
      ];
    });
  }

  const total = panier.reduce((s, l) => s + l.prix * l.quantite, 0);

  async function validerVente() {
    if (!panier.length) return;
    if (!moyenPaiement) {
      setMessage('Choisissez un moyen de paiement.');
      return;
    }
    const payeSaisi = montantPaye === '' ? total : Math.round(Number(montantPaye));
    if (Number.isNaN(payeSaisi) || payeSaisi < 0 || payeSaisi > total) {
      setMessage('Montant payé invalide.');
      return;
    }

    setChargement(true);
    setErreur('');
    setMessage('');
    try {
      const data = await apiCreerVente({
        client_id: clientId ? Number(clientId) : null,
        type_client: typeClient,
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
      setDerniereFacture(data.facture);
      setMessage(
        `Vente ${data.vente.numero} validée · Facture ${data.facture.numero} · Stock mis à jour.`
      );
      setPanier([]);
      setMontantPaye('');
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        titre="Ventes"
        sousTitre="Panier · validation · facture · stock"
        actions={
          <Link to="/revendeurs" className="bouton-secondaire">
            Espace Revendeurs
          </Link>
        }
      />
      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}
      {derniereFacture ? (
        <p className="message-info">
          <Link to="/factures">Voir les factures</Link> — {derniereFacture.numero} (
          {libelleReste(derniereFacture)})
        </p>
      ) : null}
      {typeClient === 'revendeur' ? (
        <p className="message-info">
          Tarif <strong>revendeur</strong> actif.{' '}
          <Link to="/revendeurs">Ouvrir l’espace dédié</Link> pour un parcours plus fluide.
        </p>
      ) : null}

      {ruptures.length > 0 ? (
        <div className="bandeau-alertes-site">
          <strong>Rupture de stock</strong>
          <p>
            {ruptures.map((r) => r.nom).join(', ')} : stock 0 — impossible à vendre tant
            qu’il n’y a pas d’entrée de lot.
          </p>
          <Link to="/lots">Ajouter du stock (Lots)</Link>
          {' · '}
          <Link to="/receptions">Ou via Réceptions</Link>
        </div>
      ) : null}

      <div className="caisse-grid">
        <div>
          <div className="barre-outils">
            <select value={typeClient} onChange={(e) => changerType(e.target.value)}>
              <option value="ordinaire">Client ordinaire</option>
              <option value="revendeur">Revendeur</option>
            </select>
            <select value={clientId} onChange={(e) => choisirClient(e.target.value)}>
              <option value="">Sans client</option>
              {clientsFiltres.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
            <input
              type="search"
              placeholder="Produit…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Produit</th><th>Stock</th><th>Prix</th><th></th></tr></thead>
              <tbody>
                {produits.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Aucun médicament trouvé.</td>
                  </tr>
                ) : (
                  produits.map((p) => {
                    const stock = Number(p.stock_disponible);
                    const rupture = stock <= 0;
                    return (
                      <tr key={p.id}>
                        <td>{p.nom}</td>
                        <td>{rupture ? <span className="texte-rouge">0 (rupture)</span> : stock}</td>
                        <td>{formatFcfa(prixPour(p))}</td>
                        <td>
                          {rupture ? (
                            <span className="meta">Indisponible</span>
                          ) : (
                            <button type="button" className="lien-action" onClick={() => ajouter(p)}>
                              Ajouter
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panier-panel">
          <h3>Panier</h3>
          {panier.length === 0 ? (
            <p className="meta">Vide</p>
          ) : (
            <ul className="liste-panier">
              {panier.map((l) => (
                <li key={l.id}>
                  <strong>{l.nom}</strong>
                  <div className="meta">
                    {l.quantite} × {formatFcfa(l.prix)} = {formatFcfa(l.prix * l.quantite)}
                  </div>
                  <input
                    className="input-qte"
                    type="number"
                    min="1"
                    max={l.stock}
                    value={l.quantite}
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
          <p><strong>Total : {formatFcfa(total)}</strong></p>
          <label>
            Moyen de paiement
            <select value={moyenPaiement} onChange={(e) => setMoyenPaiement(e.target.value)}>
              {MOYENS.map((m) => (
                <option key={m} value={m}>{m}</option>
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
          <button
            type="button"
            className="bouton-principal"
            disabled={!panier.length || chargement}
            onClick={validerVente}
          >
            {chargement ? 'Validation…' : 'Valider la vente'}
          </button>
        </div>
      </div>

      <h3>Historique</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Montant</th><th>Statut</th></tr></thead>
          <tbody>
            {historique.map((v) => (
              <tr key={v.id}>
                <td>{v.numero}</td>
                <td>{formatDateHeure(v.date_vente)}</td>
                <td>{v.client_nom || '—'}</td>
                <td>{formatFcfa(v.montant_total)}</td>
                <td>{v.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function libelleReste(facture) {
  if (facture.statut_paiement === 'paye') return 'Payée';
  if (facture.statut_paiement === 'partiellement_paye') {
    return `Reste ${formatFcfa(facture.montant_reste)}`;
  }
  return 'Non payée';
}
