/**
 * Logo officiel SAN-DIA DISTRIBUTION
 * Affiché sur l’interface et les documents imprimables.
 */

/**
 * @param {'default'|'header'|'document'|'login'} [variant] — variante CSS (taille / contexte)
 * @param {string} [className] — classes additionnelles
 * @param {boolean} [showSlogan] — affiche le slogan sous l’image
 */
export default function Logo({
  variant = 'default', // variante visuelle (connexion, en-tête, document…)
  className = '', // classes React optionnelles
  showSlogan = false, // slogan sous le logo si true
}) {
  return (
    <div className={`logo-sandia logo-${variant} ${className}`.trim()}>
      {/* Logo PNG servi depuis le dossier public (Vite) */}
      <img
        src="/logo-sandia.png"
        alt="SAN-DIA DISTRIBUTION — Distribution fiable pour une santé durable"
        className="logo-sandia-img"
      />
      {showSlogan ? (
        // Slogan optionnel (non utilisé partout)
        <p className="logo-slogan">Distribution fiable pour une santé durable</p>
      ) : null}
    </div>
  );
}
