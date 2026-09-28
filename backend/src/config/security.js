/**
 * Helpers sécurité SAN-DIA — secrets, mode prod, CORS, codes démo.
 */
function estProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * AUTH_ALLOW_DEV_CODE jamais actif en production
 * (évite de renvoyer le code OTP dans la réponse API).
 */
function autoriseCodeDev() {
  if (estProduction()) return false;
  return String(process.env.AUTH_ALLOW_DEV_CODE || '').toLowerCase() === 'true';
}

/**
 * Refuse de démarrer en prod si JWT_SECRET absent / trop faible / valeur d’exemple.
 */
function assertJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  const faible =
    !secret ||
    secret.length < 24 ||
    /change-moi|secret|password|123456/i.test(secret);

  if (faible) {
    const msg =
      '[SEC] JWT_SECRET manquant ou trop faible. Définis une valeur longue et aléatoire (≥ 24 caractères).';
    if (estProduction()) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(msg + ' (autorisé uniquement en développement local)');
  }
  return secret;
}

/** Origins CORS autorisées (CSV). Vide en local = permissif ; en prod = strict. */
function corsOriginCallback(origin, callback) {
  const liste = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Requêtes same-origin / outils sans Origin (health Render, curl)
  if (!origin) {
    return callback(null, true);
  }

  if (liste.length === 0) {
    if (estProduction()) {
      // Prod sans liste : n’autorise que same-host implicite (pas de cross-origin)
      return callback(null, false);
    }
    return callback(null, true);
  }

  if (liste.includes('*') || liste.includes(origin)) {
    return callback(null, true);
  }
  return callback(null, false);
}

module.exports = {
  estProduction,
  autoriseCodeDev,
  assertJwtSecret,
  corsOriginCallback,
};
