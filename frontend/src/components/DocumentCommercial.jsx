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

const MOYENS_DEFAUT = [
  'Espèce',
  'Orange Money',
  'Moov Money',
  'Wave',
  'Chèque',
  'Virement',
];

function statutFactureLibelle(statut) {
  if (statut === 'non_paye') return 'Impayé';
  if (statut === 'partiellement_paye') return 'Partiellement payé';
  if (statut === 'paye') return 'Payé';
  return libelleStatut(statut);
}

export default function DocumentCommercial({
  type = 'facture',
  document,
  parametres,
  actions,
}) {
  const estFacture = type === 'facture';
  const f = estFacture ? enrichirFacture(document) : document;
  const total = Number(f.montant_total ?? f.total ?? 0);
  const paye = Number(f.montant_paye || 0);
  const reste = Number(f.reste_a_payer ?? f.montant_reste ?? 0);
  const statut = estFacture ? f.statut_paiement : f.statut;
  const lignes = f.lignes || [];
  const totalArticles = lignes.reduce((s, l) => s + (Number(l.quantite) || 0), 0);
  const p = parametresAffichage(parametres);
  const statutClasse =
    statut === 'non_paye' || statut === 'partiellement_paye'
      ? 'texte-rouge'
      : 'texte-ok';

  const clientNom = f.client_nom || f.client || '—';
  const clientTel = f.client_telephone || f.telephone_client || '';

  return (
    <article
      className={`doc-sandia ${estFacture ? 'doc-facture' : 'doc-proforma'}`}
      id={estFacture ? 'document-facture-impression' : 'document-proforma-impression'}
    >
      <header className="doc-sandia-top">
        <Logo variant="document" />
        <div className="doc-sandia-infos">
          <p className="doc-nom-entreprise">{p.nom_pharmacie}</p>
          <p>{p.activite}</p>
          <p>{p.adresse}</p>
          <p>Tél. : {p.telephone}</p>
        </div>
      </header>

      <h1 className="doc-sandia-titre">{estFacture ? 'FACTURE' : 'PRO FORMA'}</h1>

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

      <div className="doc-cadre doc-cadre-plein">
        <p>
          <strong>Client :</strong> {clientNom}
          {clientTel ? ` ${clientTel}` : ''}
        </p>
        {estFacture ? (
          <p>
            <strong>Statut de paiement :</strong>{' '}
            <span className={statutClasse}>{statutFactureLibelle(statut)}</span>
          </p>
        ) : (
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

      <p className="doc-arrete">
        Arrêté {estFacture ? 'la présente facture' : 'le présent pro forma'} à la
        somme de : <em>{montantEnLettres(total)}</em>
      </p>

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

      <div className="doc-cadre doc-moyens-paiement">
        <p>
          <strong>
            {estFacture ? 'Moyen de paiement :' : 'Moyens de paiement acceptés :'}
          </strong>
        </p>
        {!estFacture ? (
          <p className="meta no-print">
            Ceci est un devis (pro forma). Pour une facture, validez une vente
            dans le menu Ventes (avec stock disponible).
          </p>
        ) : null}
        <div className="moyens-paiement-liste">
          {MOYENS_DEFAUT.map((moyen) => {
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
          <p className="meta">Aucun moyen enregistré sur cette facture.</p>
        ) : null}
      </div>

      {actions ? <div className="page-actions no-print">{actions}</div> : null}
    </article>
  );
}
