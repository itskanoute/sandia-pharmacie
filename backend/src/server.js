require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/db');
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

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
    res.status(503).json({
      status: 'erreur',
      message: 'Connexion MySQL impossible. Vérifie backend/.env et que la base est importée.',
      detail: erreur.message,
    });
  }
});

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

/* En production : un seul site (API + interface) */
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
    message: erreur.message || 'Erreur serveur.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API démarrée sur http://localhost:${PORT}`);
  if (fs.existsSync(distPath)) {
    console.log(`Interface web servie depuis ${distPath}`);
  }

  const { synchroniserEmailAdmin } = require('./scripts/syncAdminEmail');
  synchroniserEmailAdmin().catch((e) => console.warn('[AUTH]', e.message));

  const { notifierAlertesAdmin } = require('./services/alertesService');
  const envoyer = () => {
    notifierAlertesAdmin()
      .then((r) => {
        if (r.mode === 'aucune') {
          console.log('[ALERTES] Aucune alerte à envoyer.');
        } else {
          console.log(
            `[ALERTES] Notification ${r.mode} → ${r.nb_destinataires || 1} admin(s) : ${r.admin_email} (${r.total} alerte(s))`
          );
        }
      })
      .catch((e) => console.warn('[ALERTES]', e.message));
  };

  setTimeout(envoyer, 45_000);
  setInterval(envoyer, 6 * 60 * 60 * 1000);
});
