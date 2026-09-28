/**
 * Export PDF côté navigateur : capture HTML (html2canvas) puis pagination A4 (jsPDF).
 * Ignore les éléments marqués no-print pour un rendu propre à l’impression.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Id (#zone-pdf), sélecteur CSS ou référence Element DOM → nœud HTML
function resoudreElement(cible) {
  if (!cible) return null;
  // Déjà un élément DOM passé directement
  if (typeof cible !== 'string') return cible;
  // Id sans # ou sélecteur querySelector
  return document.getElementById(cible.replace(/^#/, '')) || document.querySelector(cible);
}

// Nettoie le nom de fichier pour le disque (caractères spéciaux, longueur max)
function nomFichierSafe(nom) {
  return String(nom || 'document')
    .trim()
    .replace(/[^\w\-àâäéèêëïîôùûüç]+/gi, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

/**
 * Télécharge un vrai fichier .pdf à partir d’une zone HTML (tableau, facture, etc.).
 * @param {string|Element} cible — sélecteur ou élément à capturer
 * @param {string} [nomFichier] — base du nom sans extension
 */
export async function telechargerPdf(cible, nomFichier = 'document') {
  const el = resoudreElement(cible);
  if (!el) {
    throw new Error('Rien à exporter en PDF (zone introuvable).');
  }

  // Capture rasterisée de la zone (haute résolution, fond blanc)
  const canvas = await html2canvas(el, {
    scale: 2, // netteté à l’impression
    useCORS: true, // images cross-origin si autorisées
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    // Exclut barres d’outils et zones no-print du rendu PDF
    ignoreElements: (node) =>
      node?.classList?.contains('no-print') ||
      node?.classList?.contains('page-actions') ||
      node?.classList?.contains('barre-outils'),
  });

  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  // Hauteur de l’image redimensionnée à la largeur utile de page
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  // Première page : image ancrée en haut avec marges
  pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
  heightLeft -= usableHeight;

  // Découpe verticale : pages A4 supplémentaires si le contenu dépasse
  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
    heightLeft -= usableHeight;
  }

  // Déclenche le téléchargement navigateur
  pdf.save(`${nomFichierSafe(nomFichier)}.pdf`);
}
