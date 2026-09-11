const API_URL = (
  import.meta.env.VITE_API_URL != null && String(import.meta.env.VITE_API_URL).trim() !== ''
    ? String(import.meta.env.VITE_API_URL).trim()
    : import.meta.env.DEV
      ? 'http://localhost:4000'
      : ''
).replace(/\/$/, '');
const TOKEN_KEY = 'sandia_token';
const USER_KEY = 'sandia_utilisateur';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getUtilisateurStocke() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function sauvegarderSession(token, utilisateur) {
  setToken(token);
  if (utilisateur) localStorage.setItem(USER_KEY, JSON.stringify(utilisateur));
}

export function effacerSession() {
  setToken('');
  localStorage.removeItem(USER_KEY);
}

export async function api(chemin, options = {}) {
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
  if (!reponse.ok) {
    const erreur = new Error(data.message || `Erreur API (${reponse.status})`);
    erreur.status = reponse.status;
    erreur.data = data;
    throw erreur;
  }
  return data;
}

/* Auth */
export const apiStatutAuth = () => api('/api/auth/statut');
export const apiCreerAdmin = (body) => api('/api/auth/creer-admin', { method: 'POST', body });
export const apiLogin = (nom_utilisateur, mot_de_passe) =>
  api('/api/auth/login', { method: 'POST', body: { nom_utilisateur, mot_de_passe } });
export const apiVerifierCode = (utilisateur_id, code) =>
  api('/api/auth/verifier-code', { method: 'POST', body: { utilisateur_id, code } });
export const apiMe = () => api('/api/auth/me');
export const apiAdmins = () => api('/api/auth/admins');
export const apiCreerAdminConnecte = (body) =>
  api('/api/auth/admins', { method: 'POST', body });

/* Clients */
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

/* Médicaments / appareils */
export const apiMedicaments = (q = '') =>
  api(`/api/medicaments${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const apiCreerMedicament = (body) => api('/api/medicaments', { method: 'POST', body });
export const apiMajMedicament = (id, body) =>
  api(`/api/medicaments/${id}`, { method: 'PUT', body });
export const apiAppareils = (q = '') =>
  api(`/api/appareils${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const apiCreerAppareil = (body) => api('/api/appareils', { method: 'POST', body });
export const apiMajAppareil = (id, body) => api(`/api/appareils/${id}`, { method: 'PUT', body });

/* Paramètres / stock / lots */
export const apiParametres = () => api('/api/parametres');
export const apiMajParametres = (body) => api('/api/parametres', { method: 'PUT', body });
export const apiStock = () => api('/api/stock');
export const apiLots = () => api('/api/lots');
export const apiCreerLot = (body) => api('/api/lots', { method: 'POST', body });

/* Fournisseurs / commandes / réceptions */
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

/* Ventes / proformas / factures / paiements */
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

/* Stats */
export const apiDashboard = () => api('/api/stats/dashboard');
export const apiFinance = () => api('/api/stats/finance');
export const apiAlertes = () => api('/api/stats/alertes');
export const apiNotifierAlertes = () =>
  api('/api/stats/alertes/notifier', { method: 'POST', body: {} });

export { API_URL };
