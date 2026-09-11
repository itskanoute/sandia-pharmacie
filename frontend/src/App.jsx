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
import './App.css';

export default function App() {
  const [utilisateur, setUtilisateur] = useState(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    async function init() {
      const stocke = getUtilisateurStocke();
      if (stocke && getToken()) {
        setUtilisateur(stocke);
      }

      if (!getToken()) {
        setPret(true);
        return;
      }

      try {
        const profil = await apiMe();
        setUtilisateur(profil);
      } catch {
        effacerSession();
        setUtilisateur(null);
      } finally {
        setPret(true);
      }
    }

    init();
  }, []);

  function handleConnexion(user) {
    setUtilisateur(user);
  }

  function handleDeconnexion() {
    effacerSession();
    setUtilisateur(null);
  }

  if (!pret) {
    return (
      <div className="page-connexion">
        <p className="chargement">Chargement…</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
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
          <Route path="parametres" element={<Parametres />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={utilisateur ? '/' : '/connexion'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
