/**
 * Proforma.jsx — Devis proforma : création, impression et conversion en facture.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DocumentCommercial from '../components/DocumentCommercial';
import {
  apiClients,
  apiCreerProforma,
  apiFacturerProforma,
  apiMedicaments,
  apiParametres,
  apiProforma,
  apiProformas,
} from '../api';
import { formatDate, formatFcfa } from '../utils/format';
import {
  imprimerDocument,
  telechargerDocumentHtml,
} from '../utils/documentExport';

const MOYENS = ['Espèce', 'Orange Money', 'Moov Money', 'Wave', 'Chèque', 'Virement'];

export default function Proforma() {
  const navigate = useNavigate(); // redirection après facturation
  // Liste des devis et document en cours de visualisation
  const [liste, setListe] = useState([]); // tableau historique pro forma
  const [clients, setClients] = useState([]);
  const [medicaments, setMedicaments] = useState([]);
  const [parametres, setParametres] = useState(null);
  const [clientId, setClientId] = useState('');
  const [typeClient, setTypeClient] = useState('ordinaire');
  const [lignes, setLignes] = useState([]);
  const [doc, setDoc] = useState(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [moyenPaiement, setMoyenPaiement] = useState('Espèce');
  const [montantPaye, setMontantPaye] = useState('');
  const [facturation, setFacturation] = useState(false);

  // Données pro formas, clients, médicaments et paramètres d’impression
  async function charger() {
    const [pfs, c, m, p] = await Promise.all([
      apiProformas(),
      apiClients(),
      apiMedicaments(),
      apiParametres(),
    ]);
    setListe(pfs);
    setClients(c);
    setMedicaments(m);
    setParametres(p);
    if (!clientId && c[0]) setClientId(String(c[0].id));
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  function prixPour(med) {
    return typeClient === 'revendeur'
      ? Number(med.prix_revendeur)
      : Number(med.prix_client);
  }

  function changerType(nouveauType) {
    setTypeClient(nouveauType);
    setClientId('');
    setLignes((prev) =>
      prev.map((l) => {
        const med = medicaments.find((m) => m.id === l.medicament_id);
        if (!med) return l;
        return { ...l, prix_unitaire: prixPourAvecType(med, nouveauType) };
      })
    );
  }

  function prixPourAvecType(med, type) {
    return type === 'revendeur'
      ? Number(med.prix_revendeur)
      : Number(med.prix_client);
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

  function ajouterLigne(med) {
    setLignes((prev) => {
      const ex = prev.find((l) => l.medicament_id === med.id);
      if (ex) {
        return prev.map((l) =>
          l.medicament_id === med.id ? { ...l, quantite: l.quantite + 1 } : l
        );
      }
      return [
        ...prev,
        {
          medicament_id: med.id,
          designation: med.nom,
          forme: med.forme || '',
          dosage: med.dosage || '',
          quantite: 1,
          prix_unitaire: prixPour(med),
        },
      ];
    });
  }

  // Crée un pro forma sans mouvement de stock
  async function creer() {
    if (!lignes.length) {
      setErreur('Ajoutez au moins un produit.');
      return;
    }
    try {
      const pf = await apiCreerProforma({
        client_id: clientId ? Number(clientId) : null,
        type_client: typeClient,
        statut: 'emis',
        lignes: lignes.map((l) => ({
          type_produit: 'medicament',
          medicament_id: l.medicament_id,
          designation: l.designation,
          forme: l.forme || null,
          dosage: l.dosage || null,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
        })),
      });
      setMessage(`Pro forma ${pf.numero} créé (sans impact stock).`);
      setLignes([]);
      setDoc(pf);
      await charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function voir(id) {
    try {
      const pf = await apiProforma(id);
      setDoc(pf);
      setMontantPaye(String(pf.montant_total || ''));
      setErreur('');
      setMessage('');
    } catch (e) {
      setErreur(e.message);
    }
  }

  // Convertit le pro forma en vente/facture (impact stock)
  async function creerFacture() {
    if (!doc) return;
    setFacturation(true);
    setErreur('');
    setMessage('');
    try {
      const paye =
        montantPaye === ''
          ? Number(doc.montant_total)
          : Math.round(Number(montantPaye));
      const data = await apiFacturerProforma(doc.id, {
        moyen_paiement: moyenPaiement,
        montant_paye_initial: paye,
      });
      setMessage(data.message);
      navigate(`/factures`);
      // Forcer refresh côté factures : on passe quand même l'info
      sessionStorage.setItem('sandia_derniere_facture_id', String(data.facture.id));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setFacturation(false);
    }
  }

  // Total du brouillon avant création
  const total = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

  // Mode aperçu document : PDF + conversion facture
  if (doc) {
    const client = clients.find((c) => Number(c.id) === Number(doc.client_id));
    const dejaFacture = doc.statut === 'converti_vente';
    return (
      <div className="page">
        <PageHeader
          titre={`Pro forma ${doc.numero}`}
          sousTitre={
            dejaFacture
              ? 'Déjà transformé en facture'
              : 'Enregistré ✓ — devis (pas encore facture)'
          }
          actions={
            <div className="actions-form no-print">
              <button
                type="button"
                className="bouton-principal"
                onClick={async () => {
                  try {
                    await telechargerDocumentHtml(
                      'document-proforma-impression',
                      doc.numero || 'proforma'
                    );
                  } catch (e) {
                    setErreur(e.message);
                  }
                }}
              >
                Télécharger PDF
              </button>
              <button type="button" className="bouton-secondaire" onClick={() => setDoc(null)}>
                Retour
              </button>
            </div>
          }
        />

        {message ? <p className="message-succes">{message}</p> : null}
        {erreur ? <p className="message-erreur">{erreur}</p> : null}

        {!dejaFacture ? (
          <div className="carte-formulaire">
            <h3>Créer la facture à partir de ce pro forma</h3>
            <p className="meta">
              Le pro forma est déjà enregistré. Clique ici pour baisser le stock et
              créer la facture (il faut du stock disponible).
            </p>
            <div className="grille-form">
              <label>
                Moyen de paiement
                <select
                  value={moyenPaiement}
                  onChange={(e) => setMoyenPaiement(e.target.value)}
                >
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
                  max={doc.montant_total}
                  value={montantPaye}
                  onChange={(e) => setMontantPaye(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="bouton-principal"
              disabled={facturation}
              onClick={creerFacture}
            >
              {facturation ? 'Création…' : 'Enregistrer → Facture'}
            </button>
          </div>
        ) : (
          <p className="message-succes">
            Déjà facturé.{' '}
            <Link to="/factures">Voir les factures</Link>
          </p>
        )}

        <DocumentCommercial
          type="proforma"
          document={{
            ...doc,
            client_nom: client?.nom || doc.client_nom,
            client_telephone: client?.telephone,
            client_adresse: client?.adresse,
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
        titre="Pro forma"
        sousTitre="Devis sans sortie de stock"
        pdfCible="#zone-pdf"
        pdfNom="proforma"
      />
      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      <div className="carte-formulaire">
        <div className="formulaire-tete">
          <div>
            <h3>Nouveau pro forma</h3>
            <p>Devis sans sortie de stock — transformable en facture plus tard.</p>
          </div>
        </div>
        <div className="grille-form">
          <label>
            Type de tarif
            <select value={typeClient} onChange={(e) => changerType(e.target.value)}>
              <option value="ordinaire">Client ordinaire</option>
              <option value="revendeur">Revendeur</option>
            </select>
          </label>
          <label>
            Client
            <select value={clientId} onChange={(e) => choisirClient(e.target.value)}>
              <option value="">—</option>
              {clients
                .filter((c) => c.type_client === typeClient)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
            </select>
          </label>
        </div>
        {typeClient === 'revendeur' ? (
          <p className="message-info">
            Prix revendeur appliqués.{' '}
            <Link to="/revendeurs">Espace Revendeurs</Link>
          </p>
        ) : null}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Produit</th><th>Prix</th><th></th></tr></thead>
            <tbody>
              {medicaments.slice(0, 30).map((m) => (
                <tr key={m.id}>
                  <td>{m.nom}</td>
                  <td>{formatFcfa(prixPour(m))}</td>
                  <td>
                    <button type="button" className="lien-action" onClick={() => ajouterLigne(m)}>
                      Ajouter
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Lignes ({formatFcfa(total)})</h3>
        <ul>
          {lignes.map((l) => (
            <li key={l.medicament_id}>
              {l.designation} × {l.quantite} = {formatFcfa(l.quantite * l.prix_unitaire)}
            </li>
          ))}
        </ul>
        <button type="button" className="bouton-principal" onClick={creer}>
          Créer le pro forma
        </button>
      </div>

      <div className="table-wrap" id="zone-pdf">
        <table>
          <thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id}>
                <td>{p.numero}</td>
                <td>{formatDate(p.date_proforma)}</td>
                <td>{p.client_nom || '—'}</td>
                <td>{formatFcfa(p.montant_total)}</td>
                <td>
                  <button type="button" className="lien-action" onClick={() => voir(p.id)}>
                    Voir
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
