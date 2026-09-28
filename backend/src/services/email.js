/**
 * Envoi d’e-mails transactionnels : Brevo (HTTPS), SMTP ou mode démo.
 * Modèles pour code de connexion et digest d’alertes administrateur.
 */
const dns = require('dns');
const nodemailer = require('nodemailer');
const { autoriseCodeDev } = require('../config/security');

/** Extrait { name, email } depuis « Nom <addr@…> » ou adresse seule. */
function parseAdresseFrom(fromRaw) {
  const raw = String(fromRaw || '').trim();
  const m = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) {
    return {
      name: m[1].trim().replace(/^["']|["']$/g, '') || 'SAN-DIA DISTRIBUTION',
      email: m[2].trim(),
    };
  }
  if (raw.includes('@')) {
    return { name: 'SAN-DIA DISTRIBUTION', email: raw };
  }
  return null;
}

/** Résout l’expéditeur selon variables .env (priorité SMTP_FROM → Brevo → admin). */
function expediteur() {
  return (
    parseAdresseFrom(process.env.SMTP_FROM) ||
    parseAdresseFrom(process.env.BREVO_SENDER_EMAIL) ||
    parseAdresseFrom(process.env.SMTP_USER) ||
    parseAdresseFrom(process.env.ADMIN_EMAIL) ||
    null
  );
}

/** Retourne un transport Nodemailer ou null si SMTP incomplet. */
function smtpConfigure() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    // Render : Gmail en IPv6 → ENETUNREACH ; forcer IPv4
    lookup: (hostname, _opts, cb) => {
      dns.lookup(hostname, { family: 4 }, cb);
    },
  });
}

/**
 * Brevo HTTP API (port 443) — fonctionne sur Render free (SMTP bloqué).
 * https://developers.brevo.com/docs/send-a-transactional-email
 */
async function envoyerViaBrevo({ to, subject, text, html }) {
  const apiKey = String(process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) return null;

  const sender = expediteur();
  if (!sender?.email) {
    throw new Error(
      'Brevo configuré mais expéditeur manquant : renseigne SMTP_FROM ou BREVO_SENDER_EMAIL (adresse vérifiée chez Brevo).'
    );
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      textContent: text || undefined,
      htmlContent: html || undefined,
    }),
  });

  const bodyText = await res.text();
  let bodyJson = null;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const detail =
      bodyJson?.message ||
      bodyJson?.error ||
      bodyText ||
      `HTTP ${res.status}`;
    throw new Error(`Brevo : ${detail}`);
  }

  return { mode: 'email', via: 'brevo', email: to, messageId: bodyJson?.messageId };
}

/** Envoi SMTP classique ; messages réseau remontés avec conseil Brevo sur Render. */
async function envoyerViaSmtp({ to, subject, text, html }) {
  const transport = smtpConfigure();
  if (!transport) return null;

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || undefined,
    });
  } catch (err) {
    const msg = String(err.message || err);
    console.error('[MAIL] Échec SMTP:', msg);
    if (/ENETUNREACH|ETIMEDOUT|ECONNREFUSED|ESOCKET|Connection timeout/i.test(msg)) {
      throw new Error(
        'Impossible d’envoyer le code par e-mail (réseau SMTP). Sur Render free, utilise BREVO_API_KEY (API HTTPS).'
      );
    }
    throw new Error(`Envoi e-mail impossible : ${msg}`);
  }

  return { mode: 'email', via: 'smtp', email: to };
}

/** Choix du canal d’envoi (Brevo → SMTP → dev / erreur). */
async function envoyerEmail({ to, subject, text, html }) {
  // 1) Brevo (recommandé en prod / Render)
  if (String(process.env.BREVO_API_KEY || '').trim()) {
    try {
      return await envoyerViaBrevo({ to, subject, text, html });
    } catch (err) {
      console.error('[MAIL] Échec Brevo:', err.message);
      throw err;
    }
  }

  // 2) SMTP local (Gmail, etc.) — souvent bloqué sur Render free
  const smtp = await envoyerViaSmtp({ to, subject, text, html });
  if (smtp) return smtp;

  console.warn('[MAIL] Aucun fournisseur e-mail (BREVO_API_KEY / SMTP). Message non envoyé à', to);
  console.warn('[MAIL]', subject, '\n', text);
  // Jamais en production : évite d’exposer OTP / contenus sensibles
  if (autoriseCodeDev()) {
    return { mode: 'dev', email: to };
  }
  throw new Error(
    'Envoi e-mail impossible : configure BREVO_API_KEY (Render) ou SMTP_HOST / SMTP_USER / SMTP_PASS en local.'
  );
}

/** Échappement minimal pour corps HTML transactionnels. */
function echapperHtml(valeur) {
  return String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFcfaMail(montant) {
  const n = Math.round(Number(montant) || 0);
  return `${n.toLocaleString('fr-FR')} FCFA`;
}

function formatDateMail(dateIso) {
  if (!dateIso) return '—';
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) {
    // déjà YYYY-MM-DD
    const m = String(dateIso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return String(dateIso);
  }
  return d.toLocaleDateString('fr-FR', {
    timeZone: 'Africa/Bamako',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function libelleJoursRestants(jours) {
  const j = Number(jours);
  if (Number.isNaN(j)) return '';
  if (j < 0) return `périmé depuis ${Math.abs(j)} jour(s)`;
  if (j === 0) return 'périme aujourd’hui';
  if (j === 1) return 'périme demain';
  if (j < 30) return `encore ${j} jours`;
  const mois = Math.round(j / 30);
  return `encore environ ${mois} mois (${j} jours)`;
}

/** E-mail OTP login (étape 1 auth). */
async function envoyerCodeConnexion(email, code, nomComplet) {
  const sujet = 'Code de connexion — SAN-DIA DISTRIBUTION';
  const texte = [
    `Bonjour ${nomComplet || ''},`,
    '',
    `Votre code de connexion est : ${code}`,
    'Il expire dans 10 minutes.',
    '',
    'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
    '',
    'SAN-DIA DISTRIBUTION — Pharmacie Mali',
  ].join('\n');

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;color:#1a2a23;line-height:1.5;max-width:520px">
    <p>Bonjour ${echapperHtml(nomComplet || '')},</p>
    <p>Voici votre code de connexion :</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#0f6b4c;margin:16px 0">${echapperHtml(code)}</p>
    <p style="color:#5a6d64">Il expire dans <strong>10 minutes</strong>.</p>
    <p style="color:#5a6d64;font-size:13px">Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>
    <p style="margin-top:24px;font-size:13px;color:#0a4d38"><strong>SAN-DIA DISTRIBUTION</strong> — Pharmacie Mali</p>
  </div>`;

  return envoyerEmail({ to: email, subject: sujet, text: texte, html });
}

/**
 * E-mail d’alertes clair pour les administrateurs (texte + HTML).
 */
async function envoyerAlertesAdmin(email, { stock, lots, peremption, dettes, seuils }) {
  const jours = seuils?.jours_alerte_peremption || 150;
  const seuilLot = seuils?.seuil_stock_lot || 50;
  const moisApprox = Math.round(jours / 30);

  const nStock = stock?.length || 0;
  const nLots = lots?.length || 0;
  const nPeremp = peremption?.length || 0;
  const nDettes = dettes?.length || 0;
  const total = nStock + nLots + nPeremp + nDettes;

  if (total === 0) {
    return { mode: 'aucune', email, total: 0 };
  }

  // Distinction lots déjà périmés vs bientôt périmés
  const perimes = (peremption || []).filter((p) => Number(p.jours_restants) <= 0);
  const bientotPerimes = (peremption || []).filter((p) => Number(p.jours_restants) > 0);
  const nExpires = perimes.length;
  const nBientot = bientotPerimes.length;

  const resumeParts = [];
  if (nExpires) resumeParts.push(`${nExpires} lot(s) DÉJÀ PÉRIMÉ(S)`);
  if (nBientot) resumeParts.push(`${nBientot} lot(s) bientôt périmé(s)`);
  if (nStock) resumeParts.push(`${nStock} produit(s) en stock bas`);
  if (nLots) resumeParts.push(`${nLots} lot(s) bientôt épuisé(s)`);
  if (nDettes) resumeParts.push(`${nDettes} dette(s) client`);

  const sujet = nExpires
    ? `SAN-DIA URGENT — ${nExpires} lot(s) périmé(s) à retirer`
    : `SAN-DIA — ${total} alerte${total > 1 ? 's' : ''} à traiter (${resumeParts.slice(0, 2).join(', ')})`;

  // ——— Texte brut (lisible sur mobile) ———
  const blocsTexte = [
    'Bonjour,',
    '',
    'Résumé des alertes SAN-DIA DISTRIBUTION (Pharmacie Mali) :',
    resumeParts.map((r) => `• ${r}`).join('\n'),
    '',
  ];

  if (nStock) {
    blocsTexte.push(
      `1) STOCK BAS — produits avec ${seuilLot} unités ou moins`,
      '   → À faire : commander ou réapprovisionner.',
      ''
    );
    for (const s of stock) {
      const qte = Number(s.stock_disponible);
      const etat = qte === 0 ? 'RUPTURE (plus rien en stock)' : `il reste ${qte} unité(s)`;
      blocsTexte.push(`   • ${s.nom} — ${etat}`);
    }
    blocsTexte.push('');
  }

  if (nLots) {
    blocsTexte.push(
      `2) LOTS PRESQUE VIDES — moins de ${seuilLot} unités dans le lot`,
      '   → À faire : vérifier le stock et prévoir une nouvelle entrée.',
      ''
    );
    for (const l of lots) {
      blocsTexte.push(
        `   • ${l.medicament_nom} (lot ${l.numero_lot}) — il reste ${l.quantite_disponible} unité(s)`
      );
    }
    blocsTexte.push('');
  }

  if (nPeremp) {
    if (nExpires) {
      blocsTexte.push(
        '3a) LOTS DÉJÀ PÉRIMÉS — à retirer du stock immédiatement',
        '   → À faire : sortir / détruire selon procédure, ne plus vendre.',
        ''
      );
      for (const p of perimes) {
        blocsTexte.push(
          `   • ${p.medicament_nom} (lot ${p.numero_lot}) — périmé depuis le ${formatDateMail(p.date_peremption)} — qté ${p.quantite_disponible}`
        );
      }
      blocsTexte.push('');
    }
    if (nBientot) {
      blocsTexte.push(
        `3b) PÉREMPTION PROCHE — dans les ${moisApprox} prochains mois (≤ ${jours} jours)`,
        '   → À faire : vendre en priorité ces lots.',
        ''
      );
      for (const p of bientotPerimes) {
        const etat = libelleJoursRestants(p.jours_restants);
        blocsTexte.push(
          `   • ${p.medicament_nom} (lot ${p.numero_lot}) — péremption le ${formatDateMail(p.date_peremption)} (${etat}) — qté ${p.quantite_disponible}`
        );
      }
      blocsTexte.push('');
    }
  }

  if (nDettes) {
    blocsTexte.push(
      '4) DETTES CLIENTS — factures non totalement payées',
      '   → À faire : relancer le client ou enregistrer un paiement.',
      ''
    );
    for (const d of dettes) {
      blocsTexte.push(
        `   • Facture ${d.numero} — ${d.client_nom || 'Client'} — reste à payer ${formatFcfaMail(d.montant_reste)}`
      );
    }
    blocsTexte.push('');
  }

  blocsTexte.push(
    'Connectez-vous sur le logiciel → menu Alertes pour traiter ces points.',
    '',
    'SAN-DIA DISTRIBUTION — Bamako / Mali'
  );

  const texte = blocsTexte.join('\n');

  // ——— HTML ———
  function tableau(headers, rowsHtml) {
    if (!rowsHtml) {
      return '<p style="color:#5a6d64;margin:8px 0 0">Rien dans cette catégorie.</p>';
    }
    return `
      <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:14px">
        <thead>
          <tr>
            ${headers
              .map(
                (h) =>
                  `<th style="text-align:left;padding:8px;background:#e7f3ed;border:1px solid #d3ddd7;color:#5a6d64;font-size:12px;text-transform:uppercase">${h}</th>`
              )
              .join('')}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
  }

  function section(titre, explication, action, contenu) {
    return `
      <div style="margin:22px 0;padding:14px 16px;border:1px solid #d3ddd7;border-radius:10px;background:#fff">
        <h2 style="margin:0 0 6px;font-size:16px;color:#0a4d38">${titre}</h2>
        <p style="margin:0;color:#5a6d64;font-size:13px">${explication}</p>
        <p style="margin:8px 0 0;font-size:13px"><strong style="color:#0f6b4c">À faire :</strong> ${action}</p>
        ${contenu}
      </div>`;
  }

  let sectionsHtml = '';

  if (nStock) {
    const rows = stock
      .map((s) => {
        const qte = Number(s.stock_disponible);
        const badge =
          qte === 0
            ? '<span style="color:#b42318;font-weight:700">Rupture</span>'
            : `<span style="color:#b54708;font-weight:600">${qte} restant(s)</span>`;
        return `<tr>
          <td style="padding:8px;border:1px solid #d3ddd7">${echapperHtml(s.nom)}</td>
          <td style="padding:8px;border:1px solid #d3ddd7">${badge}</td>
        </tr>`;
      })
      .join('');
    sectionsHtml += section(
      `① Stock bas (${nStock})`,
      `Produits dont le stock total est de ${seuilLot} unités ou moins.`,
      'Commander ou faire une entrée de lot.',
      tableau(['Produit', 'Situation'], rows)
    );
  }

  if (nLots) {
    const rows = lots
      .map(
        (l) => `<tr>
        <td style="padding:8px;border:1px solid #d3ddd7">${echapperHtml(l.medicament_nom)}</td>
        <td style="padding:8px;border:1px solid #d3ddd7"><code>${echapperHtml(l.numero_lot)}</code></td>
        <td style="padding:8px;border:1px solid #d3ddd7;font-weight:700;color:#b54708">${Number(l.quantite_disponible)}</td>
      </tr>`
      )
      .join('');
    sectionsHtml += section(
      `② Lots presque vides (${nLots})`,
      `Lots avec ${seuilLot} unités ou moins encore disponibles.`,
      'Vérifier et prévoir un réapprovisionnement.',
      tableau(['Médicament', 'N° lot', 'Reste'], rows)
    );
  }

  if (nPeremp) {
    const rows = peremption
      .map((p) => {
        const j = Number(p.jours_restants);
        const couleur = j <= 0 ? '#b42318' : '#b54708';
        return `<tr>
          <td style="padding:8px;border:1px solid #d3ddd7">${echapperHtml(p.medicament_nom)}</td>
          <td style="padding:8px;border:1px solid #d3ddd7"><code>${echapperHtml(p.numero_lot)}</code></td>
          <td style="padding:8px;border:1px solid #d3ddd7">${formatDateMail(p.date_peremption)}</td>
          <td style="padding:8px;border:1px solid #d3ddd7;color:${couleur};font-weight:600">${echapperHtml(libelleJoursRestants(j))}</td>
          <td style="padding:8px;border:1px solid #d3ddd7">${Number(p.quantite_disponible)}</td>
        </tr>`;
      })
      .join('');
    sectionsHtml += section(
      `③ Péremption à surveiller (${nPeremp})`,
      `Lots qui expirent dans les ${moisApprox} prochains mois (ou déjà périmés).`,
      'Vendre en priorité ces lots, ou les retirer s’ils sont périmés.',
      tableau(['Médicament', 'Lot', 'Date', 'Délai', 'Qté'], rows)
    );
  }

  if (nDettes) {
    const rows = dettes
      .map(
        (d) => `<tr>
        <td style="padding:8px;border:1px solid #d3ddd7">${echapperHtml(d.numero)}</td>
        <td style="padding:8px;border:1px solid #d3ddd7">${echapperHtml(d.client_nom || 'Client')}</td>
        <td style="padding:8px;border:1px solid #d3ddd7;font-weight:700;color:#b42318">${formatFcfaMail(d.montant_reste)}</td>
      </tr>`
      )
      .join('');
    sectionsHtml += section(
      `④ Dettes clients (${nDettes})`,
      'Factures pas encore totalement payées.',
      'Relancer le client ou enregistrer un paiement dans Dettes / Factures.',
      tableau(['Facture', 'Client', 'Reste à payer'], rows)
    );
  }

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;color:#1a2a23;line-height:1.45;max-width:680px;margin:0 auto;padding:8px">
    <div style="background:#123528;color:#e8f2ec;padding:16px 18px;border-radius:12px 12px 0 0">
      <p style="margin:0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#9fd5b8">SAN-DIA DISTRIBUTION</p>
      <h1 style="margin:6px 0 0;font-size:20px;color:#fff">Alertes à traiter</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#b7cfc3">${echapperHtml(resumeParts.join(' · '))}</p>
    </div>
    <div style="border:1px solid #d3ddd7;border-top:none;border-radius:0 0 12px 12px;padding:16px 18px;background:#f7faf8">
      <p style="margin:0 0 8px">Bonjour,</p>
      <p style="margin:0;color:#5a6d64;font-size:14px">
        Voici ce que le logiciel a détecté. Chaque bloc indique le problème et <strong>ce qu’il faut faire</strong>.
      </p>
      ${sectionsHtml}
      <p style="margin:20px 0 0;font-size:13px;color:#5a6d64">
        Ouvrez le logiciel → menu <strong>Alertes</strong> pour voir le détail et agir.
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#0a4d38">
        <strong>SAN-DIA DISTRIBUTION</strong> — Bamako / Mali · FCFA
      </p>
    </div>
  </div>`;

  const envoi = await envoyerEmail({ to: email, subject: sujet, text: texte, html });
  return { ...envoi, total };
}

/** API publique du module e-mail (auth + alertes + envoi générique). */
module.exports = {
  envoyerCodeConnexion,
  envoyerAlertesAdmin,
  envoyerEmail,
};
