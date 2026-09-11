/**
 * Logo officiel SAN-DIA DISTRIBUTION
 * Affiché sur l’interface et les documents imprimables.
 */
export default function Logo({
  variant = 'default',
  className = '',
  showSlogan = false,
}) {
  return (
    <div className={`logo-sandia logo-${variant} ${className}`.trim()}>
      <img
        src="/logo-sandia.png"
        alt="SAN-DIA DISTRIBUTION — Distribution fiable pour une santé durable"
        className="logo-sandia-img"
      />
      {showSlogan ? (
        <p className="logo-slogan">Distribution fiable pour une santé durable</p>
      ) : null}
    </div>
  );
}
