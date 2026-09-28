/**
 * Middleware Express : vérifie le JWT Bearer et attache `req.utilisateur`.
 */
const jwt = require('jsonwebtoken');
const { assertJwtSecret } = require('../config/security');

const JWT_SECRET = assertJwtSecret();

/**
 * Bloque l’accès si l’en-tête Authorization Bearer est absent ou invalide.
 * En cas de succès, payload JWT disponible dans req.utilisateur (id, role, etc.).
 */
function authentifier(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.id) {
      return res.status(401).json({ message: 'Session invalide ou expirée.' });
    }
    req.utilisateur = payload;
    return next();
  } catch {
    return res.status(401).json({ message: 'Session invalide ou expirée.' });
  }
}

module.exports = { authentifier };
