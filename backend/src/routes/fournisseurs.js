const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(authentifier);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    let sql = `SELECT * FROM fournisseurs WHERE 1=1`;
    const params = [];
    if (req.query.actif !== '0') {
      sql += ` AND actif = 1`;
    }
    if (q) {
      sql += ` AND (nom LIKE ? OR telephone LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY nom ASC`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(`SELECT * FROM fournisseurs WHERE id = ?`, [
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ message: 'Fournisseur introuvable.' });
    res.json(rows[0]);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const nom = String(req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ message: 'Le nom est obligatoire.' });

    const [result] = await pool.execute(
      `INSERT INTO fournisseurs (nom, telephone, email, adresse, contact_nom, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nom,
        String(req.body.telephone || '').trim() || null,
        String(req.body.email || '').trim() || null,
        String(req.body.adresse || '').trim() || null,
        String(req.body.contact_nom || '').trim() || null,
        String(req.body.notes || '').trim() || null,
      ]
    );
    const [rows] = await pool.execute(`SELECT * FROM fournisseurs WHERE id = ?`, [
      result.insertId,
    ]);
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const nom = String(req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ message: 'Le nom est obligatoire.' });
    const actif = req.body.actif === 0 || req.body.actif === false ? 0 : 1;

    const [result] = await pool.execute(
      `UPDATE fournisseurs SET
         nom = ?, telephone = ?, email = ?, adresse = ?, contact_nom = ?, notes = ?, actif = ?
       WHERE id = ?`,
      [
        nom,
        String(req.body.telephone || '').trim() || null,
        String(req.body.email || '').trim() || null,
        String(req.body.adresse || '').trim() || null,
        String(req.body.contact_nom || '').trim() || null,
        String(req.body.notes || '').trim() || null,
        actif,
        req.params.id,
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Fournisseur introuvable.' });
    }
    const [rows] = await pool.execute(`SELECT * FROM fournisseurs WHERE id = ?`, [
      req.params.id,
    ]);
    res.json(rows[0]);
  })
);

module.exports = router;
