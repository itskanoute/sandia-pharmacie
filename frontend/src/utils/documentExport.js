/**
 * Facade pour les documents commerciaux (facture, pro forma) :
 * impression navigateur ou téléchargement PDF via exportPdf.
 */
import { telechargerPdf } from './exportPdf';

// Ouvre la boîte de dialogue d’impression du navigateur (CSS @media print)
export function imprimerDocument() {
  window.print();
}

/** Télécharge un vrai fichier .pdf du document affiché (id DOM ou sélecteur). */
export async function telechargerDocumentPdf(elementId, nomFichier) {
  // Délègue la capture html2canvas + jsPDF
  await telechargerPdf(elementId, nomFichier || 'document');
}

/** @deprecated préfère telechargerDocumentPdf — alias conservé pour compatibilité pages */
export async function telechargerDocumentHtml(elementId, nomFichier) {
  return telechargerDocumentPdf(elementId, nomFichier);
}
