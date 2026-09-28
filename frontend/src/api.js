/**
 * Client HTTP du frontend SAN-DIA.
 * Gère l’URL de l’API, le token JWT et le profil en localStorage,
 * plus les fonctions `api()` et les wrappers par domaine (auth, stock, ventes…).
 */
// URL de base : variable Vite, localhost en dev, même origine en prod
const API_URL = (
  import.meta.env.VITE_API_URL != null && String(import.meta.env.VITE_API_URL).trim() !== ''
    ? String(import.meta.env.VITE_API_URL).trim()
    : import.meta.env.DEV
      ? 'http://localhost:4000'
      : ''
).replace(/\/$/, '');
// Clés localStorage pour la session administrateur
const TOKEN_KEY = 'sandia_token';
const USER_KEY = 'sandia_utilisateur';

// Récupère le JWT pour l’en-tête Authorization
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

// Enregistre ou supprime le token après connexion / déconnexion
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Profil admin mis en cache pour affichage immédiat au rechargement
export function getUtilisateurStocke() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Appelé après validation du code e-mail : persiste token + utilisateur
export function sauvegarderSession(token, utilisateur) {
  setToken(token);
  if (utilisateur) localStorage.setItem(USER_KEY, JSON.stringify(utilisateur));
}

// Déconnexion : efface token et profil du navigateur
export function effacerSession() {
  setToken('');
  localStorage.removeItem(USER_KEY);
}

/** Requête JSON vers l’API avec en-tête Authorization si session active. */
export async function api(chemin, options = {}) {
  // En-têtes par défaut + Bearer si connecté
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_URL}${chemin}`;
  const reponse = await fetch(url, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await reponse.json().catch(() => ({}));
  // Erreurs HTTP remontées comme exceptions avec message serveur
  if (!reponse.ok) {
    const erreur = new Error(data.message || `Erreur API (${reponse.status})`);
    erreur.status = reponse.status;
    erreur.data = data;
    throw erreur;
  }
  return data;
}

/* ---------- Auth : connexion, session, gestion admins ---------- */
export const apiStatutAuth = () => api('/api/auth/statut'); // premier admin existe ?
export const apiCreerAdmin = (body) => api('/api/auth/creer-admin', { method: 'POST', body }); // inscription publique
export const apiLogin = (nom_utilisateur, mot_de_passe) =>
  api('/api/auth/login', { method: 'POST', body: { nom_utilisateur, mot_de_passe } }); // envoi code e-mail
export const apiVerifierCode = (utilisateur_id, code) =>
  api('/api/auth/verifier-code', { method: 'POST', body: { utilisateur_id, code } }); // obtient JWT
export const apiMe = () => api('/api/auth/me'); // profil token courant
export const apiAdmins = () => api('/api/auth/admins'); // liste comptes
export const apiCreerAdminConnecte = (body) =>
  api('/api/auth/admins', { method: 'POST', body }); // création par admin connecté

/* ---------- Clients & revendeurs ---------- */
export const apiClients = (q = '', type = '') => {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (type) params.set('type', type);
  const qs = params.toString();
  return api(`/api/clients${qs ? `?${qs}` : ''}`);
};
export const apiClient = (id) => api(`/api/clients/${id}`);
export const apiCreerClient = (body) => api('/api/clients', { method: 'POST', body });
export const apiMajClient = (id, body) => api(`/api/clients/${id}`, { method: 'PUT', body });

/* ---------- Médicaments / appareils (catalogue) ---------- */
export const apiMedicaments = (q = '') =>
  api(`/api/medicaments${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const apiCreerMedicament = (body) => api('/api/medicaments', { method: 'POST', body });
export const apiMajMedicament = (id, body) =>
  api(`/api/medicaments/${id}`, { method: 'PUT', body });
export const apiAppareils = (q = '') =>
  api(`/api/appareils${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const apiCreerAppareil = (body) => api('/api/appareils', { method: 'POST', body });
export const apiMajAppareil = (id, body) => api(`/api/appareils/${id}`, { method: 'PUT', body });

/* ---------- Paramètres pharmacie / stock / lots ---------- */
export const apiParametres = () => api('/api/parametres');
export const apiMajParametres = (body) => api('/api/parametres', { method: 'PUT', body });
export const apiStock = () => api('/api/stock');
export const apiLots = () => api('/api/lots');
export const apiCreerLot = (body) => api('/api/lots', { method: 'POST', body });

/* ---------- Achats : fournisseurs, commandes, réceptions ---------- */
export const apiFournisseurs = (q = '') =>
  api(`/api/fournisseurs${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const apiCreerFournisseur = (body) => api('/api/fournisseurs', { method: 'POST', body });
export const apiMajFournisseur = (id, body) =>
  api(`/api/fournisseurs/${id}`, { method: 'PUT', body });
export const apiCommandes = () => api('/api/commandes');
export const apiCreerCommande = (body) => api('/api/commandes', { method: 'POST', body });
export const apiReceptions = () => api('/api/receptions');
export const apiReception = (id) => api(`/api/receptions/${id}`);
export const apiCreerReception = (body) => api('/api/receptions', { method: 'POST', body });
export const apiValiderReception = (id, body) =>
  api(`/api/receptions/${id}/valider`, { method: 'POST', body });

/* ---------- Ventes, pro forma, factures, paiements ---------- */
export const apiVentes = () => api('/api/ventes');
export const apiCreerVente = (body) => api('/api/ventes', { method: 'POST', body });
export const apiProformas = () => api('/api/proformas');
export const apiProforma = (id) => api(`/api/proformas/${id}`);
export const apiCreerProforma = (body) => api('/api/proformas', { method: 'POST', body });
export const apiMajProforma = (id, body) => api(`/api/proformas/${id}`, { method: 'PUT', body });
export const apiFacturerProforma = (id, body) =>
  api(`/api/proformas/${id}/facturer`, { method: 'POST', body });
export const apiFactures = (params = '') => api(`/api/factures${params}`);
export const apiFacture = (id) => api(`/api/factures/${id}`);
export const apiDettes = (clientId) =>
  api(`/api/factures/dettes${clientId ? `?client_id=${clientId}` : ''}`);
export const apiPaiements = (params = '') => api(`/api/paiements${params}`);
export const apiCreerPaiement = (body) => api('/api/paiements', { method: 'POST', body });

/* ---------- Statistiques & alertes agrégées ---------- */
export const apiDashboard = () => api('/api/stats/dashboard'); // KPI accueil
export const apiFinance = () => api('/api/stats/finance'); // CA, encaissements, créances
export const apiAlertes = () => api('/api/stats/alertes'); // listes alertes site
export const apiNotifierAlertes = () =>
  api('/api/stats/alertes/notifier', { method: 'POST', body: {} }); // e-mail admins

/* ---------- Carnet de notes internes ---------- */
export const apiNotes = (q = '') =>
  api(`/api/notes${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const apiNote = (id) => api(`/api/notes/${id}`);
export const apiCreerNote = (body) => api('/api/notes', { method: 'POST', body });
export const apiMajNote = (id, body) => api(`/api/notes/${id}`, { method: 'PUT', body });
export const apiSupprimerNote = (id) => api(`/api/notes/${id}`, { method: 'DELETE' });

export { API_URL };
