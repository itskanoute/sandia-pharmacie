/**
 * BoutonPdf.jsx — Bouton « Télécharger PDF »
 * ------------------------------------------
 * Transforme une zone HTML de la page (tableau, facture, etc.)
 * en fichier .pdf téléchargeable via html2canvas + jsPDF.
 */
import { useState } from 'react';
import { telechargerPdf } from '../utils/exportPdf';

/**
 * @param {string} cible - Sélecteur CSS ou id de la zone à exporter (ex. #zone-pdf)
 * @param {string} nom - Nom du fichier PDF téléchargé
 * @param {string} className - Classes CSS du bouton
 * @param {React.ReactNode} children - Texte affiché sur le bouton
 * @param {function} [onErreur] - Callback optionnel en cas d’échec
 * @param {function} [onSucces] - Callback optionnel après un export réussi
 */
export default function BoutonPdf({
  cible = '#zone-pdf', // zone HTML à capturer (par défaut #zone-pdf)
  nom = 'export', // nom du fichier sans extension
  className = 'bouton-secondaire',
  children = 'Télécharger PDF', // libellé du bouton au repos
  onErreur, // si fourni : gère l’erreur côté page parente
  onSucces, // si fourni : action après succès (message, etc.)
}) {
  // busy = true → export en cours (bouton désactivé + texte « PDF… »)
  const [busy, setBusy] = useState(false);

  /**
   * Handler du clic : génère et télécharge le PDF.
   * async car telechargerPdf attend la capture HTML + écriture du fichier.
   */
  async function cliquer() {
    // Empêche un double-clic pendant l’export
    setBusy(true);
    try {
      // Capture la zone « cible » et enregistre nom.pdf
      await telechargerPdf(cible, nom);
      // Notifie le parent si un callback de succès existe
      onSucces?.();
    } catch (e) {
      // Relaye le message d’erreur au parent (si défini)
      onErreur?.(e.message || String(e));
      // Sinon affiche une alerte navigateur par défaut
      if (!onErreur) {
        window.alert(e.message || 'Échec export PDF');
      }
    } finally {
      // Toujours réactiver le bouton (succès ou échec)
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      disabled={busy} // désactivé pendant la génération
      onClick={cliquer} // lance l’export au clic
    >
      {/* Texte dynamique selon l’état */}
      {busy ? 'PDF…' : children}
    </button>
  );
}
