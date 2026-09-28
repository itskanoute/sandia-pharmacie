/**
 * server.js — Serveur Express SAN-DIA (API + interface en production)
 * -------------------------------------------------------------------
 * Sécurité : helmet, CORS restreint, limite JSON, trust proxy, JWT_SECRET contrôlé.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { testConnection } = require('./config/db');
const {
  estProduction,
  assertJwtSecret,
  corsOriginCallback,
} = require('./config/security');

assertJwtSecret();

// Routes métier
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const medicamentsRoutes = require('./routes/medicaments');
const appareilsRoutes = require('./routes/appareils');
const parametresRoutes = require('./routes/parametres');
const proformasRoutes = require('./routes/proformas');
const ventesRoutes = require('./routes/ventes');
const facturesRoutes = require('./routes/factures');
const paiementsRoutes = require('./routes/paiements');
const fournisseursRoutes = require('./routes/fournisseurs');
const lotsRoutes = require('./routes/lots');
const stockRoutes = require('./routes/stock');
const statsRoutes = require('./routes/stats');
const commandesRoutes = require('./routes/commandes');
const receptionsRoutes = require('./routes/receptions');
const notesRoutes = require('./routes/notes');

const app = express();
const PORT = Number(process.env.PORT || 4000);

// Derrière Render / reverse-proxy (IP réelle pour rate-limit)
app.set('trust proxy', 1);

// En-têtes HTTP de sécurité (XSS, clickjacking, MIME sniffing…)
app.use(
  helmet({
    contentSecurityPolicy: estProduction()
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
  })
);

// Limite la taille des corps JSON (anti DoS)
app.use(express.json({ limit: '100kb' }));

// Rate-limit global API (hors health)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_API_MAX || 400),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes. Réessaie dans quelques minutes.' },
});
app.use('/api/', apiLimiter);

/** Santé de l’API + test MySQL (utilisé aussi par Render healthCheckPath) */
app.get('/api/health', async (_req, res) => {
  try {
    await testConnection();
    res.json({
      status: 'ok',
      message: 'API pharmacie Mali opérationnelle',
      fuseau: 'Africa/Bamako',
      devise: 'FCFA',
    });
  } catch (erreur) {
    const payload = {
      status: 'erreur',
      message: 'Connexion MySQL impossible.',
    };
    // Détail technique uniquement hors production
    if (!estProduction()) {
      payload.detail = erreur.message;
    }
    res.status(503).json(payload);
  }
});

// ---------- Montage des routes API ----------
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/medicaments', medicamentsRoutes);
app.use('/api/appareils', appareilsRoutes);
app.use('/api/parametres', parametresRoutes);
app.use('/api/proformas', proformasRoutes);
app.use('/api/ventes', ventesRoutes);
app.use('/api/factures', facturesRoutes);
app.use('/api/paiements', paiementsRoutes);
app.use('/api/fournisseurs', fournisseursRoutes);
app.use('/api/lots', lotsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/commandes', commandesRoutes);
app.use('/api/receptions', receptionsRoutes);
app.use('/api/notes', notesRoutes);

/* Production Docker/Render : un seul site (API + interface React) */
const distPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ message: `Route introuvable : ${req.method} ${req.path}` });
});

app.use((erreur, _req, res, _next) => {
  const status = erreur.status || 500;
  if (status >= 500) {
    console.error('Erreur API:', erreur.message);
  }
  res.status(status).json({
    message:
      status >= 500 && estProduction()
        ? 'Erreur serveur.'
        : erreur.message || 'Erreur serveur.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API démarrée sur http://localhost:${PORT}`);
  if (fs.existsSync(distPath)) {
    console.log(`Interface web servie depuis ${distPath}`);
  }

  const { synchroniserEmailAdmin } = require('./scripts/syncAdminEmail');
  synchroniserEmailAdmin().catch((e) => console.warn('[AUTH]', e.message));

  // Alertes péremption / stock / dettes → e-mail admins (Brevo en hébergement)
  const { demarrerSchedulerAlertes } = require('./services/alertesScheduler');
  demarrerSchedulerAlertes();
});
