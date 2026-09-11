import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { apiAlertes } from '../api';

const NAV = [
  { to: '/', label: 'Tableau de bord', end: true },
  { groupe: 'Produits' },
  { to: '/medicaments', label: 'Médicaments' },
  { to: '/appareils', label: 'Appareils médicaux' },
  { to: '/stock', label: 'Stock' },
  { to: '/lots', label: 'Lots & péremption' },
  { groupe: 'Achats' },
  { to: '/fournisseurs', label: 'Fournisseurs' },
  { to: '/achats', label: 'Achats / Commandes' },
  { to: '/receptions', label: 'Réceptions & contrôle' },
  { groupe: 'Ventes' },
  { to: '/clients', label: 'Clients' },
  { to: '/revendeurs', label: 'Revendeurs' },
  { to: '/ventes', label: 'Ventes / Sorties' },
  { to: '/proforma', label: 'Pro forma' },
  { to: '/factures', label: 'Factures' },
  { to: '/dettes', label: 'Dettes clients' },
  { groupe: 'Suivi' },
  { to: '/finance', label: 'Finance' },
  { to: '/alertes', label: 'Alertes' },
  { to: '/rapports', label: 'Rapports' },
  { to: '/admins', label: 'Administrateurs' },
  { to: '/parametres', label: 'Paramètres' },
];

export default function Layout({ utilisateur, onDeconnexion }) {
  const navigate = useNavigate();
  const location = useLocation();
  const nom = utilisateur?.nom_complet || 'Administrateur';
  const [alertes, setAlertes] = useState(null);
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    let actif = true;
    function charger() {
      apiAlertes()
        .then((data) => {
          if (actif) setAlertes(data);
        })
        .catch(() => {
          if (actif) setAlertes(null);
        });
    }
    charger();
    const timer = setInterval(charger, 60000);
    return () => {
      actif = false;
      clearInterval(timer);
    };
  }, []);

  /* Ferme le menu mobile à chaque changement de page */
  useEffect(() => {
    setMenuOuvert(false);
  }, [location.pathname]);

  /* Empêche le scroll de fond quand le menu est ouvert */
  useEffect(() => {
    if (!menuOuvert) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOuvert]);

  const nbAlertes = useMemo(() => {
    if (!alertes) return 0;
    return (
      (alertes.stock?.length || 0) +
      (alertes.lots?.length || 0) +
      (alertes.peremption?.length || 0) +
      (alertes.dettes?.length || 0)
    );
  }, [alertes]);

  function quitter() {
    setMenuOuvert(false);
    onDeconnexion?.();
    navigate('/connexion');
  }

  return (
    <div className={`app-shell ${menuOuvert ? 'menu-ouvert' : ''}`}>
      <header className="topbar-mobile no-print">
        <button
          type="button"
          className="bouton-menu"
          aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOuvert}
          onClick={() => setMenuOuvert((v) => !v)}
        >
          <span className="menu-icone" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <div className="topbar-mobile-marque">
          <strong>SAN-DIA</strong>
          <span>Pharmacie Mali</span>
        </div>
        {nbAlertes > 0 ? (
          <button
            type="button"
            className="topbar-alerte"
            onClick={() => navigate('/alertes')}
          >
            {nbAlertes}
          </button>
        ) : (
          <span className="topbar-alerte-placeholder" />
        )}
      </header>

      <div
        className="sidebar-overlay no-print"
        aria-hidden={!menuOuvert}
        onClick={() => setMenuOuvert(false)}
      />

      <aside className="sidebar" id="menu-principal">
        <div className="sidebar-brand">
          <div className="sidebar-brand-ligne">
            <Logo variant="sidebar" />
            <button
              type="button"
              className="bouton-fermer-menu no-print"
              aria-label="Fermer le menu"
              onClick={() => setMenuOuvert(false)}
            >
              ✕
            </button>
          </div>
          <p className="sidebar-activite">Pharmacie Mali</p>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) =>
            item.groupe ? (
              <p key={item.groupe} className="nav-groupe">
                {item.groupe}
              </p>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? 'nav-link actif' : 'nav-link'
                }
              >
                <span>{item.label}</span>
                {item.to === '/alertes' && nbAlertes > 0 ? (
                  <span className="badge-nav-alerte">{nbAlertes}</span>
                ) : null}
              </NavLink>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <p className="user-mini">{nom}</p>
          <button type="button" className="bouton-secondaire" onClick={quitter}>
            Quitter
          </button>
        </div>
      </aside>

      <div className="main-area">
        <div className="bandeau-logo no-print">
          <Logo variant="header" />
          <div className="bandeau-logo-texte">
            <strong>SAN-DIA DISTRIBUTION</strong>
            <span>Bamako · 73 36 11 10 / 69 67 05 69 · FCFA</span>
          </div>
          {nbAlertes > 0 ? (
            <button
              type="button"
              className="bandeau-alerte"
              onClick={() => navigate('/alertes')}
            >
              {nbAlertes} alerte{nbAlertes > 1 ? 's' : ''} — stock / lots / péremption / dettes
            </button>
          ) : null}
        </div>
        <Outlet />
      </div>
    </div>
  );
}
