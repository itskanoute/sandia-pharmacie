/**
 * Factures.jsx — Factures : liste, détail, encaissements et export document.
 */
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Badge, libelleStatut, statutTone } from '../components/Badge';
import DocumentCommercial from '../components/DocumentCommercial';
import {
  apiCreerPaiement,
  apiFacture,
  apiFactures,
  apiParametres,
} from '../api';
import { formatDate, formatFcfa } from '../utils/format';
import {
  imprimerDocument,
  telechargerDocumentHtml,
} from '../utils/documentExport';

export default function Factures() {
  const [liste, setListe] = useState([]); // toutes les factures
  // Facture détaillée affichée (mode document)
  const [doc, setDoc] = useState(null); // non null → vue DocumentCommercial
  const [parametres, setParametres] = useState(null);
  const [montant, setMontant] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  async function charger() {
    const [facs, p] = await Promise.all([apiFactures(), apiParametres()]);
    setListe(facs);
    setParametres(p);
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  // GET /api/factures/:id pour aperçu et PDF
  async function ouvrir(id) {
    try {
      setDoc(await apiFacture(id));
      setMessage('');
    } catch (e) {
      setErreur(e.message);
    }
  }

  // Encaissement partiel ou total sur la facture ouverte
  async function payer() {
    const m = Math.round(Number(montant));
    if (!doc || !m) return;
    try {
      const data = await apiCreerPaiement({
        facture_id: doc.id,
        montant: m,
        moyen_paiement: doc.moyen_paiement,
      });
      setDoc(data.facture);
      setMontant('');
      setMessage('Paiement enregistré.');
      await charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  // Export PDF de la zone #document-facture-impression
  async function telechargerPdf() {
    try {
      await telechargerDocumentHtml(
        'document-facture-impression',
        doc.numero || 'facture'
      );
      setMessage('PDF téléchargé.');
    } catch (e) {
      setErreur(e.message);
    }
  }

  // Vue document : impression, PDF et paiement du solde (remplace la liste)
  if (doc) {
    return (
      <div className="page">
        <PageHeader
          titre={`Facture ${doc.numero}`}
          sousTitre="Téléchargeable pour le client"
          actions={
            <div className="actions-form no-print">
              <button type="button" className="bouton-principal" onClick={telechargerPdf}>
                Télécharger PDF
              </button>
              <button type="button" className="bouton-secondaire" onClick={imprimerDocument}>
                Imprimer
              </button>
              <button type="button" className="bouton-secondaire" onClick={() => setDoc(null)}>
                Retour
              </button>
            </div>
          }
        />
        {message ? <p className="message-succes no-print">{message}</p> : null}
        {erreur ? <p className="message-erreur no-print">{erreur}</p> : null}

        {Number(doc.montant_reste) > 0 ? (
          <div className="carte-formulaire no-print">
            <label>
              Paiement / avance (reste {formatFcfa(doc.montant_reste)})
              <input
                type="number"
                min="1"
                max={doc.montant_reste}
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
              />
            </label>
            <button type="button" className="bouton-principal" onClick={payer}>
              Enregistrer le paiement
            </button>
          </div>
        ) : null}

        <DocumentCommercial
          type="facture"
          document={{
            ...doc,
            lignes: (doc.lignes || []).map((l) => ({
              ...l,
              produit: l.designation,
              forme: l.forme || '—',
              dosage: l.dosage || '—',
              prix: l.prix_unitaire,
              total: l.montant_ligne,
            })),
          }}
          parametres={parametres}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        titre="Factures"
        sousTitre="Issues des ventes validées — téléchargeables pour les clients"
        pdfCible="#zone-pdf"
        pdfNom="liste-factures"
      />
      {erreur ? <p className="message-erreur">{erreur}</p> : null}
      <div className="table-wrap" id="zone-pdf">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Client</th>
              <th>Total</th>
              <th>Payé</th>
              <th>Reste</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  Aucune facture. Validez une vente ou facturez un pro forma.
                </td>
              </tr>
            ) : (
              liste.map((f) => (
                <tr key={f.id}>
                  <td>{f.numero}</td>
                  <td>{formatDate(f.date_facture)}</td>
                  <td>{f.client_nom || '—'}</td>
                  <td>{formatFcfa(f.montant_total)}</td>
                  <td>{formatFcfa(f.montant_paye)}</td>
                  <td>{formatFcfa(f.montant_reste)}</td>
                  <td>
                    <Badge tone={statutTone(f.statut_paiement)}>
                      {libelleStatut(f.statut_paiement)}
                    </Badge>
                  </td>
                  <td>
                    <button type="button" className="lien-action" onClick={() => ouvrir(f.id)}>
                      Voir / PDF
                    </button>
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
