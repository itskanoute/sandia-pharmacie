/**
 * App.jsx — Point d’entrée de l’interface SAN-DIA DISTRIBUTION
 * ------------------------------------------------------------
 * Rôle :
 *  - Gérer la session administrateur (token JWT + profil)
 *  - Définir les routes publiques (connexion / création de compte)
 *  - Protéger les pages métier derrière le Layout (menu latéral)
 *
 * Données : l’API backend + MySQL (Aiven en production / local en dev).
 */
import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { apiMe, effacerSession, getToken, getUtilisateurStocke } from './api';
import Connexion from './pages/Connexion';
import CreerCompte from './pages/CreerCompte';
import Dashboard from './pages/Dashboard';
import Medicaments from './pages/Medicaments';
import Appareils from './pages/Appareils';
import Stock from './pages/Stock';
import Lots from './pages/Lots';
import Fournisseurs from './pages/Fournisseurs';
import Achats from './pages/Achats';
import Receptions from './pages/Receptions';
import Clients from './pages/Clients';
import Revendeurs from './pages/Revendeurs';
import Ventes from './pages/Ventes';
import Proforma from './pages/Proforma';
import Factures from './pages/Factures';
import Dettes from './pages/Dettes';
import Finance from './pages/Finance';
import Alertes from './pages/Alertes';
import Rapports from './pages/Rapports';
import Admins from './pages/Admins';
import Parametres from './pages/Parametres';
import Carnet from './pages/Carnet';
import './App.css';

export default function App() {
  // Utilisateur connecté (null = non authentifié)
  const [utilisateur, setUtilisateur] = useState(null); // profil admin connecté
  // false tant que la vérification de session n’est pas terminée
  const [pret, setPret] = useState(false); // évite flash routes protégées

  // Au démarrage : restaurer la session locale puis valider le token auprès de l’API
  useEffect(() => {
    async function init() {
      const stocke = getUtilisateurStocke();
      if (stocke && getToken()) {
        setUtilisateur(stocke);
      }

      // Pas de token → page de connexion
      if (!getToken()) {
        setPret(true);
        return;
      }

      try {
        // Token encore valide ? récupère le profil à jour
        const profil = await apiMe();
        setUtilisateur(profil);
      } catch {
        // Token expiré / invalide → déconnexion
        effacerSession();
        setUtilisateur(null);
      } finally {
        setPret(true);
      }
    }

    init();
  }, []);

  /** Appelé après une connexion réussie (code e-mail validé) */
  function handleConnexion(user) {
    setUtilisateur(user);
  }

  /** Déconnexion : efface le token et le profil du navigateur */
  function handleDeconnexion() {
    effacerSession();
    setUtilisateur(null);
  }

  // Évite un flash de contenu avant de savoir si l’utilisateur est connecté
  if (!pret) {
    return (
      <div className="page-connexion">
        <p className="chargement">Chargement…</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {/* Routage : pages publiques vs shell Layout protégé */}
      <Routes>
        {/* ---------- Routes publiques ---------- */}
        <Route
          path="/connexion"
          element={
            utilisateur ? (
              <Navigate to="/" replace />
            ) : (
              <Connexion onConnexion={handleConnexion} />
            )
          }
        />
        <Route
          path="/creer-compte"
          element={utilisateur ? <Navigate to="/" replace /> : <CreerCompte />}
        />

        {/* ---------- Routes protégées (admin connecté) ---------- */}
        <Route
          element={
            utilisateur ? (
              <Layout utilisateur={utilisateur} onDeconnexion={handleDeconnexion} />
            ) : (
              <Navigate to="/connexion" replace />
            )
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="medicaments" element={<Medicaments />} />
          <Route path="appareils" element={<Appareils />} />
          <Route path="stock" element={<Stock />} />
          <Route path="lots" element={<Lots />} />
          <Route path="fournisseurs" element={<Fournisseurs />} />
          <Route path="achats" element={<Achats />} />
          <Route path="receptions" element={<Receptions />} />
          <Route path="clients" element={<Clients />} />
          <Route path="revendeurs" element={<Revendeurs />} />
          <Route path="ventes" element={<Ventes />} />
          <Route path="proforma" element={<Proforma />} />
          <Route path="factures" element={<Factures />} />
          <Route path="dettes" element={<Dettes />} />
          <Route path="finance" element={<Finance />} />
          <Route path="alertes" element={<Alertes />} />
          <Route path="rapports" element={<Rapports />} />
          <Route path="admins" element={<Admins />} />
          <Route path="carnet" element={<Carnet />} />
          <Route path="parametres" element={<Parametres />} />
        </Route>

        {/* Toute URL inconnue → accueil ou connexion */}
        <Route
          path="*"
          element={<Navigate to={utilisateur ? '/' : '/connexion'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
