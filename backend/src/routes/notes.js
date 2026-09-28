/**
 * API REST du carnet de notes internes (`carnet_notes`).
 * Toutes les routes exigent une session admin valide.
 */
const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
// JWT obligatoire : carnet réservé aux admins connectés
router.use(authentifier);

let tablePrete = false;

/** Crée la table au premier accès si la migration SQL n’a pas encore été appliquée. */
async function assurerTable() {
  if (tablePrete) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS carnet_notes (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      titre         VARCHAR(200) NOT NULL,
      contenu       TEXT NOT NULL,
      cree_par      INT UNSIGNED NULL,
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_carnet_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tablePrete = true;
}

/** GET / — Liste notes, recherche q sur titre/contenu. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    await assurerTable();
    const q = String(req.query.q || '').trim();
    let sql = `SELECT id, titre, contenu, cree_par, created_at, updated_at
               FROM carnet_notes`;
    const params = [];
    if (q) {
      sql += ` WHERE titre LIKE ? OR contenu LIKE ?`;
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY updated_at DESC, id DESC`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  })
);

/** GET /:id — Une note par id. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await assurerTable();
    const [rows] = await pool.execute(
      `SELECT id, titre, contenu, cree_par, created_at, updated_at
       FROM carnet_notes WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Note introuvable.' });
    }
    res.json(rows[0]);
  })
);

/** POST / — Création ; titre et contenu obligatoires. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    await assurerTable();
    const titre = String(req.body.titre || '').trim();
    const contenu = String(req.body.contenu || '').trim();
    if (!titre) {
      return res.status(400).json({ message: 'Le titre est obligatoire.' });
    }
    if (!contenu) {
      return res.status(400).json({ message: 'Le contenu de la note est obligatoire.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO carnet_notes (titre, contenu, cree_par) VALUES (?, ?, ?)`,
      [titre.slice(0, 200), contenu, req.utilisateur?.id || null]
    );

    const [rows] = await pool.execute(
      `SELECT id, titre, contenu, cree_par, created_at, updated_at
       FROM carnet_notes WHERE id = ? LIMIT 1`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  })
);

/** PUT /:id — Mise à jour titre/contenu. */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    await assurerTable();
    const titre = String(req.body.titre || '').trim();
    const contenu = String(req.body.contenu || '').trim();
    if (!titre) {
      return res.status(400).json({ message: 'Le titre est obligatoire.' });
    }
    if (!contenu) {
      return res.status(400).json({ message: 'Le contenu de la note est obligatoire.' });
    }

    const [result] = await pool.execute(
      `UPDATE carnet_notes SET titre = ?, contenu = ? WHERE id = ?`,
      [titre.slice(0, 200), contenu, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Note introuvable.' });
    }

    const [rows] = await pool.execute(
      `SELECT id, titre, contenu, cree_par, created_at, updated_at
       FROM carnet_notes WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    res.json(rows[0]);
  })
);

/** DELETE /:id — Suppression définitive. */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await assurerTable();
    const [result] = await pool.execute(`DELETE FROM carnet_notes WHERE id = ?`, [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Note introuvable.' });
    }
    res.json({ message: 'Note supprimée.' });
  })
);

/** Router carnet → /api/notes */
module.exports = router;
