/**
 * Planifie l’envoi périodique des alertes (stock / péremption / dettes) par e-mail.
 * Sur Render free le service s’endort : couplez avec un cron externe → POST /api/stats/alertes/cron
 */
const { notifierAlertesAdmin } = require('./alertesService');

function intervalMs() {
  const h = Number(process.env.ALERTES_INTERVAL_HEURES || 6);
  const heures = Number.isFinite(h) && h > 0 ? Math.min(h, 168) : 6;
  return heures * 60 * 60 * 1000;
}

function alertesEmailActives() {
  return String(process.env.ALERTES_EMAIL_ENABLED || 'true').toLowerCase() !== 'false';
}

async function executerCycleAlertes(origine = 'scheduler') {
  if (!alertesEmailActives()) {
    console.log(`[ALERTES] Désactivées (ALERTES_EMAIL_ENABLED=false) — skip (${origine})`);
    return { mode: 'desactive', origine };
  }

  if (!String(process.env.BREVO_API_KEY || '').trim() && !process.env.SMTP_HOST) {
    console.warn(
      `[ALERTES] Aucun e-mail configuré (BREVO_API_KEY recommandé sur Render). Skip (${origine}).`
    );
    return { mode: 'sans_config', origine };
  }

  const r = await notifierAlertesAdmin();
  const nPeremp = r.details?.peremption || 0;
  if (r.mode === 'aucune') {
    console.log(`[ALERTES] Aucune alerte (${origine}).`);
  } else {
    console.log(
      `[ALERTES] ${origine} → ${r.mode} · ${r.nb_destinataires || 1} admin(s) · ` +
        `${r.total} alerte(s) dont ${nPeremp} péremption → ${r.admin_email}`
    );
  }
  return { ...r, origine };
}

function demarrerSchedulerAlertes() {
  if (!alertesEmailActives()) {
    console.log('[ALERTES] Scheduler non démarré (ALERTES_EMAIL_ENABLED=false).');
    return;
  }

  const ms = intervalMs();
  const heures = ms / (60 * 60 * 1000);

  const lancer = () => {
    executerCycleAlertes('auto').catch((e) => console.warn('[ALERTES]', e.message));
  };

  // Premier passage après 1 min (le service a le temps de démarrer)
  setTimeout(lancer, 60_000);
  setInterval(lancer, ms);
  console.log(
    `[ALERTES] Scheduler actif : toutes les ${heures} h (+ cron externe recommandé sur Render free).`
  );
}

module.exports = {
  demarrerSchedulerAlertes,
  executerCycleAlertes,
  alertesEmailActives,
};
