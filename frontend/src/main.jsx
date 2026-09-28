/**
 * Point d’entrée React : monte l’application dans #root (mode StrictMode).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Récupère la racine DOM définie dans index.html
const rootEl = document.getElementById('root');
// Monte l’application React (createRoot API React 18+)
createRoot(rootEl).render(
  <StrictMode>
    {/* StrictMode : double-invocation des effets en dev pour détecter les bugs */}
    <App />
  </StrictMode>,
)
