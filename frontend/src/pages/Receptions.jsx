import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import {
  apiCommandes,
  apiCreerReception,
  apiReception,
  apiReceptions,
  apiValiderReception,
} from '../api';
import { formatDate } from '../utils/format';

export default function Receptions() {
  const [liste, setListe] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [commandeId, setCommandeId] = useState('');
  const [detail, setDetail] = useState(null);
  const [lignesEdit, setLignesEdit] = useState([]);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  async function charger() {
    const [r, c] = await Promise.all([apiReceptions(), apiCommandes()]);
    setListe(r);
    setCommandes(c.filter((x) => x.statut !== 'recue' && x.statut !== 'annulee'));
    if (!commandeId && c[0]) setCommandeId(String(c[0].id));
  }

  useEffect(() => {
    charger().catch((e) => setErreur(e.message));
  }, []);

  async function creer() {
    try {
      const rec = await apiCreerReception({ commande_id: Number(commandeId) });
      setMessage(`Réception ${rec.numero} créée.`);
      await charger();
      await ouvrir(rec.id);
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function ouvrir(id) {
    const rec = await apiReception(id);
    setDetail(rec);
    setLignesEdit(
      (rec.lignes || []).map((l) => ({
        id: l.id,
        quantite_recue: l.quantite_recue,
        numero_lot: l.numero_lot || '',
        date_peremption: l.date_peremption || '',
      }))
    );
  }

  async function valider() {
    try {
      const data = await apiValiderReception(detail.id, { lignes: lignesEdit });
      setMessage(data.message);
      setDetail(data.reception);
      await charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <div className="page">
      <PageHeader titre="Réceptions & contrôle" sousTitre="Contrôle puis entrée en stock" />
      {message ? <p className="message-succes">{message}</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      <div className="carte-formulaire">
        <div className="formulaire-tete">
          <div>
            <h3>Créer une réception</h3>
            <p>À partir d’une commande fournisseur, puis contrôle des lots.</p>
          </div>
        </div>
        <div className="grille-form">
          <label>
            Commande à recevoir
            <select value={commandeId} onChange={(e) => setCommandeId(e.target.value)}>
              {commandes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} — {c.fournisseur_nom}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="actions-form">
          <button type="button" className="bouton-principal" disabled={!commandeId} onClick={creer}>
            Créer une réception
          </button>
        </div>
      </div>

      {detail ? (
        <div className="carte-formulaire">
          <h3>
            {detail.numero} — {detail.statut}
          </h3>
          {(detail.lignes || []).map((l, idx) => {
            const edit = lignesEdit[idx] || {};
            return (
              <div key={l.id} className="grille-form" style={{ marginBottom: '1rem' }}>
                <strong>{l.designation}</strong>
                <span>Commandé : {l.quantite_commandee}</span>
                <label>
                  Qté reçue
                  <input
                    type="number"
                    min="0"
                    value={edit.quantite_recue}
                    disabled={detail.statut === 'validee'}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLignesEdit((prev) =>
                        prev.map((x) => (x.id === l.id ? { ...x, quantite_recue: v } : x))
                      );
                    }}
                  />
                </label>
                <label>
                  N° lot
                  <input
                    value={edit.numero_lot || ''}
                    disabled={detail.statut === 'validee'}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLignesEdit((prev) =>
                        prev.map((x) => (x.id === l.id ? { ...x, numero_lot: v } : x))
                      );
                    }}
                  />
                </label>
                <label>
                  Péremption
                  <input
                    type="date"
                    value={edit.date_peremption || ''}
                    disabled={detail.statut === 'validee'}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLignesEdit((prev) =>
                        prev.map((x) => (x.id === l.id ? { ...x, date_peremption: v } : x))
                      );
                    }}
                  />
                </label>
              </div>
            );
          })}
          {detail.statut !== 'validee' ? (
            <button type="button" className="bouton-principal" onClick={valider}>
              Valider → entrée stock
            </button>
          ) : null}
          <button type="button" className="bouton-secondaire" onClick={() => setDetail(null)}>
            Fermer
          </button>
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead><tr><th>N°</th><th>Date</th><th>Commande</th><th>Fournisseur</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {liste.map((r) => (
              <tr key={r.id}>
                <td>{r.numero}</td>
                <td>{formatDate(r.date_reception)}</td>
                <td>{r.commande_numero}</td>
                <td>{r.fournisseur_nom}</td>
                <td>{r.statut}</td>
                <td>
                  <button type="button" className="lien-action" onClick={() => ouvrir(r.id)}>
                    Ouvrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
