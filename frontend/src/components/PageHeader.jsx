export default function PageHeader({ titre, sousTitre, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{titre}</h1>
        {sousTitre ? <p className="page-sous-titre">{sousTitre}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
