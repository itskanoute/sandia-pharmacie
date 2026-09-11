const jwt = require('jsonwebtoken');

function authentifier(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.utilisateur = payload;
    return next();
  } catch {
    return res.status(401).json({ message: 'Session invalide ou expirée.' });
  }
}

module.exports = { authentifier };
