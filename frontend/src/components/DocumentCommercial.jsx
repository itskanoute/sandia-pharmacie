/**
 * DocumentCommercial.jsx — Mise en page imprimable facture / pro forma
 * ---------------------------------------------------------------------
 * En-tête SAN-DIA, mentions légales, client, lignes produit, totaux,
 * montant en lettres, signatures et moyens de paiement.
 */
import Logo from './Logo';
import { formatFcfa } from '../utils/format';
import {
  formatDateDoc,
  formatDateHeureDoc,
  formatNombre,
  montantEnLettres,
} from '../utils/montantLettres';
import { enrichirFacture } from '../utils/paiement';
import { parametresAffichage } from '../data/sandia';
import { libelleStatut } from './Badge';

// Liste fixe des moyens de paiement affichés avec cases à cocher sur le document
const MOYENS_DEFAUT = [
  'Espèce',
  'Orange Money',
  'Moov Money',
  'Wave',
  'Chèque',
  'Virement',
];

/**
 * Libellé paiement spécifique aux factures (distinct des codes génériques Badge).
 * @param {string} statut — code API statut_paiement
 */
function statutFactureLibelle(statut) {
  // Correspondance explicite pour l’impression client
  if (statut === 'non_paye') return 'Impayé';
  if (statut === 'partiellement_paye') return 'Partiellement payé';
  if (statut === 'paye') return 'Payé';
  // Fallback : libellé générique du composant Badge
  return libelleStatut(statut);
}

/**
 * @param {'facture'|'proforma'} [type] — type de document à rendre
 * @param {object} document — facture ou pro forma (lignes, montants, client…)
 * @param {object} [parametres] — paramètres pharmacie (fusionnés avec défauts SAN-DIA)
 * @param {React.ReactNode} [actions] — boutons hors impression (no-print)
 */
export default function DocumentCommercial({
  type = 'facture', // par défaut : mise en page facture
  document, // données brutes API ou maquette parent
  parametres, // identité pharmacie pour l’en-tête
  actions, // barre d’actions optionnelle sous le document
}) {
  // true si on affiche une facture (sinon pro forma)
  const estFacture = type === 'facture';
  // Factures : enrichissement montants payés / reste via utilitaire paiement
  const f = estFacture ? enrichirFacture(document) : document;
  // Montant TTC : plusieurs clés possibles selon la source des données
  const total = Number(f.montant_total ?? f.total ?? 0);
  // Somme déjà encaissée (factures uniquement en pratique)
  const paye = Number(f.montant_paye || 0);
  // Solde restant dû au client
  const reste = Number(f.reste_a_payer ?? f.montant_reste ?? 0);
  // Statut affiché : paiement pour facture, statut métier pour pro forma
  const statut = estFacture ? f.statut_paiement : f.statut;
  // Lignes produit (tableau) — tableau vide si absent
  const lignes = f.lignes || [];
  // Somme des quantités pour le pied de tableau
  const totalArticles = lignes.reduce((s, l) => s + (Number(l.quantite) || 0), 0);
  // Paramètres fusionnés avec valeurs par défaut SAN-DIA
  const p = parametresAffichage(parametres);
  // Classe CSS rouge si impayé ou partiel, sinon vert
  const statutClasse =
    statut === 'non_paye' || statut === 'partiellement_paye'
      ? 'texte-rouge'
      : 'texte-ok';

  // Nom client : plusieurs champs possibles selon endpoint
  const clientNom = f.client_nom || f.client || '—';
  // Téléphone client optionnel à côté du nom
  const clientTel = f.client_telephone || f.telephone_client || '';

  return (
    <article
      className={`doc-sandia ${estFacture ? 'doc-facture' : 'doc-proforma'}`}
      id={estFacture ? 'document-facture-impression' : 'document-proforma-impression'}
    >
      {/* ---------- En-tête entreprise : logo + coordonnées paramètres ---------- */}
      <header className="doc-sandia-top">
        <Logo variant="document" />
        <div className="doc-sandia-infos">
          <p className="doc-nom-entreprise">{p.nom_pharmacie}</p>
          <p>{p.activite}</p>
          <p>{p.adresse}</p>
          <p>Tél. : {p.telephone}</p>
        </div>
      </header>

      {/* Titre principal du document (FACTURE ou PRO FORMA) */}
      <h1 className="doc-sandia-titre">{estFacture ? 'FACTURE' : 'PRO FORMA'}</h1>

      {/* Cadre mentions légales fiscales (NINA, NIF, centre impôts) */}
      <div className="doc-cadre doc-cadre-plein">
        <p>
          <strong>{p.nina_libelle} :</strong> {p.nina}
        </p>
        <p>
          <strong>NIF :</strong> {p.nif}
        </p>
        <p>
          <strong>Centre des impôts :</strong> {p.centre_impots}
        </p>
      </div>

      {/* Cadre numéro et dates (commande + édition) */}
      <div className="doc-cadre doc-cadre-plein">
        <p>
          <strong>Numéro :</strong> {f.numero}
        </p>
        <p>
          <strong>Date commande :</strong>{' '}
          {formatDateDoc(f.date_commande || f.date_facture || f.date_proforma || f.date)}
        </p>
        <p>
          <strong>Date édition :</strong>{' '}
          {formatDateHeureDoc(f.date_edition || f.created_at || f.date_facture || f.date_proforma || f.date)}
        </p>
      </div>

      {/* Cadre client + statut (paiement ou type/statut pro forma) */}
      <div className="doc-cadre doc-cadre-plein">
        <p>
          <strong>Client :</strong> {clientNom}
          {clientTel ? ` ${clientTel}` : ''}
        </p>
        {estFacture ? (
          // Facture : statut de paiement coloré
          <p>
            <strong>Statut de paiement :</strong>{' '}
            <span className={statutClasse}>{statutFactureLibelle(statut)}</span>
          </p>
        ) : (
          // Pro forma : type client et statut du devis
          <>
            <p>
              <strong>Type client :</strong> {libelleStatut(f.type_client)}
            </p>
            <p>
              <strong>Statut :</strong> {libelleStatut(f.statut)}
            </p>
          </>
        )}
      </div>

      {/* ---------- Tableau des lignes produit ---------- */}
      <div className="table-wrap doc-table">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Forme</th>
              <th>Dosage</th>
              <th>Qté</th>
              <th>P.U</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i}>
                <td>{l.produit || l.designation}</td>
                <td>{l.forme || '—'}</td>
                <td>{l.dosage || l.reference || '—'}</td>
                <td className="num">{l.quantite}</td>
                <td className="num">{formatNombre(l.prix ?? l.prix_unitaire)}</td>
                <td className="num">
                  {formatNombre(
                    l.total ?? l.montant_ligne ?? (l.prix || l.prix_unitaire) * l.quantite
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pied tableau : total articles + bloc montants */}
      <div className="doc-bas-tableau">
        <p>
          <strong>Total quantité :</strong> {totalArticles} article(s)
        </p>
        <div className="doc-totaux">
          <div>
            <span>Total</span>
            <strong>{formatFcfa(total)}</strong>
          </div>
          {estFacture ? (
            // Facture : versé et reste à payer
            <>
              <div>
                <span>Montant versé</span>
                <strong>{formatFcfa(paye)}</strong>
              </div>
              <div>
                <span>Reste à payer</span>
                <strong className={reste > 0 ? 'texte-rouge' : ''}>
                  {formatFcfa(reste)}
                </strong>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Montant légal en toutes lettres (français, FCFA) */}
      <p className="doc-arrete">
        Arrêté {estFacture ? 'la présente facture' : 'le présent pro forma'} à la
        somme de : <em>{montantEnLettres(total)}</em>
      </p>

      {/* Zones de signature client / fournisseur */}
      <div className="doc-signatures">
        <div>
          <p>Pour acquis</p>
          <div className="sig-zone" />
        </div>
        <div>
          <p>Fournisseur</p>
          <div className="sig-zone" />
          <p className="meta">{p.nom_pharmacie || 'SAN-DIA DISTRIBUTION'}</p>
        </div>
      </div>

      {/* Moyens de paiement : liste avec coche sur le moyen enregistré (facture) */}
      <div className="doc-cadre doc-moyens-paiement">
        <p>
          <strong>
            {estFacture ? 'Moyen de paiement :' : 'Moyens de paiement acceptés :'}
          </strong>
        </p>
        {!estFacture ? (
          // Rappel métier : pro forma ≠ facture définitive
          <p className="meta no-print">
            Ceci est un devis (pro forma). Pour une facture, validez une vente
            dans le menu Ventes (avec stock disponible).
          </p>
        ) : null}
        <div className="moyens-paiement-liste">
          {MOYENS_DEFAUT.map((moyen) => {
            // Sur facture : surligne le moyen enregistré en base
            const choisi = estFacture && f.moyen_paiement === moyen;
            return (
              <span
                key={moyen}
                className={`moyen-paiement-item ${choisi ? 'choisi' : ''}`}
              >
                <span
                  className={`case-paiement ${choisi ? 'coche' : ''}`}
                  aria-hidden="true"
                >
                  {choisi ? '✓' : ''}
                </span>
                {moyen}
              </span>
            );
          })}
        </div>
        {estFacture && !f.moyen_paiement ? (
          // Facture sans moyen renseigné
          <p className="meta">Aucun moyen enregistré sur cette facture.</p>
        ) : null}
      </div>

      {/* Actions parent (PDF, retour…) masquées à l’impression */}
      {actions ? <div className="page-actions no-print">{actions}</div> : null}
    </article>
  );
}
