/**
 * Impression / téléchargement document commercial (facture, pro forma).
 */

export function imprimerDocument() {
  window.print();
}

/** Télécharge le document affiché en fichier HTML (ouvrable / imprimable PDF). */
export function telechargerDocumentHtml(elementId, nomFichier) {
  const el = document.getElementById(elementId);
  if (!el) {
    throw new Error('Document introuvable à télécharger.');
  }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => {
      if (node.tagName === 'STYLE') return node.outerHTML;
      if (node.href) return `<link rel="stylesheet" href="${node.href}" />`;
      return '';
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${nomFichier}</title>
  ${styles}
  <style>
    body { background: #fff; margin: 0; padding: 16px; }
    .no-print { display: none !important; }
    .doc-sandia { box-shadow: none !important; border: none !important; max-width: 100% !important; }
  </style>
</head>
<body>
  ${el.outerHTML}
  <script>window.onload = function () { /* prêt pour impression PDF */ };</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomFichier}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
