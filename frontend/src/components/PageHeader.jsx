/**
 * En-tête de page : titre, sous-titre optionnel, actions à droite
 * et bouton PDF si `pdfCible` pointe vers une zone exportable.
 */
import BoutonPdf from './BoutonPdf';

/**
 * @param {string} titre — titre H1 de la page
 * @param {string} [sousTitre] — texte descriptif sous le titre
 * @param {React.ReactNode} [actions] — boutons / liens à droite
 * @param {string} [pdfCible] — sélecteur CSS / id zone export PDF
 * @param {string} [pdfNom] — nom du fichier PDF téléchargé
 */
export default function PageHeader({
  titre,
  sousTitre,
  actions,
  /** Sélecteur CSS / id de la zone à exporter (ex. #zone-pdf) */
  pdfCible,
  pdfNom,
}) {
  return (
    <header className="page-header no-print">
      {/* Colonne gauche : titre et sous-titre */}
      <div>
        <h1>{titre}</h1>
        {sousTitre ? <p className="page-sous-titre">{sousTitre}</p> : null}
      </div>
      {/* Colonne droite : PDF automatique + actions custom si l’un des deux est défini */}
      {actions || pdfCible ? (
        <div className="page-actions">
          {pdfCible ? (
            // Bouton réutilisable html2canvas + jsPDF
            <BoutonPdf cible={pdfCible} nom={pdfNom || titre} className="bouton-secondaire">
              Télécharger PDF
            </BoutonPdf>
          ) : null}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
