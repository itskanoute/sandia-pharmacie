/**
 * Export PDF côté navigateur : capture HTML (html2canvas) puis pagination A4 (jsPDF).
 * Ajoute le logo SAN-DIA en haut de chaque export (sauf si déjà présent dans la zone).
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function resoudreElement(cible) {
  if (!cible) return null;
  if (typeof cible !== 'string') return cible;
  return document.getElementById(cible.replace(/^#/, '')) || document.querySelector(cible);
}

function nomFichierSafe(nom) {
  return String(nom || 'document')
    .trim()
    .replace(/[^\w\-àâäéèêëïîôùûüç]+/gi, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

/** URL absolue du logo (public/logo-sandia.png) */
function urlLogo() {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  return `${window.location.origin}${base}logo-sandia.png`.replace(/([^:]\/)\/+/g, '$1');
}

/**
 * Construit un bloc HTML temporaire : logo SAN-DIA + clone du contenu à exporter.
 */
function preparerZoneCapture(el) {
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-export-wrap';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:794px',
    'max-width:794px',
    'background:#ffffff',
    'padding:20px 24px',
    'box-sizing:border-box',
    'font-family:Segoe UI,Arial,sans-serif',
    'color:#1a2a23',
    'z-index:-1',
  ].join(';');

  // Évite un double logo sur facture / pro forma (DocumentCommercial)
  const dejaLogo = el.querySelector('.logo-sandia, .doc-sandia-top, .pdf-en-tete-logo');
  if (!dejaLogo) {
    const enTete = document.createElement('div');
    enTete.className = 'pdf-en-tete-logo';
    enTete.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin:0 0 18px;padding:0 0 14px;border-bottom:3px solid #0f6b4c">
        <img src="${urlLogo()}" alt="SAN-DIA DISTRIBUTION"
             crossorigin="anonymous"
             style="height:64px;width:auto;max-width:180px;object-fit:contain;display:block" />
        <div style="display:grid;gap:2px">
          <div style="font-weight:700;color:#0a4d38;font-size:17px;letter-spacing:0.02em">SAN-DIA DISTRIBUTION</div>
          <div style="font-size:12px;color:#5a6d64">Distribution fiable pour une santé durable</div>
          <div style="font-size:11px;color:#8eaa9a">Pharmacie Mali · Bamako · FCFA</div>
        </div>
      </div>`;
    wrapper.appendChild(enTete);
  }

  const clone = el.cloneNode(true);
  clone.querySelectorAll('.no-print, .page-actions, .barre-outils, .lien-action, .lien-danger').forEach(
    (n) => n.remove()
  );
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  return wrapper;
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

  const wrapper = preparerZoneCapture(el);

  try {
    // Laisse le temps au logo de charger avant la capture
    const img = wrapper.querySelector('img');
    if (img && !img.complete) {
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 1500);
      });
    }

    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
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
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    pdf.save(`${nomFichierSafe(nomFichier)}.pdf`);
  } finally {
    wrapper.remove();
  }
}
