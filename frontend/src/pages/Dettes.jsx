/**
 * Dettes.jsx — Créances : soldes restants et enregistrement des paiements.
 */
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Badge, libelleStatut, statutTone } from '../components/Badge';
import { apiCreerPaiement, apiDettes } from '../api';
import { formatDate, formatFcfa } from '../utils/format';

export default function Dettes() {
  // Factures avec solde restant dû
  const [liste, setListe] = useState([]); // factures avec montant_reste > 0
  const [factureId, setFactureId] = useState(''); // select paiement
  const [montant, setMontant] = useState(''); // montant encaissé FCFA
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  // GET /api/factures/dettes
  async function charger() {
    setListe(await apiDettes());
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  // POST /api/paiements puis rafraîchit la liste des dettes
  async function payer() {
    try {
      await apiCreerPaiement({
        facture_id: Number(factureId),
        montant: Math.round(Number(montant)),
      });
      setMessage('Paiement enregistré.');
      setMontant('');
      setFactureId('');
      await charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  const total = liste.reduce((s, d) => s + Number(d.montant_reste || 0), 0);

  return (
    <div className="page">
      <PageHeader
        titre="Dettes clients"
        sousTitre={`Total dû : ${formatFcfa(total)}`}
        pdfCible="#zone-pdf"
        pdfNom="dettes"
      />
      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      <div className="carte-formulaire">
        <div className="formulaire-tete">
          <div>
            <h3>Enregistrer un paiement</h3>
            <p>Réduit la dette du client sur la facture choisie.</p>
          </div>
        </div>
        <div className="grille-form">
          <label>
            Facture
            <select value={factureId} onChange={(e) => setFactureId(e.target.value)}>
              <option value="">Choisir…</option>
              {liste.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.numero} — {d.client_nom || 'Client'} — {formatFcfa(d.montant_reste)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Montant
            <input type="number" min="1" value={montant} onChange={(e) => setMontant(e.target.value)} />
          </label>
        </div>
        <div className="actions-form">
          <button type="button" className="bouton-principal" onClick={payer} disabled={!factureId}>
            Enregistrer le paiement
          </button>
        </div>
      </div>

      <div className="table-wrap" id="zone-pdf">
        <table>
          <thead>
            <tr>
              <th>Facture</th>
              <th>Client</th>
              <th>Date</th>
              <th>Total</th>
              <th>Reste</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr><td colSpan={6}>Aucune dette.</td></tr>
            ) : (
              liste.map((d) => (
                <tr key={d.id}>
                  <td>{d.numero}</td>
                  <td>{d.client_nom || '—'}</td>
                  <td>{formatDate(d.date_facture)}</td>
                  <td>{formatFcfa(d.montant_total)}</td>
                  <td>{formatFcfa(d.montant_reste)}</td>
                  <td>
                    <Badge tone={statutTone(d.statut_paiement)}>
                      {libelleStatut(d.statut_paiement)}
                    </Badge>
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
