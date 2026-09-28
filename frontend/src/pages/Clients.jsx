/**
 * Clients.jsx — Fiches clients : factures, proformas, dettes et paiements.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Badge, libelleStatut, statutTone } from '../components/Badge';
import {
  apiClients,
  apiCreerClient,
  apiCreerPaiement,
  apiDettes,
  apiFactures,
  apiMajClient,
  apiProformas,
} from '../api';
import { formatDate, formatFcfa } from '../utils/format';

export default function Clients() {
  const [clients, setClients] = useState([]); // liste principale
  // Client sélectionné pour la fiche détaillée (factures, dettes…)
  const [ficheId, setFicheId] = useState(null); // id ou null = pas de fiche
  const [factures, setFactures] = useState([]); // filtrées par ficheId
  const [proformas, setProformas] = useState([]);
  const [dettes, setDettes] = useState([]);
  const [form, setForm] = useState(null); // création / édition client
  const [montant, setMontant] = useState(''); // paiement rapide depuis fiche
  const [facturePaiementId, setFacturePaiementId] = useState('');
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  async function chargerListe() {
    setClients(await apiClients());
  }

  useEffect(() => {
    chargerListe().catch((e) => setErreur(e.message));
  }, []);

  // Charge l’historiel commercial du client ouvert
  useEffect(() => {
    if (!ficheId) return;
    Promise.all([
      apiFactures(`?client_id=${ficheId}`),
      apiProformas(),
      apiDettes(ficheId),
    ])
      .then(([facs, pfs, dets]) => {
        setFactures(facs);
        setProformas(pfs.filter((p) => Number(p.client_id) === Number(ficheId)));
        setDettes(dets);
      })
      .catch((e) => setErreur(e.message));
  }, [ficheId]);

  const client = clients.find((c) => c.id === ficheId) || null;

  // Agrégats factures pour la fiche client
  const totaux = useMemo(() => {
    const totalFacture = factures.reduce((s, f) => s + Number(f.montant_total || 0), 0);
    const totalPaye = factures.reduce((s, f) => s + Number(f.montant_paye || 0), 0);
    const totalRestant = factures.reduce((s, f) => s + Number(f.montant_reste || 0), 0);
    return { totalFacture, totalPaye, totalRestant };
  }, [factures]);

  // Crée ou met à jour la fiche client
  async function enregistrerClient(e) {
    e.preventDefault();
    try {
      if (form.id) await apiMajClient(form.id, form);
      else await apiCreerClient(form);
      setForm(null);
      await chargerListe();
    } catch (err) {
      setErreur(err.message);
    }
  }

  // Encaissement depuis la fiche client
  async function payer() {
    const m = Math.round(Number(montant));
    if (!facturePaiementId || !m) {
      setMessage('Choisissez une facture et un montant.');
      return;
    }
    try {
      await apiCreerPaiement({
        facture_id: Number(facturePaiementId),
        montant: m,
        notes: 'Paiement fiche client',
      });
      setMontant('');
      setFacturePaiementId('');
      setMessage(`Paiement ${formatFcfa(m)} enregistré.`);
      const [facs, dets] = await Promise.all([
        apiFactures(`?client_id=${ficheId}`),
        apiDettes(ficheId),
      ]);
      setFactures(facs);
      setDettes(dets);
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (client) {
    return (
      <div className="page">
        <PageHeader
          titre={`Fiche client — ${client.nom}`}
          sousTitre="Pro forma · factures · dettes"
          actions={
            <button type="button" className="bouton-secondaire" onClick={() => setFicheId(null)}>
              Retour
            </button>
          }
        />
        {message ? <p className="message-info">{message}</p> : null}
        {erreur ? <p className="message-erreur">{erreur}</p> : null}

        <div className="kpi-grid">
          <div className="kpi"><span>Facturé</span><strong>{formatFcfa(totaux.totalFacture)}</strong></div>
          <div className="kpi"><span>Payé</span><strong>{formatFcfa(totaux.totalPaye)}</strong></div>
          <div className="kpi"><span>Reste</span><strong>{formatFcfa(totaux.totalRestant)}</strong></div>
        </div>

        <h3>Dettes</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Facture</th><th>Date</th><th>Reste</th><th>Statut</th></tr></thead>
            <tbody>
              {dettes.length === 0 ? (
                <tr><td colSpan={4}>Aucune dette.</td></tr>
              ) : (
                dettes.map((d) => (
                  <tr key={d.id}>
                    <td>{d.numero}</td>
                    <td>{formatDate(d.date_facture)}</td>
                    <td>{formatFcfa(d.montant_reste)}</td>
                    <td><Badge tone={statutTone(d.statut_paiement)}>{libelleStatut(d.statut_paiement)}</Badge></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="carte-formulaire">
          <h3>Enregistrer un paiement</h3>
          <div className="grille-form">
            <label>
              Facture
              <select value={facturePaiementId} onChange={(e) => setFacturePaiementId(e.target.value)}>
                <option value="">Choisir…</option>
                {dettes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.numero} — reste {formatFcfa(d.montant_reste)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Montant
              <input type="number" min="1" value={montant} onChange={(e) => setMontant(e.target.value)} />
            </label>
          </div>
          <button type="button" className="bouton-principal" onClick={payer}>Payer</button>
        </div>

        <h3>Factures</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Date</th><th>Total</th><th>Payé</th><th>Reste</th></tr></thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id}>
                  <td>{f.numero}</td>
                  <td>{formatDate(f.date_facture)}</td>
                  <td>{formatFcfa(f.montant_total)}</td>
                  <td>{formatFcfa(f.montant_paye)}</td>
                  <td>{formatFcfa(f.montant_reste)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Pro forma</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Date</th><th>Total</th><th>Statut</th></tr></thead>
            <tbody>
              {proformas.length === 0 ? (
                <tr><td colSpan={4}>Aucun pro forma.</td></tr>
              ) : (
                proformas.map((p) => (
                  <tr key={p.id}>
                    <td>{p.numero}</td>
                    <td>{formatDate(p.date_proforma)}</td>
                    <td>{formatFcfa(p.montant_total)}</td>
                    <td>{p.statut}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        titre="Clients"
        sousTitre="Fiches clients"
        pdfCible="#zone-pdf"
        pdfNom="clients"
        actions={
          <div className="actions-form">
            <Link to="/revendeurs" className="bouton-secondaire">
              Espace Revendeurs
            </Link>
            <button
              type="button"
              className="bouton-principal"
              onClick={() => setForm({ nom: '', telephone: '', adresse: '', type_client: 'ordinaire' })}
            >
              + Nouveau client
            </button>
          </div>
        }
      />
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {form ? (
        <form className="carte-formulaire" onSubmit={enregistrerClient}>
          <div className="formulaire-tete">
            <div>
              <h3>Nouveau client</h3>
              <p>Fiche client pour ventes et factures.</p>
            </div>
          </div>
          <div className="grille-form">
            <label>Nom<input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></label>
            <label>Téléphone<input value={form.telephone || ''} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></label>
            <label>Adresse<input value={form.adresse || ''} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></label>
            <label>
              Type
              <select value={form.type_client} onChange={(e) => setForm({ ...form, type_client: e.target.value })}>
                <option value="ordinaire">Ordinaire</option>
                <option value="revendeur">Revendeur</option>
              </select>
            </label>
          </div>
          <div className="actions-form">
            <button type="button" className="bouton-secondaire" onClick={() => setForm(null)}>Annuler</button>
            <button type="submit" className="bouton-principal">Enregistrer</button>
          </div>
        </form>
      ) : null}

      <div className="table-wrap" id="zone-pdf">
        <table>
          <thead><tr><th>Nom</th><th>Téléphone</th><th>Type</th><th></th></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.nom}</strong></td>
                <td>{c.telephone || '—'}</td>
                <td>{c.type_client}</td>
                <td>
                  <button type="button" className="lien-action" onClick={() => setFicheId(c.id)}>Fiche</button>
                  {' '}
                  <button
                    type="button"
                    className="lien-action"
                    onClick={() => setForm({ ...c })}
                  >
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
